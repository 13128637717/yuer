const { callFunction, getFamilyContext, ensureFamily, syncFamilyContext } = require('../../utils/cloud');
const { today, formatDuration } = require('../../utils/date');
const { MILK_TYPE_MAP } = require('../../utils/constants');
const { calcFoodGrams } = require('../../utils/record');

Page({
  data: {
    hasFamily: false,
    recordDate: '',
    milkRecords: [],
    foodRecords: [],
    sleepRecords: [],
    diary: '',
    totalMilk: 0,
    totalFoodGrams: 0,
    totalSleepText: '0分钟'
  },
  onShow() {
    this.setData({ recordDate: today() });
    this.loadRecord();
  },

  onPullDownRefresh() {
    this.loadRecord().finally(() => wx.stopPullDownRefresh());
  },

  onDateChange(e) {
    this.setData({ recordDate: e.detail.value });
    this.loadRecord();
  },

  async loadRecord() {
    await syncFamilyContext(true);
    const { hasFamily } = getFamilyContext();
    if (!hasFamily) {
      this.setData({
        hasFamily: false,
        milkRecords: [],
        foodRecords: [],
        sleepRecords: [],
        diary: '',
        totalMilk: 0,
        totalFoodGrams: 0,
        totalSleepText: '0分钟'
      });
      return;
    }
    this.setData({ hasFamily: true });

    try {
      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate: this.data.recordDate
      });
      const record = res.record || {};
      const milkRecords = (record.milkRecords || []).map((m) => ({
        ...m,
        typeText: MILK_TYPE_MAP[m.type] || m.type
      }));

      const foodRecords = record.foodRecords || [];

      let totalMilk = 0;
      milkRecords.forEach((m) => { totalMilk += m.amount || 0; });

      const totalFoodGrams = calcFoodGrams(foodRecords);

      let totalSleepMin = 0;
      (record.sleepRecords || []).forEach((s) => { totalSleepMin += s.duration || 0; });

      this.setData({
        milkRecords,
        foodRecords,
        sleepRecords: record.sleepRecords || [],
        diary: record.diary || '',
        totalMilk,
        totalFoodGrams,
        totalSleepText: formatDuration(totalSleepMin)
      });
    } catch (err) {
      console.error('加载记录失败:', err);
    }
  },

  async goMilk() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: `/pages/milk/milk?date=${this.data.recordDate}` });
  },
  async goFood() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: `/pages/food/food?date=${this.data.recordDate}` });
  },
  async goSleep() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: `/pages/sleep/sleep?date=${this.data.recordDate}` });
  },
  async goDiary() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: `/pages/diary/diary?date=${this.data.recordDate}` });
  },
  goFamily() { wx.switchTab({ url: '/pages/family/family' }); }
});
