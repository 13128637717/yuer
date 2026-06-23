const HOUR_COUNT = 24;
const MINUTE_COUNT = 60;
const REPEAT = 5;
const MID = Math.floor(REPEAT / 2);

function buildColumn(count) {
  const column = [];
  for (let r = 0; r < REPEAT; r++) {
    for (let i = 0; i < count; i++) {
      column.push({
        key: `${r}-${i}`,
        text: String(i).padStart(2, '0')
      });
    }
  }
  return column;
}

function parseTimeStr(timeStr) {
  if (!timeStr) return { hour: 0, minute: 0 };
  const parts = String(timeStr).split(':');
  const hour = Math.min(Math.max(parseInt(parts[0], 10) || 0, 0), 23);
  const minute = Math.min(Math.max(parseInt(parts[1], 10) || 0, 0), 59);
  return { hour, minute };
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toPickerValue(hour, minute) {
  return [MID * HOUR_COUNT + hour, MID * MINUTE_COUNT + minute];
}

Component({
  properties: {
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: '选择时间'
    },
    title: {
      type: String,
      value: '选择时间'
    }
  },

  data: {
    visible: false,
    animating: false,
    hours: buildColumn(HOUR_COUNT),
    minutes: buildColumn(MINUTE_COUNT),
    pickerValue: toPickerValue(0, 0),
    activeHourIndex: MID * HOUR_COUNT,
    activeMinuteIndex: MID * MINUTE_COUNT
  },

  observers: {
    value(val) {
      if (this.data.visible) return;
      const { hour, minute } = parseTimeStr(val);
      const pickerValue = toPickerValue(hour, minute);
      this._pendingTime = val || formatTime(hour, minute);
      this.setData({
        pickerValue,
        activeHourIndex: pickerValue[0],
        activeMinuteIndex: pickerValue[1]
      });
    }
  },

  lifetimes: {
    attached() {
      const { hour, minute } = parseTimeStr(this.properties.value);
      const pickerValue = toPickerValue(hour, minute);
      this._pendingTime = this.properties.value || formatTime(hour, minute);
      this.setData({
        pickerValue,
        activeHourIndex: pickerValue[0],
        activeMinuteIndex: pickerValue[1]
      });
    }
  },

  methods: {
    noop() {},

    openPicker() {
      const { hour, minute } = parseTimeStr(this.properties.value);
      const pickerValue = toPickerValue(hour, minute);
      this._pendingTime = this.properties.value || formatTime(hour, minute);
      this._lastPickerValue = pickerValue;
      this.setData({
        visible: true,
        animating: false,
        pickerValue,
        activeHourIndex: pickerValue[0],
        activeMinuteIndex: pickerValue[1]
      });
      wx.nextTick(() => {
        this.setData({ animating: true });
      });
    },

    closePicker() {
      this.setData({ animating: false });
      setTimeout(() => {
        if (!this.data.animating) {
          this.setData({ visible: false });
        }
      }, 280);
    },

    onCancel() {
      const { hour, minute } = parseTimeStr(this.properties.value);
      const pickerValue = toPickerValue(hour, minute);
      this._pendingTime = this.properties.value || formatTime(hour, minute);
      this.setData({
        pickerValue,
        activeHourIndex: pickerValue[0],
        activeMinuteIndex: pickerValue[1]
      });
      this.closePicker();
    },

    onConfirm() {
      const time = this._pendingTime || this.properties.value || '00:00';
      this.closePicker();
      this.triggerEvent('change', { value: time });
    },

    onPickChange(e) {
      const val = e.detail && e.detail.value;
      if (!Array.isArray(val) || val.length < 2) return;
      const [hi, mi] = val;
      this._lastPickerValue = val;
      const hour = hi % HOUR_COUNT;
      const minute = mi % MINUTE_COUNT;
      this._pendingTime = formatTime(hour, minute);
      this.setData({
        activeHourIndex: hi,
        activeMinuteIndex: mi
      });
    },

    onPickEnd() {
      const val = this._lastPickerValue || this.data.pickerValue;
      if (!Array.isArray(val) || val.length < 2) return;
      const [hi, mi] = val;
      const hour = hi % HOUR_COUNT;
      const minute = mi % MINUTE_COUNT;
      const normalized = toPickerValue(hour, minute);
      this._pendingTime = formatTime(hour, minute);
      this._lastPickerValue = normalized;
      if (hi !== normalized[0] || mi !== normalized[1]) {
        this.setData({
          pickerValue: normalized,
          activeHourIndex: normalized[0],
          activeMinuteIndex: normalized[1]
        });
      }
    }
  }
});
