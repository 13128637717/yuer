const { today } = require('../utils/date');

/**
 * 记录子页共用的日期选择逻辑
 */
module.exports = Behavior({
  data: {
    recordDate: '',
    todayDate: '',
    isToday: true
  },

  methods: {
    initRecordDate(options) {
      const recordDate = (options && options.date) || today();
      this.setData({
        recordDate,
        todayDate: today(),
        isToday: recordDate === today()
      });
      return recordDate;
    },

    onDateChange(e) {
      const recordDate = e.detail.value;
      this.setData({
        recordDate,
        isToday: recordDate === today()
      });
      if (typeof this.onRecordDateChanged === 'function') {
        this.onRecordDateChanged(recordDate);
      }
    }
  }
});
