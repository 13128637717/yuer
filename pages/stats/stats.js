import * as echarts from '../../components/ec-canvas/echarts';

const { callFunction, getFamilyContext, syncFamilyContext } = require('../../utils/cloud');
const { daysAgo, today } = require('../../utils/date');
const { STATS_DAYS } = require('../../utils/constants');
const { formatRecordsExport } = require('../../utils/record');
let milkChart = null;
let sleepChart = null;
let foodChart = null;

function initMilkChart(canvas, width, height, dpr) {
  milkChart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(milkChart);
  milkChart.setOption({
    color: ['#FF8F80'],
    animationDuration: 650,
    animationEasing: 'cubicOut',
    grid: { left: '12%', right: '5%', top: '15%', bottom: '15%' },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.96)', textStyle: { color: '#333333' } },
    xAxis: { type: 'category', data: [], axisLabel: { fontSize: 10, color: '#999999' }, axisLine: { lineStyle: { color: '#F0E6DE' } } },
    yAxis: { type: 'value', name: 'ml', axisLabel: { fontSize: 10, color: '#999999' }, splitLine: { lineStyle: { color: '#F7EAE3' } } },
    series: [{ name: '总奶量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: [], areaStyle: { opacity: 0.18 } }]
  });
  return milkChart;
}

function initSleepChart(canvas, width, height, dpr) {
  sleepChart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(sleepChart);
  sleepChart.setOption({
    color: ['#7EC8A3'],
    animationDuration: 650,
    animationEasing: 'cubicOut',
    grid: { left: '12%', right: '5%', top: '15%', bottom: '15%' },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.96)', textStyle: { color: '#333333' } },
    xAxis: { type: 'category', data: [], axisLabel: { fontSize: 10, color: '#999999' }, axisLine: { lineStyle: { color: '#F0E6DE' } } },
    yAxis: { type: 'value', name: '小时', axisLabel: { fontSize: 10, color: '#999999' }, splitLine: { lineStyle: { color: '#E4F6ED' } } },
    series: [{ name: '睡眠时长', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: [], areaStyle: { opacity: 0.18 } }]
  });
  return sleepChart;
}

function initFoodChart(canvas, width, height, dpr) {
  foodChart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
  canvas.setChart(foodChart);
  foodChart.setOption({
    color: ['#FFB347'],
    animationDuration: 650,
    animationEasing: 'cubicOut',
    grid: { left: '12%', right: '5%', top: '15%', bottom: '15%' },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.96)', textStyle: { color: '#333333' } },
    xAxis: { type: 'category', data: [], axisLabel: { fontSize: 10, color: '#999999' }, axisLine: { lineStyle: { color: '#F0E6DE' } } },
    yAxis: { type: 'value', name: 'g', axisLabel: { fontSize: 10, color: '#999999' }, splitLine: { lineStyle: { color: '#FFF0CF' } } },
    series: [{ name: '辅食克数', type: 'bar', data: [], barMaxWidth: 24, itemStyle: { borderRadius: [8, 8, 0, 0] } }]
  });
  return foodChart;
}

Page({
  data: {
    hasFamily: false,
    days: STATS_DAYS.WEEK,
    ecMilk: { onInit: initMilkChart },
    ecSleep: { onInit: initSleepChart },
    ecFood: { onInit: initFoodChart },
    loading: true,
    showExport: false,
    exportRange: 'week',
    exportText: '',
    exportLoading: false
  },
  async onShow() {
    await syncFamilyContext(true);
    if (!getFamilyContext().hasFamily) {
      this.setData({ hasFamily: false, loading: false, showExport: false });
      return;
    }
    this.setData({ hasFamily: true, showExport: false });
    this.loadStats();
  },
  switchDays(e) {
    const days = parseInt(e.currentTarget.dataset.days, 10);
    this.setData({ days });
    this.loadStats();
  },

  async loadStats() {
    const { familyId } = getFamilyContext();
    if (!familyId) return;

    this.setData({ loading: true });
    const endDate = today();
    const startDate = daysAgo(this.data.days - 1);

    try {
      const res = await callFunction('getStats', { familyId, startDate, endDate });
      const stats = res.stats || [];

      const dates = stats.map((s) => s.date.slice(5)); // MM-DD
      const milkData = stats.map((s) => s.totalMilk);
      const sleepData = stats.map((s) => Math.round((s.totalSleepMin / 60) * 10) / 10);
      const foodData = stats.map((s) => s.foodGrams || 0);

      if (milkChart) {
        milkChart.setOption({
          xAxis: { data: dates },
          series: [{ data: milkData }]
        });
      }
      if (sleepChart) {
        sleepChart.setOption({
          xAxis: { data: dates },
          series: [{ data: sleepData }]
        });
      }
      if (foodChart) {
        foodChart.setOption({
          xAxis: { data: dates },
          series: [{ data: foodData }]
        });
      }

      this.setData({ loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  openExport() {
    if (this.data.showExport) return;
    this.setData({ showExport: true });
    this.loadExport(this.data.exportRange);
  },

  switchExportRange(e) {
    const range = e.currentTarget.dataset.range;
    if (range === this.data.exportRange) return;
    this.setData({ exportRange: range });
    this.loadExport(range);
  },

  async loadExport(range) {
    this.setData({ exportLoading: true });
    try {
      const params = { action: 'listRecords' };
      if (range === 'week') {
        params.startDate = daysAgo(STATS_DAYS.WEEK - 1);
        params.endDate = today();
      } else if (range === 'month') {
        params.startDate = daysAgo(STATS_DAYS.MONTH - 1);
        params.endDate = today();
      }

      const res = await callFunction('recordOperate', params);
      const exportText = formatRecordsExport(res.records || []);
      this.setData({ exportText, exportLoading: false });
    } catch (err) {
      console.error(err);
      this.setData({ exportText: '加载失败，请重试', exportLoading: false });
    }
  },

  copyExportText() {
    const { exportText } = this.data;
    if (!exportText || exportText === '暂无记录') {
      wx.showToast({ title: '没有可复制的内容', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: exportText,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  }
});