const { callFunction, resolveCloudFileUrls, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today } = require('../../utils/date');

Page({
  data: {
    familyId: '',
    recordDate: '',
    todayDate: '',
    isToday: true,
    diary: '',
    diaryImages: [],
    diaryImageUrls: [],
    historyList: [],
    uploading: false
  },

  async onLoad(options) {
    if (!(await ensureFamily())) return;
    const { familyId } = getFamilyContext();
    const recordDate = (options && options.date) || today();
    this.setData({
      familyId,
      recordDate,
      todayDate: today(),
      isToday: recordDate === today()
    });
    this.loadDiary();
    this.loadHistory();
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({ recordDate, isToday: recordDate === today() });
    this.loadDiary();
    this.loadHistory();
  },

  async loadDiary() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate: this.data.recordDate
      });
      const record = res.record || {};
      const diaryImages = record.diaryImages || [];
      const diaryImageUrls = await resolveCloudFileUrls(diaryImages);
      this.setData({
        diary: record.diary || '',
        diaryImages,
        diaryImageUrls
      });
    } catch (err) {
      console.error(err);
    }
  },

  async loadHistory() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'getDiaryList',
        limit: 20
      });
      const rawList = (res.list || []).filter((item) => item.recordDate !== this.data.recordDate);
      const list = await Promise.all(rawList.map(async (item) => ({
        ...item,
        diaryImageUrls: await resolveCloudFileUrls(item.diaryImages || [])
      })));
      this.setData({ historyList: list });
    } catch (err) {
      console.error(err);
    }
  },

  onDiaryInput(e) {
    this.setData({ diary: e.detail.value });
  },

  onImageUploaderChange(e) {
    const { fileIds, imageUrls } = e.detail;
    this.setData({ diaryImages: fileIds, diaryImageUrls: imageUrls });
  },

  onImageUploading(e) {
    this.setData({ uploading: e.detail.uploading });
  },

  previewHistoryImage(e) {
    const { url, historyIndex } = e.currentTarget.dataset;
    const item = this.data.historyList[historyIndex];
    wx.previewImage({
      current: url,
      urls: (item && item.diaryImageUrls) || [url]
    });
  },

  async save() {
    const { diary, diaryImages, recordDate } = this.data;
    if (!diary.trim() && diaryImages.length === 0) {
      wx.showToast({ title: '请输入心得或上传图片', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中...' });
    try {
      await callFunction('recordOperate', {
        action: 'saveDiary',
        recordDate,
        diary: diary.trim(),
        diaryImages
      });
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.loadHistory();
    } catch (err) {
      wx.hideLoading();
    }
  }
});
