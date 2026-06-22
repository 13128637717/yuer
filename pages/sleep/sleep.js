const { callFunction, ensureFamily } = require('../../utils/cloud');

const { today, nowTime, calcSleepDuration, formatDuration } = require('../../utils/date');



Page({

  data: {

    recordDate: '',

    todayDate: '',

    isToday: true,

    sleepRecords: [],

    formStartTime: '',

    formEndTime: '',

    formDurationText: '',

    editingIndex: -1

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

    this.loadRecords();

  },



  onDateChange(e) {

    const recordDate = e.detail.value;

    this.setData({ recordDate, isToday: recordDate === today(), editingIndex: -1 });

    this.loadRecords();

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

    this.setData({

      sleepRecords: this.data.sleepRecords.filter((_, i) => i !== idx),

      editingIndex: -1

    });

    await this.persistRecords();

  },



  async persistRecords() {

    wx.showLoading({ title: '保存中...' });

    try {

      await callFunction('recordOperate', {

        action: 'saveSleep',

        recordDate: this.data.recordDate,

        sleepRecords: this.data.sleepRecords.map(({ startTime, endTime, duration }) => ({

          startTime, endTime, duration

        }))

      });

      wx.hideLoading();

      wx.showToast({ title: '已保存', icon: 'success' });

    } catch (err) {

      wx.hideLoading();

    }

  }

});


