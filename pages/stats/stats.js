import * as echarts from '../../components/ec-canvas/echarts';

const { callFunction, getFamilyContext, syncFamilyContext } = require('../../utils/cloud');
const { daysAgo, today } = require('../../utils/date');
const { STATS_DAYS } = require('../../utils/constants');
const { formatRecordsExport } = require('../../utils/record');
const { renderShareCard } = require('../../utils/share-card');

const CHART_COLORS = {
  milk: ['#FF8F80', '#FFB8AD', '#7EC8A3'],
  sleep: ['#7EC8A3'],
  food: ['#FFB347', '#7EC8A3'],
  poop: ['#C4A882']
};

let milkChart = null;
let sleepChart = null;
let foodChart = null;
let poopChart = null;

function createChartInitializer(chartRef, option) {
  return function initChart(canvas, width, height, dpr) {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
    canvas.setChart(chart);
    chart.setOption({
      animationDuration: 650,
      animationEasing: 'cubicOut',
      grid: { left: '12%', right: '5%', top: '15%', bottom: '18%', containLabel: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        textStyle: { color: '#333333' }
      },
      ...option
    });
    if (chartRef === 'milk') milkChart = chart;
    if (chartRef === 'sleep') sleepChart = chart;
    if (chartRef === 'food') foodChart = chart;
    if (chartRef === 'poop') poopChart = chart;
    return chart;
  };
}

function initMilkChart(canvas, width, height, dpr) {
  return createChartInitializer('milk', {
    color: CHART_COLORS.milk,
    legend: { data: ['总奶量', '母乳', '配方奶'], top: 0, left: 'center', itemGap: 16, itemWidth: 10, itemHeight: 6, textStyle: { fontSize: 10 } },
    grid: { left: '12%', right: '5%', top: '22%', bottom: '12%' },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { fontSize: 10, color: '#999999', margin: 10 },
      axisLine: { lineStyle: { color: '#F0E6DE' } }
    },
    yAxis: {
      type: 'value',
      name: 'ml',
      axisLabel: { fontSize: 10, color: '#999999' },
      splitLine: { lineStyle: { color: '#F7EAE3' } }
    },
    series: [
      { name: '总奶量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: [], areaStyle: { opacity: 0.12 } },
      { name: '母乳', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: [] },
      { name: '配方奶', type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, data: [] }
    ]
  })(canvas, width, height, dpr);
}

function initSleepChart(canvas, width, height, dpr) {
  return createChartInitializer('sleep', {
    color: CHART_COLORS.sleep,
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { fontSize: 10, color: '#999999', margin: 10 },
      axisLine: { lineStyle: { color: '#F0E6DE' } }
    },
    yAxis: {
      type: 'value',
      name: '小时',
      axisLabel: { fontSize: 10, color: '#999999' },
      splitLine: { lineStyle: { color: '#E4F6ED' } }
    },
    series: [{ name: '睡眠时长', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: [], areaStyle: { opacity: 0.18 } }]
  })(canvas, width, height, dpr);
}

function initFoodChart(canvas, width, height, dpr) {
  return createChartInitializer('food', {
    color: CHART_COLORS.food,
    legend: { data: ['辅食(g)', '辅食(ml)'], top: 0, left: 'center', itemGap: 16, itemWidth: 10, itemHeight: 6, textStyle: { fontSize: 10 } },
    grid: { left: '12%', right: '8%', top: '22%', bottom: '12%' },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { fontSize: 10, color: '#999999', margin: 10 },
      axisLine: { lineStyle: { color: '#F0E6DE' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'g',
        axisLabel: { fontSize: 10, color: '#999999' },
        splitLine: { lineStyle: { color: '#FFF0CF' } }
      },
      {
        type: 'value',
        name: 'ml',
        axisLabel: { fontSize: 10, color: '#999999' },
        splitLine: { show: false }
      }
    ],
    series: [
      { name: '辅食(g)', type: 'bar', yAxisIndex: 0, data: [], barMaxWidth: 20, itemStyle: { borderRadius: [8, 8, 0, 0] } },
      { name: '辅食(ml)', type: 'bar', yAxisIndex: 1, data: [], barMaxWidth: 20, itemStyle: { borderRadius: [8, 8, 0, 0] } }
    ]
  })(canvas, width, height, dpr);
}

function initPoopChart(canvas, width, height, dpr) {
  return createChartInitializer('poop', {
    color: CHART_COLORS.poop,
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { fontSize: 10, color: '#999999', margin: 10 },
      axisLine: { lineStyle: { color: '#F0E6DE' } }
    },
    yAxis: {
      type: 'value',
      name: '次',
      minInterval: 1,
      axisLabel: { fontSize: 10, color: '#999999' },
      splitLine: { lineStyle: { color: '#F5EDE3' } }
    },
    series: [{ name: '拉粑粑次数', type: 'bar', data: [], barMaxWidth: 24, itemStyle: { borderRadius: [8, 8, 0, 0] } }]
  })(canvas, width, height, dpr);
}

function calcAvg(stats, field) {
  if (!stats.length) return 0;
  const sum = stats.reduce((s, item) => s + (item[field] || 0), 0);
  return Math.round(sum / stats.length);
}

function formatChangePercent(current, previous) {
  if (!previous && !current) return '持平';
  if (!previous) return '新增';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '持平';
}

Page({
  data: {
    hasFamily: false,
    days: STATS_DAYS.WEEK,
    ecMilk: { onInit: initMilkChart },
    ecSleep: { onInit: initSleepChart },
    ecFood: { onInit: initFoodChart },
    ecPoop: { onInit: initPoopChart },
    loading: true,
    weekSummary: '',
    showExport: false,
    exportRange: 'week',
    exportText: '',
    exportLoading: false,
    exportProgress: '',
    shareLoading: false
  },

  async onShow() {
    await syncFamilyContext(true);
    if (!getFamilyContext().hasFamily) {
      this.setData({ hasFamily: false, loading: false, showExport: false, weekSummary: '' });
      return;
    }
    this.setData({ hasFamily: true, showExport: false });
    this.loadStats();
    this.loadWeekSummary();
  },

  switchDays(e) {
    const days = parseInt(e.currentTarget.dataset.days, 10);
    this.setData({ days });
    this.loadStats();
  },

  async loadWeekSummary() {
    const { familyId } = getFamilyContext();
    if (!familyId) return;
    try {
      const endDate = today();
      const thisStart = daysAgo(6);
      const lastEnd = daysAgo(7);
      const lastStart = daysAgo(13);
      const [thisRes, lastRes] = await Promise.all([
        callFunction('getStats', { familyId, startDate: thisStart, endDate }),
        callFunction('getStats', { familyId, startDate: lastStart, endDate: lastEnd })
      ]);
      const thisStats = thisRes.stats || [];
      const lastStats = lastRes.stats || [];
      const avgMilk = calcAvg(thisStats, 'totalMilk');
      const prevMilk = calcAvg(lastStats, 'totalMilk');
      const avgSleepH = Math.round((calcAvg(thisStats, 'totalSleepMin') / 60) * 10) / 10;
      const change = formatChangePercent(avgMilk, prevMilk);
      this.setData({
        weekSummary: `近7天日均奶量 ${avgMilk} ml（较上周 ${change}），日均睡眠 ${avgSleepH} 小时`
      });
    } catch (err) {
      console.error(err);
    }
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

      const dates = stats.map((s) => s.date.slice(5));
      const milkData = stats.map((s) => s.totalMilk);
      const breastData = stats.map((s) => s.breastMilk || 0);
      const formulaData = stats.map((s) => s.formulaMilk || 0);
      const sleepData = stats.map((s) => Math.round((s.totalSleepMin / 60) * 10) / 10);
      const foodGramsData = stats.map((s) => s.foodGrams || 0);
      const foodMlData = stats.map((s) => s.foodMl || 0);
      const poopData = stats.map((s) => s.poopCount || 0);

      if (milkChart) {
        milkChart.setOption({
          xAxis: { data: dates },
          series: [
            { data: milkData },
            { data: breastData },
            { data: formulaData }
          ]
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
          series: [{ data: foodGramsData }, { data: foodMlData }]
        });
      }
      if (poopChart) {
        poopChart.setOption({
          xAxis: { data: dates },
          series: [{ data: poopData }]
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
    this.setData({ exportLoading: true, exportProgress: '正在加载记录...' });
    try {
      let records = [];
      if (range === 'week') {
        const res = await callFunction('recordOperate', {
          action: 'listRecords',
          startDate: daysAgo(STATS_DAYS.WEEK - 1),
          endDate: today()
        });
        records = res.records || [];
      } else if (range === 'month') {
        const res = await callFunction('recordOperate', {
          action: 'listRecords',
          startDate: daysAgo(STATS_DAYS.MONTH - 1),
          endDate: today()
        });
        records = res.records || [];
      } else {
        records = await this.loadAllRecordsPaged();
      }
      const exportText = formatRecordsExport(records);
      this.setData({ exportText, exportLoading: false, exportProgress: '' });
    } catch (err) {
      console.error(err);
      this.setData({ exportText: '加载失败，请重试', exportLoading: false, exportProgress: '' });
    }
  },

  async loadAllRecordsPaged() {
    let page = 0;
    let all = [];
    while (true) {
      this.setData({ exportProgress: `已加载 ${all.length} 天记录...` });
      const res = await callFunction('recordOperate', {
        action: 'listRecordsPage',
        page,
        pageSize: 100
      });
      all = all.concat(res.records || []);
      if (!res.hasMore) break;
      page += 1;
    }
    return all;
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
  },

  async shareDailyCard() {
    if (this.data.shareLoading) return;
    this.setData({ shareLoading: true });
    wx.showLoading({ title: '生成分享图...' });
    try {
      const res = await callFunction('recordOperate', {
        action: 'getTodaySummary',
        recordDate: today()
      });
      const { family } = getFamilyContext();
      const query = wx.createSelectorQuery();
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec(async (qres) => {
          try {
            const canvas = qres[0].node;
            const path = await renderShareCard(canvas, {
              babyName: (family && family.babyName) || '宝宝',
              recordDate: today(),
              summary: res.summary || {}
            });
            wx.hideLoading();
            this.setData({ shareLoading: false });
            if (wx.showShareImageMenu) {
              wx.showShareImageMenu({ path });
            } else {
              wx.saveImageToPhotosAlbum({
                filePath: path,
                success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
                fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
              });
            }
          } catch (err) {
            wx.hideLoading();
            this.setData({ shareLoading: false });
            wx.showToast({ title: '生成失败', icon: 'none' });
          }
        });
    } catch (err) {
      wx.hideLoading();
      this.setData({ shareLoading: false });
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    }
  }
});
