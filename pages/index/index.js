const { callFunction, getFamilyContext, ensureFamily, syncFamilyContext, resolveCloudFileUrls } = require('../../utils/cloud');
const { calcMonthAge, today, daysAgo } = require('../../utils/date');
const { buildDayTimeline, buildYesterdayHint } = require('../../utils/record');

const DEFAULT_AVATAR = '/images/illustrations/baby-avatar.png';

function buildFoodStat(foodGrams, foodMl) {
  const g = foodGrams || 0;
  const ml = foodMl || 0;
  if (g > 0 && ml > 0) {
    return { foodStatValue: String(g + ml), foodStatUnit: 'g&ml' };
  }
  if (ml > 0) {
    return { foodStatValue: String(ml), foodStatUnit: 'ml' };
  }
  return { foodStatValue: String(g), foodStatUnit: 'g' };
}

function buildSleepStat(totalSleepMin) {
  const minutes = totalSleepMin || 0;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    sleepHours: h,
    sleepMinutes: m,
    showSleepHours: h > 0,
    showSleepMinutes: m > 0 || h === 0
  };
}

Page({
  data: {
    babyName: '',
    monthAge: '',
    babyAvatarUrl: DEFAULT_AVATAR,
    totalMilk: 0,
    foodGrams: 0,
    foodMl: 0,
    foodStatValue: '0',
    foodStatUnit: 'g',
    sleepHours: 0,
    sleepMinutes: 0,
    showSleepHours: false,
    showSleepMinutes: true,
    poopCount: 0,
    yesterdayHint: '',
    timeline: [],
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
        babyAvatarUrl: DEFAULT_AVATAR,
        totalMilk: 0,
        foodGrams: 0,
        foodMl: 0,
        foodStatValue: '0',
        foodStatUnit: 'g',
        sleepHours: 0,
        sleepMinutes: 0,
        showSleepHours: false,
        showSleepMinutes: true,
        poopCount: 0,
        yesterdayHint: '',
        timeline: [],
        loading: false
      });
      return;
    }

    let babyAvatarUrl = DEFAULT_AVATAR;
    if (family && family.babyAvatar) {
      const [url] = await resolveCloudFileUrls([family.babyAvatar]);
      if (url) babyAvatarUrl = url;
    }

    this.setData({
      hasFamily: true,
      babyName: (family && family.babyName) || '宝宝',
      monthAge: calcMonthAge(family && family.babyBirth),
      babyAvatarUrl,
      loading: true
    });

    try {
      const res = await callFunction('recordOperate', {
        action: 'getTodaySummary',
        recordDate: today()
      });
      const summary = res.summary || {};
      const record = res.record || {};
      const foodGrams = summary.foodGrams || 0;
      const foodMl = summary.foodMl || 0;
      const totalSleepMin = summary.totalSleepMin || 0;

      let yesterdayHint = '';
      try {
        const yRes = await callFunction('recordOperate', {
          action: 'getTodaySummary',
          recordDate: daysAgo(1)
        });
        yesterdayHint = buildYesterdayHint(yRes.summary, daysAgo(1));
      } catch (err) {
        console.warn(err);
      }

      this.setData({
        totalMilk: summary.totalMilk || 0,
        foodGrams,
        foodMl,
        ...buildFoodStat(foodGrams, foodMl),
        ...buildSleepStat(totalSleepMin),
        poopCount: summary.poopCount || 0,
        yesterdayHint,
        timeline: buildDayTimeline(record),
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

  goRecordsYesterday() {
    wx.switchTab({ url: '/pages/records/records' });
  },

  goFamily() {
    wx.switchTab({ url: '/pages/family/family' });
  }
});
