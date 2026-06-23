const { callFunction, getFamilyContext, ensureFamily, syncFamilyContext } = require('../../utils/cloud');
const { calcMonthAge, today, formatDuration } = require('../../utils/date');

Page({
  data: {
    babyName: '',
    monthAge: '',
    totalMilk: 0,
    foodGrams: 0,    sleepText: '0分钟',
    hasFamily: false,
    loading: true
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    await syncFamilyContext(true);
    const { family, hasFamily } = getFamilyContext();
    if (!hasFamily) {
      this.setData({
        hasFamily: false,
        babyName: '',
        monthAge: '',
        totalMilk: 0,
        foodGrams: 0,        sleepText: '0分钟',
        loading: false
      });
      return;
    }

    this.setData({
      hasFamily: true,
      babyName: (family && family.babyName) || '宝宝',
      monthAge: calcMonthAge(family && family.babyBirth),
      loading: true
    });

    try {
      const res = await callFunction('recordOperate', {
        action: 'getTodaySummary',
        recordDate: today()
      });
      const summary = res.summary || {};
      this.setData({
        totalMilk: summary.totalMilk || 0,
        foodGrams: summary.foodGrams || 0,        sleepText: formatDuration(summary.totalSleepMin || 0),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  async goMilk() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: '/pages/milk/milk' });
  },

  async goFood() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: '/pages/food/food' });
  },

  async goSleep() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: '/pages/sleep/sleep' });
  },

  async goDiary() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: '/pages/diary/diary' });
  },

  async goPoop() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: '/pages/poop/poop' });
  },

  goFamily() {
    wx.switchTab({ url: '/pages/family/family' });
  }
});
