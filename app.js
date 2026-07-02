// 宝宝成长助手 - 小程序入口
const { syncFamilyContext } = require('./utils/cloud');
const { isValidNickName, saveCachedProfile } = require('./utils/user');
const { cloudEnvId } = require('./config/env');

App({
  onLaunch(options) {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: cloudEnvId,
      traceUser: true
    });

    this.capturePendingInviteCode(options);
    this.initUser();
  },

  capturePendingInviteCode(options) {
    const code = this.parseInviteCodeFromLaunch(options);
    if (code) {
      this.globalData.pendingInviteCode = code;
    }
  },

  parseInviteCodeFromLaunch(options) {
    if (!options) return '';
    const query = options.query || {};
    if (query.inviteCode) {
      return String(query.inviteCode).toUpperCase().trim();
    }
    if (options.scene) {
      try {
        const scene = decodeURIComponent(String(options.scene));
        if (scene.includes('=')) {
          const params = {};
          scene.split('&').forEach((part) => {
            const [key, value] = part.split('=');
            if (key && value) params[key] = value;
          });
          if (params.inviteCode) {
            return String(params.inviteCode).toUpperCase().trim();
          }
        } else if (/^[A-Z0-9]{6}$/.test(scene.toUpperCase())) {
          return scene.toUpperCase().trim();
        }
      } catch (err) {
        console.warn('解析邀请 scene 失败:', err);
      }
    }
    return '';
  },

  // 初始化用户登录与家庭信息
  async initUser() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      });
      const result = res.result || {};
      if (!result.success) return;

      if (result.user) {
        this.globalData.userInfo = result.user;
        if (isValidNickName(result.user.nickName)) {
          saveCachedProfile({
            nickName: result.user.nickName,
            avatarUrl: result.user.avatarUrl || ''
          });
        }
      }
      this.globalData.isReady = true;

      // 用 familyOperate 同步家庭，避免 login 查询覆盖刚创建的家庭状态
      await syncFamilyContext();

      if (!this.globalData.hasFamily) {
        const pages = getCurrentPages();
        const currentRoute = pages.length ? pages[pages.length - 1].route : '';
        if (currentRoute !== 'pages/family/family') {
          const pendingCode = this.globalData.pendingInviteCode;
          const familyUrl = pendingCode
            ? `/pages/family/family?inviteCode=${pendingCode}`
            : '/pages/family/family';
          wx.reLaunch({ url: familyUrl });
        }
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  },

  // 刷新全局用户与家庭数据
  async refreshUser() {
    await this.initUser();
  },

  globalData: {
    userInfo: null,
    family: null,
    settings: null,
    hasFamily: false,
    isReady: false,
    pendingInviteCode: ''
  }
});
