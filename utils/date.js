// 日期与时间工具函数

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取今天日期字符串
 */
function today() {
  return formatDate(new Date());
}

/**
 * 日期加减天数
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * 生成日期范围数组（含首尾）
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

/**
 * 计算宝宝月龄（X岁X月 或 X个月）
 */
function calcMonthAge(birthDate) {
  if (!birthDate) return '未知';
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months += now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) months = 0;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`;
  }
  return `${months}个月`;
}

/**
 * 时间字符串转分钟数（HH:mm）
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * 计算睡眠时长（分钟），支持跨天
 */
function calcSleepDuration(startTime, endTime) {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end < start) {
    end += 24 * 60;
  }
  return end - start;
}

/**
 * 分钟转 X小时Y分钟 显示
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0分钟';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

/**
 * 获取当前时间 HH:mm
 */
function nowTime() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 获取 N 天前的日期
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/**
 * 是否跨夜睡眠（结束时间早于开始时间）
 */
function isCrossMidnightSleep(startTime, endTime) {
  if (!startTime || !endTime) return false;
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

/**
 * 当日时间线排序键（分钟）；跨夜记录减去 24h 使其排在最前
 */
function getDayTimelineSortKey(time, options = {}) {
  const mins = timeToMinutes(time);
  if (options.isCrossMidnight) {
    return mins - 24 * 60;
  }
  return mins;
}

module.exports = {
  formatDate,
  today,
  addDays,
  getDateRange,
  calcMonthAge,
  timeToMinutes,
  calcSleepDuration,
  formatDuration,
  nowTime,
  daysAgo,
  isCrossMidnightSleep,
  getDayTimelineSortKey
};
