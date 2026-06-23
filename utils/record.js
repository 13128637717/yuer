const { formatDuration, calcSleepDuration } = require('./date');
const { POOP_STATUS_MAP } = require('./constants');

/**
 * 计算辅食总克数（不论 unit，累加 amount）
 */
function calcFoodGrams(foodRecords) {
  return (foodRecords || []).reduce((sum, f) => sum + (f.amount || 0), 0);
}

function formatAmountList(amounts) {
  if (!amounts || amounts.length === 0) return '0';
  return amounts.join('+');
}

function formatDayExport(record) {
  const milkAmounts = (record.milkRecords || []).map((m) => m.amount || 0);
  const totalMilk = milkAmounts.reduce((s, a) => s + a, 0);

  const foodAmounts = (record.foodRecords || []).map((f) => f.amount || 0);
  const totalFood = foodAmounts.reduce((s, a) => s + a, 0);

  const sleepDurations = (record.sleepRecords || []).map(
    (s) => s.duration || calcSleepDuration(s.startTime, s.endTime)
  );
  const totalSleepMin = sleepDurations.reduce((s, d) => s + d, 0);
  const sleepTexts = sleepDurations.map((d) => formatDuration(d));

  const milkLine = milkAmounts.length
    ? `${formatAmountList(milkAmounts)}=${totalMilk}（总${totalMilk}ml）`
    : `0（总0ml）`;
  const foodLine = foodAmounts.length
    ? `${formatAmountList(foodAmounts)}=${totalFood}（总${totalFood}g）`
    : `0（总0g）`;
  const sleepLine = sleepTexts.length
    ? `${sleepTexts.join('+')}=${formatDuration(totalSleepMin)}（总${formatDuration(totalSleepMin)}）`
    : `0分钟（总0分钟）`;

  const poopList = record.poopRecords || [];
  const poopCount = poopList.length;
  let poopLine = `0次`;
  if (poopCount > 0) {
    const parts = poopList.map((p) => `${p.time}${POOP_STATUS_MAP[p.status] || p.status || ''}`);
    poopLine = `${poopCount}次（${parts.join('+')}）`;
    const imageCount = poopList.filter((p) => p.image).length;
    if (imageCount > 0) {
      poopLine = `${poopCount}次（${parts.join('+')}，含${imageCount}张状态图）`;
    }
  }

  const lines = [
    record.recordDate,
    `奶量：${milkLine}`,
    `辅食：${foodLine}`,
    `睡眠：${sleepLine}`,
    `拉粑粑：${poopLine}`
  ];

  const diary = (record.diary || '').trim();
  const imageCount = (record.diaryImages || []).length;
  if (diary) {
    lines.push(`心得：${diary}`);
  } else if (imageCount > 0) {
    lines.push(`心得：（含${imageCount}张图片）`);
  }

  return lines.join('\n');
}

/**
 * 将记录列表格式化为导出文本
 */
function formatRecordsExport(records) {
  if (!records || records.length === 0) return '暂无记录';

  const withData = records.filter((r) => {
    const hasMilk = (r.milkRecords || []).length > 0;
    const hasFood = (r.foodRecords || []).length > 0;
    const hasSleep = (r.sleepRecords || []).length > 0;
    const hasPoop = (r.poopRecords || []).length > 0;
    const hasDiary = !!(r.diary && r.diary.trim()) || (r.diaryImages || []).length > 0;
    return hasMilk || hasFood || hasSleep || hasPoop || hasDiary;
  });

  if (withData.length === 0) return '暂无记录';

  return withData.map(formatDayExport).join('\n\n');
}

module.exports = {
  calcFoodGrams,
  formatRecordsExport
};
