const { callFunction, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today, nowTime, calcSleepDuration, formatDuration } = require('../../utils/date');

const SLEEP_TIMER_PREFIX = 'sleepTimer_';

Page({
  data: {
    recordDate: '',
    todayDate: '',
    isToday: true,
    sleepRecords: [],
    formStartTime: '',
    formEndTime: '',
    formDurationText: '',
    editingIndex: -1,
    sleepTimerActive: false,
    sleepTimerStart: ''
  },

  async onLoad(options) {
    if (!(await ensureFamily())) return;
    const recordDate = (options && options.date) || today();
    this.setData({
      recordDate,
      todayDate: today(),
      isToday: recordDate === today(),
      formStartTime: '20:00',
      formEndTime: nowTime()
    });
    this.calcDuration();
    this.loadSleepTimer();
    this.loadRecords();
  },

  onShow() {
    this.loadSleepTimer();
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({ recordDate, isToday: recordDate === today(), editingIndex: -1 });
    this.loadSleepTimer();
    this.loadRecords();
  },

  getTimerKey() {
    const { familyId } = getFamilyContext();
    return `${SLEEP_TIMER_PREFIX}${familyId || 'default'}`;
  },

  loadSleepTimer() {
    try {
      const timer = wx.getStorageSync(this.getTimerKey());
      if (timer && timer.startTime && timer.recordDate === this.data.recordDate) {
        this.setData({ sleepTimerActive: true, sleepTimerStart: timer.startTime });
      } else {
        this.setData({ sleepTimerActive: false, sleepTimerStart: '' });
      }
    } catch (err) {
      this.setData({ sleepTimerActive: false, sleepTimerStart: '' });
    }
  },

  startSleepTimer() {
    const startTime = nowTime();
    wx.setStorageSync(this.getTimerKey(), {
      startTime,
      recordDate: this.data.recordDate
    });
    this.setData({ sleepTimerActive: true, sleepTimerStart: startTime });
    wx.showToast({ title: '开始记录睡眠', icon: 'success' });
  },

  cancelSleepTimer() {
    wx.removeStorageSync(this.getTimerKey());
    this.setData({ sleepTimerActive: false, sleepTimerStart: '' });
  },

  async wakeUpFromTimer() {
    const { sleepTimerStart, recordDate } = this.data;
    const endTime = nowTime();
    wx.removeStorageSync(this.getTimerKey());
    this.setData({
      sleepTimerActive: false,
      sleepTimerStart: '',
      formStartTime: sleepTimerStart,
      formEndTime: endTime,
      editingIndex: -1
    });
    this.calcDuration();

    const duration = calcSleepDuration(sleepTimerStart, endTime);
    const item = {
      startTime: sleepTimerStart,
      endTime,
      duration,
      durationText: formatDuration(duration)
    };
    const newList = [...this.data.sleepRecords, item].sort((a, b) => a.startTime.localeCompare(b.startTime));
    this.setData({ sleepRecords: newList });
    await this.persistRecords();
  },

  async loadRecords() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate: this.data.recordDate
      });
      const sleepRecords = (res.record.sleepRecords || []).map((s) => ({
        ...s,
        durationText: formatDuration(s.duration || calcSleepDuration(s.startTime, s.endTime))
      }));
      this.setData({ sleepRecords });
    } catch (err) {
      console.error(err);
    }
  },

  onStartTimeChange(e) {
    this.setData({ formStartTime: e.detail.value });
    this.calcDuration();
  },

  onEndTimeChange(e) {
    this.setData({ formEndTime: e.detail.value });
    this.calcDuration();
  },

  calcDuration() {
    const { formStartTime, formEndTime } = this.data;
    if (formStartTime && formEndTime) {
      const min = calcSleepDuration(formStartTime, formEndTime);
      this.setData({ formDurationText: formatDuration(min) });
    }
  },

  async addOrUpdate() {
    const { formStartTime, formEndTime, sleepRecords, editingIndex } = this.data;
    if (!formStartTime || !formEndTime) {
      wx.showToast({ title: '请选择入睡和起床时间', icon: 'none' });
      return;
    }

    const duration = calcSleepDuration(formStartTime, formEndTime);
    const item = {
      startTime: formStartTime,
      endTime: formEndTime,
      duration,
      durationText: formatDuration(duration)
    };

    let newList = [...sleepRecords];
    if (editingIndex >= 0) {
      newList[editingIndex] = item;
    } else {
      newList.push(item);
    }
    newList.sort((a, b) => a.startTime.localeCompare(b.startTime));

    this.setData({
      sleepRecords: newList,
      formStartTime: '13:00',
      formEndTime: nowTime(),
      editingIndex: -1
    });
    this.calcDuration();
    await this.persistRecords();
  },

  editItem(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.sleepRecords[idx];
    this.setData({
      formStartTime: item.startTime,
      formEndTime: item.endTime,
      editingIndex: idx
    });
    this.calcDuration();
  },

  async deleteItem(e) {
    const idx = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条睡眠记录吗？',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({
          sleepRecords: this.data.sleepRecords.filter((_, i) => i !== idx),
          editingIndex: -1
        });
        await this.persistRecords();
      }
    });
  },

  async persistRecords() {
    wx.showLoading({ title: '保存中...' });
    try {
      await callFunction('recordOperate', {
        action: 'saveSleep',
        recordDate: this.data.recordDate,
        sleepRecords: this.data.sleepRecords.map(({ startTime, endTime, duration, recordedBy }) => ({
          startTime, endTime, duration, recordedBy
        }))
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  }
});
