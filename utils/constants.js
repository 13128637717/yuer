// 常量定义
module.exports = {
  // 云函数名称
  CF_LOGIN: 'login',
  CF_FAMILY: 'familyOperate',
  CF_RECORD: 'recordOperate',
  CF_STATS: 'getStats',

  // 数据库集合名
  COL_USERS: 'users',
  COL_FAMILIES: 'families',
  COL_RECORDS: 'records',
  COL_SETTINGS: 'settings',

  // 用户角色
  ROLE_CREATOR: 'creator',
  ROLE_MEMBER: 'member',

  // 奶类型
  MILK_BREAST: 'breast',
  MILK_FORMULA: 'formula',
  MILK_TYPE_MAP: {
    breast: '母乳',
    formula: '配方奶'
  },

  // 辅食单位
  UNIT_G: 'g',
  UNIT_ML: 'ml',

  // 统计天数选项
  STATS_DAYS: {
    WEEK: 7,
    MONTH: 30
  }
};
