const { callFunction, getFamilyContext, ensureFamily, syncFamilyContext, resolveCloudFileUrls } = require('../../utils/cloud');
const { calcMonthAge, today, daysAgo, nowTime, calcSleepDuration, formatDuration } = require('../../utils/date');
const { buildDayTimeline, buildYesterdayHint, sortSleepRecords } = require('../../utils/record');

const SLEEP_TIMER_PREFIX = 'sleepTimer_';

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

function getSleepTimerKey(familyId) {
  return `${SLEEP_TIMER_PREFIX}${familyId || 'default'}`;
}

function readActiveSleepTimer(familyId) {
  if (!familyId) return null;
  try {
    const timer = wx.getStorageSync(getSleepTimerKey(familyId));
    if (timer && timer.startTime && timer.recordDate === today()) {
      return timer;
    }
  } catch (err) {
    console.warn(err);
  }
  return null;
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
    loading: true,
    sleepTimerActive: false,
    sleepTimerStart: '',
    sleepTimerElapsed: ''
  },

  onShow() {
    this.loadData();
  },

  onHide() {
    this.clearSleepBannerTimer();
  },

  onUnload() {
    this.clearSleepBannerTimer();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    await syncFamilyContext(true);
    this.loadSleepBanner();
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
        loading: false,
        sleepTimerActive: false,
        sleepTimerStart: '',
        sleepTimerElapsed: ''
      });
      this.clearSleepBannerTimer();
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

  loadSleepBanner() {
    const { familyId, hasFamily } = getFamilyContext();
    if (!hasFamily || !familyId) {
      this.setData({ sleepTimerActive: false, sleepTimerStart: '', sleepTimerElapsed: '' });
      this.clearSleepBannerTimer();
      return;
    }

    const timer = readActiveSleepTimer(familyId);
    if (timer) {
      this.setData({
        sleepTimerActive: true,
        sleepTimerStart: timer.startTime,
        sleepTimerElapsed: this.calcSleepElapsed(timer.startTime)
      });
      this.startSleepBannerTimer();
      return;
    }

    this.setData({ sleepTimerActive: false, sleepTimerStart: '', sleepTimerElapsed: '' });
    this.clearSleepBannerTimer();
  },

  calcSleepElapsed(startTime) {
    return formatDuration(calcSleepDuration(startTime, nowTime()));
  },

  startSleepBannerTimer() {
    this.clearSleepBannerTimer();
    this._sleepBannerTimer = setInterval(() => {
      if (this.data.sleepTimerActive && this.data.sleepTimerStart) {
        this.setData({ sleepTimerElapsed: this.calcSleepElapsed(this.data.sleepTimerStart) });
      }
    }, 30000);
  },

  clearSleepBannerTimer() {
    if (this._sleepBannerTimer) {
      clearInterval(this._sleepBannerTimer);
      this._sleepBannerTimer = null;
    }
  },

  endSleepFromBanner() {
    if (this._endingSleep) return;

    const { familyId } = getFamilyContext();
    const timer = readActiveSleepTimer(familyId);
    if (!timer) {
      this.setData({ sleepTimerActive: false, sleepTimerStart: '', sleepTimerElapsed: '' });
      this.clearSleepBannerTimer();
      wx.showToast({ title: '未找到进行中的计时', icon: 'none' });
      return;
    }

    const startTime = timer.startTime;
    const elapsed = this.calcSleepElapsed(startTime);
    if (!this.data.sleepTimerStart) {
      this.setData({
        sleepTimerActive: true,
        sleepTimerStart: startTime,
        sleepTimerElapsed: elapsed
      });
    }

    wx.showModal({
      title: '结束睡眠',
      content: `宝宝已睡 ${elapsed}，确认保存并结束计时？`,
      confirmText: '保存',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) this.saveSleepFromBanner(startTime);
      }
    });
  },

  async saveSleepFromBanner(startTime) {
    if (!(await ensureFamily())) return;
    if (this._endingSleep) return;

    const { familyId } = getFamilyContext();
    const timer = readActiveSleepTimer(familyId);
    const sleepStartTime = startTime || (timer && timer.startTime) || this.data.sleepTimerStart;
    if (!sleepStartTime) {
      wx.showToast({ title: '计时数据异常，请前往睡眠页操作', icon: 'none' });
      return;
    }

    this._endingSleep = true;
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const recordDate = today();
      const endTime = nowTime();
      const duration = calcSleepDuration(sleepStartTime, endTime);

      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate
      });
      const sleepRecords = sortSleepRecords([
        ...((res.record && res.record.sleepRecords) || []),
        { startTime: sleepStartTime, endTime, duration }
      ]);

      await callFunction('recordOperate', {
        action: 'saveSleep',
        recordDate,
        sleepRecords: sleepRecords.map(({ startTime: s, endTime: e, duration: d, recordedBy }) => ({
          startTime: s,
          endTime: e,
          duration: d,
          recordedBy
        }))
      });

      wx.removeStorageSync(getSleepTimerKey(familyId));
      this.clearSleepBannerTimer();
      this.setData({
        sleepTimerActive: false,
        sleepTimerStart: '',
        sleepTimerElapsed: ''
      });

      const summaryRes = await callFunction('recordOperate', {
        action: 'getTodaySummary',
        recordDate
      });
      const summary = summaryRes.summary || {};
      const record = summaryRes.record || {};

      this.setData({
        ...buildSleepStat(summary.totalSleepMin || 0),
        timeline: buildDayTimeline(record)
      });

      wx.hideLoading();
      setTimeout(() => {
        wx.showToast({
          title: `已保存 ${formatDuration(duration)}`,
          icon: 'success',
          duration: 2000
        });
      }, 100);
    } catch (err) {
      wx.hideLoading();
      setTimeout(() => {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }, 100);
      console.error(err);
    } finally {
      this._endingSleep = false;
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
