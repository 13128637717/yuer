// 云函数公共工具
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 格式化日期 YYYY-MM-DD
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取昨天日期
 */
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/**
 * 日期范围数组
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    const d = new Date(current);
    d.setDate(d.getDate() + 1);
    current = formatDate(d);
  }
  return dates;
}

/**
 * 计算睡眠时长（分钟）
 */
function calcSleepDuration(startTime, endTime) {
  const timeToMin = (t) => {
    const p = t.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  };
  let start = timeToMin(startTime);
  let end = timeToMin(endTime);
  if (end < start) end += 24 * 60;
  return end - start;
}

/**
 * 通过 openid 查找所属家庭（仅匹配 members 中的成员）
 */
async function findFamilyByOpenid(openid) {
  const familyRes = await db.collection('families')
    .where({ members: _.elemMatch({ openid }) })
    .limit(1)
    .get();
  return familyRes.data[0] || null;
}

/**
 * 解析用户与家庭 ID，必要时从家庭表修复用户记录
 */
async function resolveUserFamily(openid) {
  let user = await getUser(openid);
  let familyId = user && user.familyId;

  if (!familyId) {
    const family = await findFamilyByOpenid(openid);
    if (!family) return { user, familyId: null };

    const member = family.members.find((m) => m.openid === openid);
    if (!member) return { user, familyId: null };

    familyId = family.familyId;
    const role = member.role;

    if (user) {
      await db.collection('users').doc(user._id).update({ data: { familyId, role } });
      user = { ...user, familyId, role };
    } else {
      user = { nickName: member.nickName || member.name, familyId, role };
    }
    return { user, familyId };
  }

  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) {
    if (user && user._id) {
      await db.collection('users').doc(user._id).update({ data: { familyId: '', role: '' } });
      user = { ...user, familyId: '', role: '' };
    }
    return { user, familyId: null };
  }

  return { user, familyId };
}

/**
 * 获取用户信息
 */
async function getUser(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get();
  if (!res.data.length) return null;
  const withFamily = res.data.find((u) => u.familyId);
  return withFamily || res.data[0];
}

/**
 * 校验用户是否属于指定家庭
 */
async function verifyFamilyMember(openid, familyId) {
  const familyRes = await db.collection('families').where({ familyId }).limit(1).get();
  if (!familyRes.data.length) return { valid: false, message: '家庭不存在' };
  const family = familyRes.data[0];
  const isMember = family.members.some((m) => m.openid === openid);
  if (!isMember) return { valid: false, message: '您不是该家庭成员' };
  return { valid: true, family };
}

/**
 * 生成 6 位唯一邀请码
 */
async function generateFamilyId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i++) {
    let code = '';
    for (let j = 0; j < 6; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const exist = await db.collection('families').where({ familyId: code }).count();
    if (exist.total === 0) return code;
  }
  throw new Error('邀请码生成失败，请重试');
}

/**
 * 获取或创建当天记录
 */
async function getOrCreateRecord(familyId, recordDate, openid) {
  const res = await db.collection('records')
    .where({ familyId, recordDate })
    .limit(1)
    .get();

  if (res.data.length) return res.data[0];

  const newRecord = {
    recordDate,
    familyId,
    creatorOpenid: openid,
    milkRecords: [],
    foodRecords: [],
    sleepRecords: [],
    diary: '',
    diaryImages: [],
    updateTime: db.serverDate()
  };
  const addRes = await db.collection('records').add({ data: newRecord });
  return { _id: addRes._id, ...newRecord };
}

module.exports = {
  cloud,
  db,
  _,
  formatDate,
  yesterday,
  getDateRange,
  calcSleepDuration,
  getUser,
  findFamilyByOpenid,
  resolveUserFamily,
  verifyFamilyMember,
  generateFamilyId,
  getOrCreateRecord
};
