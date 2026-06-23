const { callFunction, uploadImage, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today, nowTime } = require('../../utils/date');
const { POOP_STATUS_OPTIONS, POOP_STATUS_MAP } = require('../../utils/constants');

Page({
  data: {
    recordDate: '',
    todayDate: '',
    isToday: true,
    poopRecords: [],
    formTime: '',
    formStatus: 'normal',
    formStatusIndex: 0,
    statusOptions: POOP_STATUS_OPTIONS,
    formImage: '',
    editingIndex: -1,
    uploading: false
  },

  async onLoad(options) {
    if (!(await ensureFamily())) return;
    const recordDate = (options && options.date) || today();
    this.setData({
      recordDate,
      todayDate: today(),
      isToday: recordDate === today(),
      formTime: nowTime()
    });
    this.loadRecords();
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({
      recordDate,
      isToday: recordDate === today(),
      editingIndex: -1,
      formImage: '',
      formTime: nowTime()
    });
    this.loadRecords();
  },

  async loadRecords() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate: this.data.recordDate
      });
      const poopRecords = (res.record.poopRecords || []).map((item) => ({
        ...item,
        statusText: POOP_STATUS_MAP[item.status] || item.status
      }));
      this.setData({ poopRecords });
    } catch (err) {
      console.error(err);
    }
  },

  onTimeChange(e) { this.setData({ formTime: e.detail.value }); },

  onStatusChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const status = this.data.statusOptions[idx].value;
    this.setData({ formStatusIndex: idx, formStatus: status });
  },

  chooseImage() {
    if (this.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        this.setData({ uploading: true });
        const { familyId } = getFamilyContext();
        const ext = file.tempFilePath.split('.').pop() || 'jpg';
        const cloudPath = `poop/${familyId}/${this.data.recordDate}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        try {
          const fileID = await uploadImage(file.tempFilePath, cloudPath);
          this.setData({ formImage: fileID, uploading: false });
        } catch (err) {
          console.error('上传失败:', err);
          this.setData({ uploading: false });
        }
      }
    });
  },

  removeFormImage() {
    this.setData({ formImage: '' });
  },

  previewFormImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ current: url, urls: [url] });
  },

  previewItemImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.poopRecords.filter((item) => item.image).map((item) => item.image);
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },

  resetForm() {
    this.setData({
      formTime: nowTime(),
      formStatus: 'normal',
      formStatusIndex: 0,
      formImage: '',
      editingIndex: -1
    });
  },

  async addOrUpdate() {
    const {
      formTime, formStatus, formImage, poopRecords, editingIndex, statusOptions, formStatusIndex
    } = this.data;
    if (!formTime) {
      wx.showToast({ title: '请填写时间', icon: 'none' });
      return;
    }
    if (this.data.uploading) {
      wx.showToast({ title: '图片上传中，请稍候', icon: 'none' });
      return;
    }

    const item = {
      time: formTime,
      status: formStatus,
      statusText: statusOptions[formStatusIndex].label,
      image: formImage || ''
    };

    let newList = [...poopRecords];
    if (editingIndex >= 0) {
      newList[editingIndex] = item;
    } else {
      newList.push(item);
    }
    newList.sort((a, b) => a.time.localeCompare(b.time));

    this.setData({ poopRecords: newList });
    await this.persistRecords();
    this.resetForm();
  },

  editItem(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.poopRecords[idx];
    const statusIndex = this.data.statusOptions.findIndex((opt) => opt.value === item.status);
    this.setData({
      formTime: item.time,
      formStatus: item.status,
      formStatusIndex: statusIndex >= 0 ? statusIndex : 0,
      formImage: item.image || '',
      editingIndex: idx
    });
  },

  async deleteItem(e) {
    const idx = e.currentTarget.dataset.index;
    const newList = this.data.poopRecords.filter((_, i) => i !== idx);
    this.setData({ poopRecords: newList, editingIndex: -1 });
    await this.persistRecords();
  },

  async persistRecords() {
    wx.showLoading({ title: '保存中...' });
    try {
      await callFunction('recordOperate', {
        action: 'savePoop',
        recordDate: this.data.recordDate,
        poopRecords: this.data.poopRecords.map(({ time, status, image }) => ({
          time,
          status,
          image: image || ''
        }))
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  }
});
