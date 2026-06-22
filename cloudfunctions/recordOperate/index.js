// 云函数：recordOperate - 统一处理记录的增删改查
const {
  cloud, db, getUser, resolveUserFamily, verifyFamilyMember, getOrCreateRecord, calcSleepDuration
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
      case 'getTodaySummary':
        return await getTodaySummary(familyId, event.recordDate);
      case 'listRecords':
        return await listRecords(familyId, event, openid);
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
    diary: '',
    diaryImages: []
  };

  return { success: true, record };
}

/** 获取心得历史列表 */
async function getDiaryList(familyId, event) {
  const { startDate, endDate, limit = 30 } = event;
  const query = { familyId, diary: db.command.neq('') };
  if (startDate && endDate) {
    query.recordDate = db.command.gte(startDate).and(db.command.lte(endDate));
  }

  const res = await db.collection('records')
    .where(query)
    .orderBy('recordDate', 'desc')
    .limit(limit)
    .get();

  return { success: true, list: res.data };
}

/** 保存奶量记录 */
async function saveMilk(familyId, event, openid) {
  const { recordDate, milkRecords } = event;
  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const record = await getOrCreateRecord(familyId, recordDate, openid);
  await db.collection('records').doc(record._id).update({
    data: {
      milkRecords: milkRecords || [],
      creatorOpenid: openid,
      updateTime: db.serverDate()
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
      foodRecords: foodRecords || [],
      creatorOpenid: openid,
      updateTime: db.serverDate()
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
      sleepRecords: processed,
      creatorOpenid: openid,
      updateTime: db.serverDate()
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
    creatorOpenid: openid,
    updateTime: db.serverDate()
  };
  if (diary !== undefined) updateData.diary = diary;
  if (diaryImages !== undefined) updateData.diaryImages = diaryImages;

  await db.collection('records').doc(record._id).update({ data: updateData });

  return { success: true, message: '心得已保存' };
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
      summary: { totalMilk: 0, foodGrams: 0, totalSleepMin: 0, breastMilk: 0, formulaMilk: 0 }
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

  let foodGrams = 0;
  (record.foodRecords || []).forEach((f) => {
    foodGrams += f.amount || 0;
  });
  let totalSleepMin = 0;
  (record.sleepRecords || []).forEach((s) => {
    totalSleepMin += s.duration || calcSleepDuration(s.startTime, s.endTime);
  });

  return {
    success: true,
    summary: { totalMilk, foodGrams, totalSleepMin, breastMilk, formulaMilk },
    record
  };
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
    diary: r.diary || '',
    diaryImages: r.diaryImages || []
  }));

  return { success: true, records: simplified };
}
