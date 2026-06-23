const { callFunction, uploadImage, resolveCloudFileUrls, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today } = require('../../utils/date');

Page({
  data: {
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
    const recordDate = (options && options.date) || today();
    this.setData({
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

  chooseImage() {
    const remain = 9 - this.data.diaryImages.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        this.setData({ uploading: true });
        const { familyId } = getFamilyContext();
        const newImages = [...this.data.diaryImages];
        const newUrls = [...this.data.diaryImageUrls];

        for (const file of res.tempFiles) {
          const ext = file.tempFilePath.split('.').pop() || 'jpg';
          const cloudPath = `diary/${familyId}/${this.data.recordDate}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          try {
            const fileID = await uploadImage(file.tempFilePath, cloudPath);
            const [url] = await resolveCloudFileUrls([fileID]);
            newImages.push(fileID);
            newUrls.push(url);
          } catch (err) {
            console.error('上传失败:', err);
          }
        }

        this.setData({ diaryImages: newImages, diaryImageUrls: newUrls, uploading: false });
      }
    });
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const newImages = this.data.diaryImages.filter((_, i) => i !== idx);
    const newUrls = this.data.diaryImageUrls.filter((_, i) => i !== idx);
    this.setData({ diaryImages: newImages, diaryImageUrls: newUrls });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.diaryImageUrls
    });
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
