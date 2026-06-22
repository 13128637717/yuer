// 云函数调用封装

/**
 * 调用云函数并统一处理返回
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        const result = res.result || {};
        if (result.success === false) {
          wx.showToast({ title: result.message || '操作失败', icon: 'none' });
          reject(result);
        } else {
          resolve(result);
        }
      },
      fail: (err) => {
        console.error(`云函数 ${name} 调用失败:`, err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        reject(err);
      }
    });
  });
}

/**
 * 上传图片到云存储
 */
function uploadImage(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: (err) => {
        console.error('上传失败:', err);
        wx.showToast({ title: '图片上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

function hasCachedFamily(app) {
  return !!(app.globalData.hasFamily && (
    app.globalData.family ||
    (app.globalData.userInfo && app.globalData.userInfo.familyId)
  ));
}

/**
 * 写入全局家庭状态
 */
function applyFamilyContext({ hasFamily, family, settings, user }) {
  const app = getApp();
  const resolvedHasFamily = hasFamily === false
    ? false
    : !!(hasFamily || family || (user && user.familyId));
  app.globalData.hasFamily = resolvedHasFamily;
  if (resolvedHasFamily) {
    if (family) app.globalData.family = family;
    if (settings) app.globalData.settings = settings;
    if (user) app.globalData.userInfo = user;
  } else {
    app.globalData.family = null;
    app.globalData.settings = null;
    if (user) app.globalData.userInfo = user;
  }
}

/**
 * 从服务端同步家庭状态，避免切换页面后状态丢失
 */
async function syncFamilyContext(force = false) {
  const app = getApp();
  try {
    const res = await callFunction('familyOperate', { action: 'get' });
    if (res.hasFamily) {
      applyFamilyContext(res);
      return true;
    }
    applyFamilyContext({
      hasFamily: false,
      family: null,
      settings: null,
      user: res.user
    });
    return false;
  } catch (err) {
    if (!force && hasCachedFamily(app)) {
      return true;
    }
    return false;
  }
}

/**
 * 异步校验家庭状态，切换页面或进入子页面前调用
 */
async function ensureFamily() {
  const ok = await syncFamilyContext();
  if (!ok) {
    wx.showToast({ title: '请先创建或加入家庭', icon: 'none' });
    wx.switchTab({ url: '/pages/family/family' });
    return false;
  }
  return true;
}

/**
 * 获取 app 全局家庭信息
 */
function getFamilyContext() {
  const app = getApp();
  const familyId = app.globalData.family
    ? app.globalData.family.familyId
    : ((app.globalData.userInfo && app.globalData.userInfo.familyId) || null);
  return {
    family: app.globalData.family,
    familyId,
    userInfo: app.globalData.userInfo,
    settings: app.globalData.settings,
    hasFamily: app.globalData.hasFamily
  };
}

/**
 * 检查是否有家庭，无则跳转（同步快速检查，优先用 ensureFamily）
 */
function requireFamily() {
  const { hasFamily, family, userInfo } = getFamilyContext();
  const ok = !!(hasFamily && (family || (userInfo && userInfo.familyId)));
  if (!ok) {
    wx.showToast({ title: '请先创建或加入家庭', icon: 'none' });
    wx.switchTab({ url: '/pages/family/family' });
    return false;
  }
  return true;
}

module.exports = {
  callFunction,
  uploadImage,
  getFamilyContext,
  applyFamilyContext,
  syncFamilyContext,
  ensureFamily,
  requireFamily
};
