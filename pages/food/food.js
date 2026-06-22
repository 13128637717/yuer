const { callFunction, ensureFamily } = require('../../utils/cloud');

const { today, nowTime } = require('../../utils/date');



Page({

  data: {

    recordDate: '',

    todayDate: '',

    isToday: true,

    foodRecords: [],

    formTime: '',

    formFoodName: '',

    formAmount: '',

    formUnit: 'g',

    formUnitIndex: 0,

    unitOptions: [

      { value: 'g', label: '克(g)' },

      { value: 'ml', label: '毫升(ml)' }

    ],

    editingIndex: -1

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

    this.setData({ recordDate, isToday: recordDate === today(), editingIndex: -1 });

    this.loadRecords();

  },



  async loadRecords() {

    try {

      const res = await callFunction('recordOperate', {

        action: 'get',

        recordDate: this.data.recordDate

      });

      this.setData({ foodRecords: res.record.foodRecords || [] });

    } catch (err) {

      console.error(err);

    }

  },



  onTimeChange(e) { this.setData({ formTime: e.detail.value }); },

  onFoodNameInput(e) { this.setData({ formFoodName: e.detail.value }); },

  onAmountInput(e) { this.setData({ formAmount: e.detail.value }); },

  onUnitChange(e) {

    const idx = parseInt(e.detail.value, 10);

    this.setData({ formUnitIndex: idx, formUnit: this.data.unitOptions[idx].value });

  },



  async addOrUpdate() {

    const { formTime, formFoodName, formAmount, formUnit, foodRecords, editingIndex } = this.data;

    if (!formTime || !formFoodName || !formAmount) {

      wx.showToast({ title: '请填写完整信息', icon: 'none' });

      return;

    }

    const amount = parseFloat(formAmount);

    if (isNaN(amount) || amount <= 0) {

      wx.showToast({ title: '请输入有效数量', icon: 'none' });

      return;

    }



    const item = { time: formTime, foodName: formFoodName, amount, unit: formUnit };

    let newList = [...foodRecords];

    if (editingIndex >= 0) {

      newList[editingIndex] = item;

    } else {

      newList.push(item);

    }

    newList.sort((a, b) => a.time.localeCompare(b.time));



    this.setData({

      foodRecords: newList,

      formFoodName: '',

      formAmount: '',

      formTime: nowTime(),

      editingIndex: -1

    });

    await this.persistRecords();

  },



  editItem(e) {

    const idx = e.currentTarget.dataset.index;

    const item = this.data.foodRecords[idx];

    const unitIndex = item.unit === 'ml' ? 1 : 0;

    this.setData({

      formTime: item.time,

      formFoodName: item.foodName,

      formAmount: String(item.amount),

      formUnit: item.unit,

      formUnitIndex: unitIndex,

      editingIndex: idx

    });

  },



  async deleteItem(e) {

    const idx = e.currentTarget.dataset.index;

    this.setData({

      foodRecords: this.data.foodRecords.filter((_, i) => i !== idx),

      editingIndex: -1

    });

    await this.persistRecords();

  },



  async persistRecords() {

    wx.showLoading({ title: '保存中...' });

    try {

      await callFunction('recordOperate', {

        action: 'saveFood',

        recordDate: this.data.recordDate,

        foodRecords: this.data.foodRecords

      });

      wx.hideLoading();

      wx.showToast({ title: '已保存', icon: 'success' });

    } catch (err) {

      wx.hideLoading();

    }

  }

});


