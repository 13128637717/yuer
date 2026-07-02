Component({
  properties: {
    recordDate: { type: String, value: '' },
    todayDate: { type: String, value: '' },
    limitFuture: { type: Boolean, value: true }
  },

  methods: {
    onDateChange(e) {
      this.triggerEvent('change', { value: e.detail.value });
    }
  }
});
