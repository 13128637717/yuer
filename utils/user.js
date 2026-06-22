const { callFunction } = require('./cloud');

const PROFILE_STORAGE_KEY = 'wxProfile';
const DEFAULT_NICK = '微信用户';

function isValidNickName(nickName) {
  return !!(nickName && String(nickName).trim() && nickName !== DEFAULT_NICK);
}

function getCachedProfile() {
  const app = getApp();
  const user = app.globalData.userInfo;
  if (isValidNickName(user && user.nickName)) {
    return { nickName: user.nickName, avatarUrl: (user && user.avatarUrl) || '' };
  }
  const stored = wx.getStorageSync(PROFILE_STORAGE_KEY);
  if (stored && isValidNickName(stored.nickName)) {
    return { nickName: stored.nickName, avatarUrl: stored.avatarUrl || '' };
  }
  return null;
}

function saveCachedProfile(profile) {
  wx.setStorageSync(PROFILE_STORAGE_KEY, profile);
  const app = getApp();
  if (app.globalData.userInfo) {
    app.globalData.userInfo = { ...app.globalData.userInfo, ...profile };
  }
}

/**
 * 同步昵称到 users 与家庭成员列表
 */
async function syncProfileToServer(profile) {
  if (!profile || !isValidNickName(profile.nickName)) return null;

  await wx.cloud.callFunction({
    name: 'login',
    data: { nickName: profile.nickName, avatarUrl: profile.avatarUrl || '' }
  });
  saveCachedProfile(profile);

  try {
    const res = await callFunction('familyOperate', {
      action: 'syncNickName',
      nickName: profile.nickName,
      avatarUrl: profile.avatarUrl || ''
    });
    return res;
  } catch (err) {
    return null;
  }
}

module.exports = {
  DEFAULT_NICK,
  isValidNickName,
  getCachedProfile,
  saveCachedProfile,
  syncProfileToServer
};
