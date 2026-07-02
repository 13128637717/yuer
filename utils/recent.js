const { getFamilyContext } = require('./cloud');

const MILK_PREF_KEY = 'recentMilkPref';
const FOOD_RECENT_KEY = 'recentFoodNames';

function familyStorageKey(base) {
  const { familyId } = getFamilyContext();
  return familyId ? `${base}_${familyId}` : base;
}

function getRecentMilkPref() {
  try {
    return wx.getStorageSync(familyStorageKey(MILK_PREF_KEY)) || null;
  } catch (err) {
    return null;
  }
}

function saveRecentMilkPref({ amount, type }) {
  if (!amount || !type) return;
  try {
    wx.setStorageSync(familyStorageKey(MILK_PREF_KEY), { amount, type });
  } catch (err) {
    console.warn('保存奶量偏好失败', err);
  }
}

function getRecentFoodNames() {
  try {
    return wx.getStorageSync(familyStorageKey(FOOD_RECENT_KEY)) || [];
  } catch (err) {
    return [];
  }
}

function saveRecentFoodName(foodName) {
  const name = (foodName || '').trim();
  if (!name) return;
  try {
    const list = getRecentFoodNames().filter((n) => n !== name);
    list.unshift(name);
    wx.setStorageSync(familyStorageKey(FOOD_RECENT_KEY), list.slice(0, 5));
  } catch (err) {
    console.warn('保存辅食偏好失败', err);
  }
}

module.exports = {
  getRecentMilkPref,
  saveRecentMilkPref,
  getRecentFoodNames,
  saveRecentFoodName
};
