// 云函数：recordOperate - 统一处理记录的增删改查
const {
  cloud, db, getUser, resolveUserFamily, verifyFamilyMember, getOrCreateRecord, calcSleepDuration,
  buildRecordMeta, stampRecords, hasRecordData
} = require('./utils');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  try {
    const { user, familyId } = await resolveUserFamily(openid);
    if (!familyId) {
      return { success: false, message: '请先创建或加入家庭' };
    }

    switch (action) {
      case 'get':
        return await getRecord(familyId, event.recordDate, openid);
      case 'getDiaryList':
        return await getDiaryList(familyId, event);
      case 'saveMilk':
        return await saveMilk(familyId, event, openid);
      case 'saveFood':
        return await saveFood(familyId, event, openid);
      case 'saveSleep':
        return await saveSleep(familyId, event, openid);
      case 'saveDiary':
        return await saveDiary(familyId, event, openid);
      case 'savePoop':
        return await savePoop(familyId, event, openid);
      case 'getTodaySummary':
        return await getTodaySummary(familyId, event.recordDate);
      case 'listRecords':
        return await listRecords(familyId, event, openid);
      case 'listRecordsPage':
        return await listRecordsPage(familyId, event, openid);
      case 'getRecordDates':
        return await getRecordDates(familyId, event, openid);
      case 'resolveFileUrls':
        return await resolveFileUrls(familyId, event, openid);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('recordOperate 错误:', err);
    return { success: false, message: err.message || '操作失败' };
  }
};

/** 获取当天记录 */
async function getRecord(familyId, recordDate, openid) {
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const res = await db.collection('records')
    .where({ familyId, recordDate })
    .limit(1)
    .get();

  const record = res.data[0] || {
    recordDate,
    familyId,
    milkRecords: [],
    foodRecords: [],
    sleepRecords: [],
    poopRecords: [],
    diary: '',
    diaryImages: []
  };

  return { success: true, record };
}

/** 获取心得历史列表（含仅图片无文字的记录） */
async function getDiaryList(familyId, event) {
  const { startDate, endDate, limit = 30 } = event;
  const query = { familyId };
  if (startDate && endDate) {
    query.recordDate = db.command.gte(startDate).and(db.command.lte(endDate));
  }

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 100);
  const res = await db.collection('records')
    .where(query)
    .orderBy('recordDate', 'desc')
    .limit(fetchLimit)
    .get();

  const list = res.data.filter((r) => {
    const hasText = !!(r.diary && String(r.diary).trim());
    const hasImages = (r.diaryImages || []).length > 0;
    return hasText || hasImages;
  }).slice(0, limit);

  return { success: true, list };
}

/** 保存奶量记录 */
async function saveMilk(familyId, event, openid) {
  const { recordDate, milkRecords } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  await db.collection('records').doc(record._id).update({
    data: {
      milkRecords: stampRecords(milkRecords, openid, verify.family),
      ...buildRecordMeta(openid, verify.family)
    }
  });

  return { success: true, message: '奶量记录已保存' };
}

/** 保存辅食记录 */
async function saveFood(familyId, event, openid) {
  const { recordDate, foodRecords } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  await db.collection('records').doc(record._id).update({
    data: {
      foodRecords: stampRecords(foodRecords, openid, verify.family),
      ...buildRecordMeta(openid, verify.family)
    }
  });

  return { success: true, message: '辅食记录已保存' };
}

/** 保存睡眠记录 */
async function saveSleep(familyId, event, openid) {
  const { recordDate, sleepRecords } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  // 计算每条睡眠时长
  const processed = (sleepRecords || []).map((item) => ({
    ...item,
    duration: calcSleepDuration(item.startTime, item.endTime)
  }));

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  await db.collection('records').doc(record._id).update({
    data: {
      sleepRecords: stampRecords(processed, openid, verify.family),
      ...buildRecordMeta(openid, verify.family)
    }
  });

  return { success: true, message: '睡眠记录已保存' };
}

/** 保存心得 */
async function saveDiary(familyId, event, openid) {
  const { recordDate, diary, diaryImages } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  const updateData = {
    ...buildRecordMeta(openid, verify.family)
  };
  if (diary !== undefined) updateData.diary = diary;
  if (diaryImages !== undefined) updateData.diaryImages = diaryImages;

  await db.collection('records').doc(record._id).update({ data: updateData });

  return { success: true, message: '心得已保存' };
}

/** 保存拉粑粑记录 */
async function savePoop(familyId, event, openid) {
  const { recordDate, poopRecords } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  await db.collection('records').doc(record._id).update({
    data: {
      poopRecords: stampRecords(poopRecords, openid, verify.family),
      ...buildRecordMeta(openid, verify.family)
    }
  });

  return { success: true, message: '拉粑粑记录已保存' };
}

/** 获取今日汇总 */
async function getTodaySummary(familyId, recordDate) {
  const res = await db.collection('records')
    .where({ familyId, recordDate })
    .limit(1)
    .get();

  const record = res.data[0];
  if (!record) {
    return {
      success: true,
      summary: {
        totalMilk: 0, foodGrams: 0, foodMl: 0, totalSleepMin: 0,
        breastMilk: 0, formulaMilk: 0, poopCount: 0
      }
    };
  }

  let totalMilk = 0;
  let breastMilk = 0;
  let formulaMilk = 0;
  (record.milkRecords || []).forEach((m) => {
    totalMilk += m.amount || 0;
    if (m.type === 'breast') breastMilk += m.amount || 0;
    else formulaMilk += m.amount || 0;
  });

  const foodTotals = calcFoodTotals(record.foodRecords);
  let totalSleepMin = 0;
  (record.sleepRecords || []).forEach((s) => {
    totalSleepMin += s.duration || calcSleepDuration(s.startTime, s.endTime);
  });

  const poopCount = (record.poopRecords || []).length;

  return {
    success: true,
    summary: {
      totalMilk,
      foodGrams: foodTotals.foodGrams,
      foodMl: foodTotals.foodMl,
      totalSleepMin,
      breastMilk,
      formulaMilk,
      poopCount
    },
    record
  };
}

function calcFoodTotals(foodRecords) {
  let foodGrams = 0;
  let foodMl = 0;
  (foodRecords || []).forEach((f) => {
    const amount = f.amount || 0;
    if (f.unit === 'ml') foodMl += amount;
    else foodGrams += amount;
  });
  return { foodGrams, foodMl };
}

/** 批量查询记录（支持日期范围或全部） */
async function listRecords(familyId, event, openid) {
  const { startDate, endDate } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const query = { familyId };
  if (startDate && endDate) {
    query.recordDate = db.command.gte(startDate).and(db.command.lte(endDate));
  }

  const PAGE_SIZE = 100;
  let records = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await db.collection('records')
      .where(query)
      .orderBy('recordDate', 'asc')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();

    records = records.concat(res.data);
    if (res.data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      skip += PAGE_SIZE;
    }
  }

  const simplified = records.map((r) => ({
    recordDate: r.recordDate,
    milkRecords: r.milkRecords || [],
    foodRecords: r.foodRecords || [],
    sleepRecords: r.sleepRecords || [],
    poopRecords: r.poopRecords || [],
    diary: r.diary || '',
    diaryImages: r.diaryImages || []
  }));

  return { success: true, records: simplified };
}

/** 分页查询记录（用于大量导出） */
async function listRecordsPage(familyId, event, openid) {
  const { startDate, endDate, page = 0, pageSize = 100 } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const query = { familyId };
  if (startDate && endDate) {
    query.recordDate = db.command.gte(startDate).and(db.command.lte(endDate));
  }

  const skip = Math.max(0, page) * pageSize;
  const res = await db.collection('records')
    .where(query)
    .orderBy('recordDate', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const simplified = res.data.map((r) => ({
    recordDate: r.recordDate,
    milkRecords: r.milkRecords || [],
    foodRecords: r.foodRecords || [],
    sleepRecords: r.sleepRecords || [],
    poopRecords: r.poopRecords || [],
    diary: r.diary || '',
    diaryImages: r.diaryImages || []
  }));

  return {
    success: true,
    records: simplified,
    page,
    hasMore: res.data.length === pageSize
  };
}

/** 获取有记录的日期列表（用于日历打点） */
async function getRecordDates(familyId, event, openid) {
  const { startDate, endDate, limit = 60 } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const query = { familyId };
  if (startDate && endDate) {
    query.recordDate = db.command.gte(startDate).and(db.command.lte(endDate));
  }

  const res = await db.collection('records')
    .where(query)
    .orderBy('recordDate', 'desc')
    .limit(Math.min(limit, 100))
    .get();

  const dates = res.data
    .filter(hasRecordData)
    .map((r) => r.recordDate);

  return { success: true, dates };
}

/** 从 fileID 提取云存储路径 */
function extractCloudPath(fileID) {
  const match = String(fileID).match(/^cloud:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : '';
}

/** 校验文件路径是否属于当前家庭 */
function isFamilyStoragePath(cloudPath, familyId) {
  return cloudPath.startsWith(`diary/${familyId}/`)
    || cloudPath.startsWith(`poop/${familyId}/`)
    || cloudPath.startsWith(`avatar/${familyId}/`);
}

/** 云函数管理员权限换取临时链接，绕过客户端存储读权限限制 */
async function resolveFileUrls(familyId, event, openid) {
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const fileIds = (event.fileIds || []).map((id) => String(id));
  if (fileIds.length === 0) return { success: true, urls: [] };

  const allowedIds = [];
  fileIds.forEach((fileID) => {
    if (!fileID.startsWith('cloud://')) return;
    const cloudPath = extractCloudPath(fileID);
    if (isFamilyStoragePath(cloudPath, familyId)) {
      allowedIds.push(fileID);
    } else {
      console.warn('拒绝访问非本家庭文件:', fileID);
    }
  });

  const urlMap = {};
  if (allowedIds.length > 0) {
    const res = await cloud.getTempFileURL({
      fileList: allowedIds.map((fileID) => ({ fileID, maxAge: 86400 }))
    });
    (res.fileList || []).forEach((item) => {
      if (item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL;
      } else {
        console.warn('云图片无法访问:', item.fileID, item.errMsg);
      }
    });
  }

  const urls = fileIds.map((id) => {
    if (!id.startsWith('cloud://')) return id;
    return urlMap[id] || '';
  });

  return { success: true, urls };
}
