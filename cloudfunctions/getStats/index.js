// 云函数：getStats - 统计每日奶量与睡眠时长
const {
  cloud, db, resolveUserFamily, verifyFamilyMember, getDateRange, calcSleepDuration
} = require('./utils');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { familyId, startDate, endDate } = event;

  try {
    const { familyId: userFamilyId } = await resolveUserFamily(openid);
    if (!userFamilyId) {
      return { success: false, message: '请先创建或加入家庭' };
    }

    const targetFamilyId = familyId || userFamilyId;
    const verify = await verifyFamilyMember(openid, targetFamilyId);
    if (!verify.valid) return { success: false, message: verify.message };

    if (!startDate || !endDate) {
      return { success: false, message: '请指定日期范围' };
    }

    // 查询日期范围内的记录
    const res = await db.collection('records')
      .where({
        familyId: targetFamilyId,
        recordDate: db.command.gte(startDate).and(db.command.lte(endDate))
      })
      .get();

    const recordMap = {};
    res.data.forEach((r) => {
      recordMap[r.recordDate] = r;
    });

    // 补全日期范围，缺失日期填 0
    const dates = getDateRange(startDate, endDate);
    const stats = dates.map((date) => {
      const record = recordMap[date];
      let totalMilk = 0;
      let breastMilk = 0;
      let formulaMilk = 0;
      let totalSleepMin = 0;
      let foodGrams = 0;

      if (record) {
        (record.milkRecords || []).forEach((m) => {
          totalMilk += m.amount || 0;
          if (m.type === 'breast') breastMilk += m.amount || 0;
          else formulaMilk += m.amount || 0;
        });
        (record.foodRecords || []).forEach((f) => {
          foodGrams += f.amount || 0;
        });
        (record.sleepRecords || []).forEach((s) => {
          totalSleepMin += s.duration || calcSleepDuration(s.startTime, s.endTime);
        });
      }

      return { date, totalMilk, breastMilk, formulaMilk, totalSleepMin, foodGrams };
    });

    return { success: true, stats };
  } catch (err) {
    console.error('getStats 错误:', err);
    return { success: false, message: err.message || '统计失败' };
  }
};
