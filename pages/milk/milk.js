const { callFunction, getFamilyContext, ensureFamily } = require('../../utils/cloud');
const { today, nowTime } = require('../../utils/date');
const { MILK_TYPE_MAP } = require('../../utils/constants');

Page({
  data: {
    recordDate: '',
    todayDate: '',
    isToday: true,
    milkRecords: [],
    // 表单
    formTime: '',
    formAmount: '',
    formType: 'formula',
    formTypeIndex: 1,
    typeOptions: [
      { value: 'breast', label: '母乳' },
      { value: 'formula', label: '配方奶' }
    ],
    editingIndex: -1
  },

  async onLoad(options) {
    if (!(await ensureFamily())) return;
    const recordDate = (options && options.date) || today();
    this.setData({ recordDate, todayDate: today(), isToday: recordDate === today(), formTime: nowTime() });
    this.loadRecords();
  },

  onDateChange(e) {
    const recordDate = e.detail.value;
    this.setData({ recordDate, isToday: recordDate === today(), editingIndex: -1 });
    this.loadRecords();
  },

  async loadRecords() {
    const { familyId } = getFamilyContext();
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

  // 添加或更新
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
      typeText: typeOptions[formTypeIndex].label
    };

    let newList = [...milkRecords];
    if (editingIndex >= 0) {
      newList[editingIndex] = item;
    } else {
      newList.push(item);
    }
    newList.sort((a, b) => a.time.localeCompare(b.time));

    this.setData({
      milkRecords: newList,
      formAmount: '',
      formTime: nowTime(),
      editingIndex: -1
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
    const newList = this.data.milkRecords.filter((_, i) => i !== idx);
    this.setData({ milkRecords: newList, editingIndex: -1 });
    await this.persistRecords();
  },

  async persistRecords() {
    wx.showLoading({ title: '保存中...' });
    try {
      await callFunction('recordOperate', {
        action: 'saveMilk',
        recordDate: this.data.recordDate,
        milkRecords: this.data.milkRecords.map(({ time, amount, type }) => ({ time, amount, type }))
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  }
});
