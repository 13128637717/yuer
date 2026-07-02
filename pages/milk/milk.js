const { callFunction, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today, nowTime } = require('../../utils/date');
const { MILK_TYPE_MAP } = require('../../utils/constants');
const { getRecentMilkPref, saveRecentMilkPref } = require('../../utils/recent');

Page({
  data: {
    recordDate: '',
    todayDate: '',
    isToday: true,
    milkRecords: [],
    formTime: '',
    formAmount: '',
    formType: 'formula',
    formTypeIndex: 1,
    typeOptions: [
      { value: 'breast', label: '母乳' },
      { value: 'formula', label: '配方奶' }
    ],
    editingIndex: -1,
    recentPref: null
  },

  async onLoad(options) {
    if (!(await ensureFamily())) return;
    const recordDate = (options && options.date) || today();
    const recentPref = getRecentMilkPref();
    const formTypeIndex = recentPref && recentPref.type === 'breast' ? 0 : 1;
    this.setData({
      recordDate,
      todayDate: today(),
      isToday: recordDate === today(),
      formTime: nowTime(),
      recentPref,
      formAmount: recentPref ? String(recentPref.amount) : '',
      formType: recentPref ? recentPref.type : 'formula',
      formTypeIndex: recentPref ? formTypeIndex : 1
    });
    this.loadRecords();
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({ recordDate, isToday: recordDate === today(), editingIndex: -1 });
    this.loadRecords();
  },

  applyRecentPref() {
    const { recentPref } = this.data;
    if (!recentPref) return;
    const formTypeIndex = recentPref.type === 'breast' ? 0 : 1;
    this.setData({
      formAmount: String(recentPref.amount),
      formType: recentPref.type,
      formTypeIndex
    });
    wx.showToast({ title: '已填入上次记录', icon: 'none' });
  },

  async loadRecords() {
    try {
      const res = await callFunction('recordOperate', {
        action: 'get',
        recordDate: this.data.recordDate
      });
      const milkRecords = (res.record.milkRecords || []).map((m) => ({
        ...m,
        typeText: MILK_TYPE_MAP[m.type] || m.type
      }));
      this.setData({ milkRecords });
    } catch (err) {
      console.error(err);
    }
  },

  onTimeChange(e) { this.setData({ formTime: e.detail.value }); },
  onAmountInput(e) { this.setData({ formAmount: e.detail.value }); },
  onTypeChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const type = this.data.typeOptions[idx].value;
    this.setData({ formTypeIndex: idx, formType: type });
  },

  async addOrUpdate() {
    const { formTime, formAmount, formType, milkRecords, editingIndex, typeOptions, formTypeIndex } = this.data;
    if (!formTime || !formAmount) {
      wx.showToast({ title: '请填写时间和奶量', icon: 'none' });
      return;
    }
    const amount = parseInt(formAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效奶量', icon: 'none' });
      return;
    }

    const item = {
      time: formTime,
      amount,
      type: formType,
      typeText: typeOptions[formTypeIndex].label,
      recordedBy: editingIndex >= 0 ? milkRecords[editingIndex].recordedBy : ''
    };

    let newList = [...milkRecords];
    if (editingIndex >= 0) {
      newList[editingIndex] = item;
    } else {
      newList.push(item);
    }
    newList.sort((a, b) => a.time.localeCompare(b.time));

    saveRecentMilkPref({ amount, type: formType });
    this.setData({
      milkRecords: newList,
      formAmount: String(amount),
      formTime: nowTime(),
      editingIndex: -1,
      recentPref: { amount, type: formType }
    });
    await this.persistRecords();
  },

  editItem(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.milkRecords[idx];
    const typeIndex = item.type === 'breast' ? 0 : 1;
    this.setData({
      formTime: item.time,
      formAmount: String(item.amount),
      formType: item.type,
      formTypeIndex: typeIndex,
      editingIndex: idx
    });
  },

  async deleteItem(e) {
    const idx = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条奶量记录吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const newList = this.data.milkRecords.filter((_, i) => i !== idx);
        this.setData({ milkRecords: newList, editingIndex: -1 });
        await this.persistRecords();
      }
    });
  },

  async persistRecords() {
    wx.showLoading({ title: '保存中...' });
    try {
      await callFunction('recordOperate', {
        action: 'saveMilk',
        recordDate: this.data.recordDate,
        milkRecords: this.data.milkRecords.map(({ time, amount, type, recordedBy }) => ({
          time, amount, type, recordedBy
        }))
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.loadRecords();
    } catch (err) {
      wx.hideLoading();
    }
  }
});
