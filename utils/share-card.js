const { formatDuration } = require('./date');

/**
 * 在 canvas 2d 上绘制日报分享卡片，返回 Promise<tempFilePath>
 */
function renderShareCard(canvas, { babyName, recordDate, summary }) {
  const width = 600;
  const height = 800;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#FFF8F4');
  gradient.addColorStop(1, '#FFE8E0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#FF9A8B';
  ctx.fillRect(0, 0, width, 120);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('宝宝成长日报', 40, 56);
  ctx.font = '22px sans-serif';
  ctx.fillText(`${babyName} · ${recordDate}`, 40, 92);

  const lines = [
    `🍼 奶量　${summary.totalMilk || 0} ml`,
    `🥣 辅食　${formatFoodSummary(summary)}`,
    `😴 睡眠　${formatDuration(summary.totalSleepMin || 0)}`,
    `💩 拉粑粑　${summary.poopCount || 0} 次`
  ];

  let y = 180;
  ctx.fillStyle = '#333333';
  ctx.font = '26px sans-serif';
  lines.forEach((line) => {
    ctx.fillText(line, 48, y);
    y += 56;
  });

  ctx.fillStyle = '#999999';
  ctx.font = '20px sans-serif';
  ctx.fillText('—— 来自宝宝成长助手', 48, height - 48);

  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

function formatFoodSummary(summary) {
  const parts = [];
  if (summary.foodGrams > 0) parts.push(`${summary.foodGrams}g`);
  if (summary.foodMl > 0) parts.push(`${summary.foodMl}ml`);
  return parts.length ? parts.join('、') : '0';
}

module.exports = {
  renderShareCard
};
