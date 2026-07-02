const { callFunction, getFamilyContext, ensureFamily, syncFamilyContext, resolveCloudFileUrls } = require('../../utils/cloud');
const { today, formatDuration, daysAgo } = require('../../utils/date');
const { MILK_TYPE_MAP, POOP_STATUS_MAP } = require('../../utils/constants');
const { calcFoodTotals, buildYesterdayHint } = require('../../utils/record');

async function mapPoopRecordsWithUrls(poopRecords) {
  const list = poopRecords || [];
  const fileIds = list.map((item) => item.image).filter(Boolean);
  if (!fileIds.length) {
    return list.map((item) => ({
      ...item,
      statusText: POOP_STATUS_MAP[item.status] || item.status,
      imageUrl: ''
    }));
  }
  const urls = await resolveCloudFileUrls(fileIds);
  const urlMap = {};
  fileIds.forEach((id, i) => { urlMap[id] = urls[i] || ''; });
  return list.map((item) => ({
    ...item,
    statusText: POOP_STATUS_MAP[item.status] || item.status,
    imageUrl: item.image ? (urlMap[item.image] || '') : ''
  }));
}

Page({
  data: {
    hasFamily: false,
    recordDate: '',
    todayDate: '',
    milkRecords: [],
    foodRecords: [],
    sleepRecords: [],
    poopRecords: [],
    diary: '',
    diaryImageUrls: [],
    totalMilk: 0,
    totalFoodGrams: 0,
    totalFoodMl: 0,
    foodTotalText: '0g',
    totalSleepText: '0分钟',
    poopCount: 0,
    lastEditorText: '',
    markedDates: [],
    yesterdayHint: ''
  },

  onShow() {
    this.setData({ recordDate: today(), todayDate: today() });
    this.loadRecord();
  },

  onPullDownRefresh() {
    this.loadRecord().finally(() => wx.stopPullDownRefresh());
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({ recordDate });
    this.loadRecord();
  },

  async loadMarkedDates() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'getRecordDates',
        startDate: daysAgo(29),
        endDate: today()
      });
      this.setData({ markedDates: res.dates || [] });
    } catch (err) {
      console.warn(err);
    }
  },

  jumpToDate(e) {
    const recordDate = e.currentTarget.dataset.date;
    if (!recordDate) return;
    this.setData({ recordDate });
    this.loadRecord();
  },

  shiftDate(e) {
    const delta = parseInt(e.currentTarget.dataset.delta, 10);
    const base = new Date(`${this.data.recordDate}T12:00:00`);
    base.setDate(base.getDate() + delta);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    const recordDate = `${y}-${m}-${d}`;
    if (recordDate > today()) {
      wx.showToast({ title: '不能选择未来日期', icon: 'none' });
      return;
    }
    this.setData({ recordDate });
    this.loadRecord();
  },

  async loadYesterdayHint() {
    if (this.data.recordDate !== today()) {
      this.setData({ yesterdayHint: '' });
      return;
    }
    try {
      const yRes = await callFunction('recordOperate', {
        action: 'getTodaySummary',
        recordDate: daysAgo(1)
      });
      const yesterdayHint = buildYesterdayHint(yRes.summary, daysAgo(1));
      this.setData({ yesterdayHint });
    } catch (err) {
      console.warn(err);
    }
  },

  jumpToYesterday() {
    const yesterday = daysAgo(1);
    this.setData({ recordDate: yesterday });
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
        poopRecords: [],
        diary: '',
        diaryImageUrls: [],
        totalMilk: 0,
        totalFoodGrams: 0,
        totalFoodMl: 0,
        foodTotalText: '0g',
        totalSleepText: '0分钟',
        poopCount: 0,
        lastEditorText: '',
        markedDates: [],
        yesterdayHint: ''
      });
      return;
    }
    this.setData({ hasFamily: true });
    this.loadMarkedDates();
    this.loadYesterdayHint();

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
      const poopRecords = await mapPoopRecordsWithUrls(record.poopRecords || []);
      const sleepRecords = (record.sleepRecords || []).map((s) => ({
        ...s,
        durationText: formatDuration(s.duration || 0)
      }));

      const diaryImages = record.diaryImages || [];
      const diaryImageUrls = diaryImages.length
        ? await resolveCloudFileUrls(diaryImages)
        : [];

      let totalMilk = 0;
      milkRecords.forEach((m) => { totalMilk += m.amount || 0; });

      const { foodGrams, foodMl } = calcFoodTotals(foodRecords);
      const foodParts = [];
      if (foodGrams > 0) foodParts.push(`${foodGrams}g`);
      if (foodMl > 0) foodParts.push(`${foodMl}ml`);
      const foodTotalText = foodParts.length ? foodParts.join('、') : '0g';

      let totalSleepMin = 0;
      sleepRecords.forEach((s) => { totalSleepMin += s.duration || 0; });

      let lastEditorText = '';
      if (record.lastEditorNickName) {
        lastEditorText = `最后更新：${record.lastEditorNickName}`;
      }

      this.setData({
        milkRecords,
        foodRecords,
        sleepRecords,
        poopRecords,
        diary: record.diary || '',
        diaryImageUrls,
        totalMilk,
        totalFoodGrams: foodGrams,
        totalFoodMl: foodMl,
        foodTotalText,
        totalSleepText: formatDuration(totalSleepMin),
        poopCount: poopRecords.length,
        lastEditorText
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
  async goPoop() {
    if (!(await ensureFamily())) return;
    wx.navigateTo({ url: `/pages/poop/poop?date=${this.data.recordDate}` });
  },
  goFamily() { wx.switchTab({ url: '/pages/family/family' }); },

  previewDiaryImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.diaryImageUrls || [];
    if (!urls.length) return;
    wx.previewImage({ current: urls[index], urls });
  },

  previewPoopImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.poopRecords.filter((item) => item.imageUrl).map((item) => item.imageUrl);
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  }
});
