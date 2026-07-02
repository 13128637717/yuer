const {
  formatDuration,
  calcSleepDuration,
  isCrossMidnightSleep,
  getDayTimelineSortKey
} = require('./date');
const { POOP_STATUS_MAP } = require('./constants');

/**
 * 辅食按单位分别累加（g 与 ml 不混算）
 */
function calcFoodTotals(foodRecords) {
  let foodGrams = 0;
  let foodMl = 0;
  (foodRecords || []).forEach((f) => {
    const amount = f.amount || 0;
    if (f.unit === 'ml') {
      foodMl += amount;
    } else {
      foodGrams += amount;
    }
  });
  return { foodGrams, foodMl };
}

/** @deprecated 使用 calcFoodTotals */
function calcFoodGrams(foodRecords) {
  return calcFoodTotals(foodRecords).foodGrams;
}

function formatAmountList(amounts) {
  if (!amounts || amounts.length === 0) return '0';
  return amounts.join('+');
}

function formatFoodLine(foodRecords) {
  const { foodGrams, foodMl } = calcFoodTotals(foodRecords);
  const parts = [];
  (foodRecords || []).forEach((f) => {
    parts.push(`${f.amount || 0}${f.unit === 'ml' ? 'ml' : 'g'}`);
  });
  const detail = parts.length ? parts.join('+') : '0';
  const totals = [];
  if (foodGrams > 0) totals.push(`${foodGrams}g`);
  if (foodMl > 0) totals.push(`${foodMl}ml`);
  const totalText = totals.length ? totals.join('、') : '0';
  return `${detail}（总${totalText}）`;
}

function formatDayExport(record) {
  const milkAmounts = (record.milkRecords || []).map((m) => m.amount || 0);
  const totalMilk = milkAmounts.reduce((s, a) => s + a, 0);

  const sleepDurations = (record.sleepRecords || []).map(
    (s) => s.duration || calcSleepDuration(s.startTime, s.endTime)
  );
  const totalSleepMin = sleepDurations.reduce((s, d) => s + d, 0);
  const sleepTexts = sleepDurations.map((d) => formatDuration(d));

  const milkLine = milkAmounts.length
    ? `${formatAmountList(milkAmounts)}=${totalMilk}（总${totalMilk}ml）`
    : '0（总0ml）';
  const foodLine = formatFoodLine(record.foodRecords || []);
  const sleepLine = sleepTexts.length
    ? `${sleepTexts.join('+')}=${formatDuration(totalSleepMin)}（总${formatDuration(totalSleepMin)}）`
    : '0分钟（总0分钟）';

  const poopList = record.poopRecords || [];
  const poopCount = poopList.length;
  let poopLine = '0次';
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

function withRecordedBy(text, recordedBy) {
  return recordedBy ? `${text} · ${recordedBy}` : text;
}

/**
 * 睡眠记录排序：跨夜睡眠（如前晚 22:00→次日 07:00）排在最前
 */
function sortSleepRecords(sleepRecords) {
  return [...(sleepRecords || [])].sort((a, b) => {
    const keyA = getDayTimelineSortKey(a.startTime, {
      isCrossMidnight: isCrossMidnightSleep(a.startTime, a.endTime)
    });
    const keyB = getDayTimelineSortKey(b.startTime, {
      isCrossMidnight: isCrossMidnightSleep(b.startTime, b.endTime)
    });
    return keyA - keyB;
  });
}

/**
 * 合并当日各类型记录为按时间排序的时间线
 */
function buildDayTimeline(record) {
  const items = [];
  (record.milkRecords || []).forEach((m, i) => {
    items.push({
      key: `milk-${i}`,
      type: 'milk',
      time: m.time,
      label: '奶量',
      iconSrc: '/images/icons/milk.png',
      detail: `${m.amount} ml`,
      subDetail: ''
    });
  });
  (record.foodRecords || []).forEach((f, i) => {
    const unit = f.unit === 'ml' ? 'ml' : 'g';
    const foodName = (f.foodName || '').trim();
    const detail = foodName ? `${foodName} ${f.amount}${unit}` : `${f.amount}${unit}`;
    items.push({
      key: `food-${i}`,
      type: 'food',
      time: f.time,
      label: '辅食',
      iconSrc: '/images/icons/food.png',
      detail,
      subDetail: ''
    });
  });
  (record.sleepRecords || []).forEach((s, i) => {
    const dur = s.duration || calcSleepDuration(s.startTime, s.endTime);
    const isCrossMidnight = isCrossMidnightSleep(s.startTime, s.endTime);
    items.push({
      key: `sleep-${i}`,
      type: 'sleep',
      time: s.startTime,
      isCrossMidnight,
      label: '睡眠',
      iconSrc: '/images/icons/sleep.png',
      detail: formatDuration(dur),
      timeRange: s.endTime ? `${s.startTime} 至 ${s.endTime}` : '',
      subDetail: ''
    });
  });
  (record.poopRecords || []).forEach((p, i) => {
    items.push({
      key: `poop-${i}`,
      type: 'poop',
      time: p.time,
      label: '拉粑粑',
      iconSrc: '/images/icons/poop.png',
      detail: POOP_STATUS_MAP[p.status] || p.status || '',
      subDetail: ''
    });
  });
  items.sort((a, b) => {
    const keyA = getDayTimelineSortKey(a.time, { isCrossMidnight: a.isCrossMidnight });
    const keyB = getDayTimelineSortKey(b.time, { isCrossMidnight: b.isCrossMidnight });
    return keyA - keyB;
  });
  return items;
}

/**
 * 检测昨日缺失的记录项，返回提示文案
 */
function buildYesterdayHint(summary, yesterdayDate) {
  if (!summary) return '';
  const missing = [];
  if (!summary.totalMilk) missing.push('奶量');
  if (!summary.foodGrams && !summary.foodMl) missing.push('辅食');
  if (!summary.totalSleepMin) missing.push('睡眠');
  if (!summary.poopCount) missing.push('拉粑粑');
  if (!missing.length) return '';
  return `昨天（${yesterdayDate}）还没记${missing.join('、')}，要去补记吗？`;
}

module.exports = {
  calcFoodTotals,
  calcFoodGrams,
  formatRecordsExport,
  sortSleepRecords,
  buildDayTimeline,
  buildYesterdayHint
};
