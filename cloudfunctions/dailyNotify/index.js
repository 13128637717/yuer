// 云函数：dailyNotify - 按家庭配置的 notifyTime 定时推送前一天成长日报
// 触发器：每小时整点执行（config.json: "0 0 * * * * *"），部署后需右键 config.json 上传触发器
const cloud = require('wx-server-sdk');
const got = require('got');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function getBeijingDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const y = beijing.getFullYear();
  const m = String(beijing.getMonth() + 1).padStart(2, '0');
  const day = String(beijing.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getBeijingTimeStr() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const h = String(beijing.getHours()).padStart(2, '0');
  const m = String(beijing.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizeTimeStr(timeStr) {
  if (!timeStr) return '08:00';
  const parts = String(timeStr).split(':');
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
  const m = String(parseInt(parts[1] || '0', 10) || 0).padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(timeStr) {
  const normalized = normalizeTimeStr(timeStr);
  const [h, m] = normalized.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

function isDueThisHour(scheduledTime, currentTime) {
  const scheduledMinutes = timeToMinutes(scheduledTime);
  const currentMinutes = timeToMinutes(currentTime);
  // 每小时整点检查：推送时间落在过去 1 小时内则触发
  return scheduledMinutes >= currentMinutes - 60 && scheduledMinutes <= currentMinutes;
}

function getYesterday(todayStr) {
  const base = todayStr ? new Date(`${todayStr}T12:00:00+08:00`) : new Date(getBeijingDate() + 'T12:00:00+08:00');
  base.setDate(base.getDate() - 1);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isNotifyEnabled(value) {
  return value === true || value === 1 || value === 'true' || value === '1';
}

function hasWebhook(value) {
  return !!(value && String(value).trim());
}

async function sendWebhook(webhookUrl, content) {
  const response = await got.post(String(webhookUrl).trim(), {
    json: {
      msgtype: 'markdown',
      markdown: { content }
    },
    responseType: 'json',
    timeout: 10000
  });
  if (response.body.errcode !== 0) {
    throw new Error(`Webhook 返回错误: ${response.body.errmsg}`);
  }
  return response.body;
}

function aggregateRecord(record) {
  let totalMilk = 0;
  let breastMilk = 0;
  let formulaMilk = 0;
  let totalSleepMin = 0;
  let foodGrams = 0;

  if (record) {
    (record.milkRecords || []).forEach((m) => {
      totalMilk += m.amount || 0;
      if (m.type === 'breast') breastMilk += m.amount || 0;
      else formulaMilk += m.amount || 0;
    });
    (record.foodRecords || []).forEach((f) => {
      foodGrams += f.amount || 0;
    });
    (record.sleepRecords || []).forEach((s) => {
      totalSleepMin += s.duration || 0;
    });
  }

  return { totalMilk, breastMilk, formulaMilk, totalSleepMin, foodGrams };
}

function formatSleepText(totalSleepMin) {
  if (!totalSleepMin || totalSleepMin <= 0) return '暂无记录';
  const sleepH = Math.floor(totalSleepMin / 60);
  const sleepM = totalSleepMin % 60;
  if (sleepH === 0) return `${sleepM} 分钟`;
  if (sleepM === 0) return `${sleepH} 小时`;
  return `${sleepH} 小时 ${sleepM} 分钟`;
}

function buildReportContent({ yesterday, babyName, totalMilk, breastMilk, formulaMilk, totalSleepMin, foodGrams }) {
  const header = [
    '🌱 **宝宝成长日报**',
    `> 📅 ${yesterday}　👶 ${babyName}`,
    ''
  ];

  if (!totalMilk && !foodGrams && !totalSleepMin) {
    return [
      ...header,
      '📝 昨日暂无喂养记录',
      '记得今天及时记录，每一刻都值得珍藏 ✨'
    ].join('\n');
  }

  const sections = [...header];

  if (totalMilk > 0) {
    sections.push(
      `🍼 **奶量总计　${totalMilk} ml**`,
      `> 💗 母乳　${breastMilk} ml`,
      `> 🥛 配方奶　${formulaMilk} ml`,
      ''
    );
  } else {
    sections.push('🍼 奶量　暂无记录', '');
  }

  if (foodGrams > 0) {
    sections.push(`🥣 辅食　${foodGrams} g`, '');
  }

  sections.push(`😴 睡眠　${formatSleepText(totalSleepMin)}`, '');
  sections.push('💪 宝宝每天都在长大，继续加油！');

  return sections.join('\n');
}

async function pushDailyReport(setting, yesterday, today) {
  const { familyId, robotWebhook, notifyTime, _id } = setting;
  const scheduledTime = normalizeTimeStr(notifyTime);

  const familyRes = await db.collection('families')
    .where({ familyId })
    .limit(1)
    .get();
  const family = familyRes.data[0];
  const babyName = family ? family.babyName : '宝宝';

  const recordRes = await db.collection('records')
    .where({ familyId, recordDate: yesterday })
    .limit(1)
    .get();
  const record = recordRes.data[0];
  const stats = aggregateRecord(record);
  const content = buildReportContent({
    yesterday,
    babyName,
    ...stats
  });

  await sendWebhook(robotWebhook, content);

  await db.collection('settings').doc(_id).update({
    data: {
      lastNotifySentOn: today,
      lastNotifyDate: yesterday,
      updateTime: db.serverDate()
    }
  });

  return { familyId, status: 'success', scheduledTime };
}

exports.main = async (event, context) => {
  event = event || {};
  const today = getBeijingDate();
  const yesterday = getYesterday(today);
  const currentTime = getBeijingTimeStr();
  const forceRun = !!event.force;
  const targetFamilyId = event.familyId ? String(event.familyId).trim().toUpperCase() : '';

  console.log(`[dailyNotify] 执行，北京时间 ${today} ${currentTime}，统计日期: ${yesterday}，force=${forceRun}`);

  try {
    const settingsRes = await db.collection('settings').limit(100).get();
    const settingsList = settingsRes.data.filter((setting) => {
      if (!isNotifyEnabled(setting.notifyEnabled)) return false;
      if (!hasWebhook(setting.robotWebhook)) return false;
      if (targetFamilyId && setting.familyId !== targetFamilyId) return false;
      return true;
    });

    console.log(`[dailyNotify] 符合条件家庭数: ${settingsList.length}`);

    const results = [];

    for (const setting of settingsList) {
      const { familyId, lastNotifySentOn, notifyTime } = setting;
      const scheduledTime = normalizeTimeStr(notifyTime);

      if (!forceRun) {
        if (!isDueThisHour(scheduledTime, currentTime)) {
          results.push({
            familyId,
            status: 'skipped',
            reason: 'not_scheduled_time',
            scheduledTime,
            currentTime
          });
          continue;
        }

        if (lastNotifySentOn === today) {
          console.log(`[dailyNotify] 家庭 ${familyId} 今日已推送，跳过`);
          results.push({ familyId, status: 'skipped', reason: 'already_sent_today' });
          continue;
        }
      }

      try {
        const result = await pushDailyReport(setting, yesterday, today);
        console.log(`[dailyNotify] 家庭 ${familyId} 推送成功（${scheduledTime}）`);
        results.push(result);
      } catch (err) {
        console.error(`[dailyNotify] 家庭 ${familyId} 推送失败:`, err);
        results.push({ familyId, status: 'failed', error: err.message });
      }
    }

    return {
      success: true,
      today,
      yesterday,
      currentTime,
      matchedFamilies: settingsList.length,
      results
    };
  } catch (err) {
    console.error('[dailyNotify] 执行失败:', err);
    return { success: false, message: err.message };
  }
};
