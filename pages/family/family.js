const { callFunction, uploadImage, resolveCloudFileUrls, getFamilyContext, applyFamilyContext, syncFamilyContext } = require('../../utils/cloud');
const { isValidNickName, getCachedProfile, syncProfileToServer } = require('../../utils/user');
const { milkReminderTmplId, sleepReminderTmplId } = require('../../config/subscribe');

function normalizeSettings(settings) {
  if (!settings) {
    return { robotWebhook: '', notifyEnabled: false, notifyTime: '08:00' };
  }
  return {
    robotWebhook: settings.robotWebhook || '',
    notifyEnabled: settings.notifyEnabled === true,
    notifyTime: settings.notifyTime || '08:00'
  };
}

Page({
  data: {
    hasFamily: false,
    isCreator: false,
    userInfo: null,
    family: null,
    settings: null,
    // 创建家庭表单
    babyName: '',
    babyBirth: '',
    // 加入家庭
    inviteCode: '',
    // 设置
    robotWebhook: '',
    notifyEnabled: false,
    notifyTime: '08:00',
    showCreateForm: false,
    showJoinForm: false,
    showBabyEditForm: false,
    editBabyName: '',
    editBabyBirth: '',
    babyAvatarUrl: '/images/illustrations/baby-avatar.png',
    editBabyAvatar: '',
    editBabyAvatarUrl: '',
    createBabyAvatarTemp: '',
    createBabyAvatarUrl: '',
    avatarUploading: false,
    switchingFamily: false,
    nickName: '',
    hasValidNick: false,
    pendingAction: '',
    fromInvite: false,
    invitePreview: null
  },

  _loadRequestId: 0,
  _savingSettings: false,
  _pendingInviteCode: '',

  onLoad(options) {
    const code = this.parseInviteCode(options) || getApp().globalData.pendingInviteCode;
    if (code) {
      this._pendingInviteCode = code;
      getApp().globalData.pendingInviteCode = code;
    }
  },

  onShow() {
    if (!this._savingSettings) {
      this.loadFamilyInfo().then(() => this.processPendingInvite());
    }
  },

  onShareAppMessage() {
    const { family } = this.data;
    if (!family || !family.familyId) {
      return {
        title: '宝宝成长助手 - 与家人共同记录宝宝成长',
        path: '/pages/family/family'
      };
    }
    const babyName = family.babyName || '宝宝';
    return {
      title: `邀请你加入「${babyName}」的成长记录`,
      path: `/pages/family/family?inviteCode=${family.familyId}`
    };
  },

  onShareTimeline() {
    const { family } = this.data;
    if (!family || !family.familyId) {
      return { title: '宝宝成长助手 - 记录宝宝成长' };
    }
    const babyName = family.babyName || '宝宝';
    return {
      title: `邀请你加入「${babyName}」的成长记录`,
      query: `inviteCode=${family.familyId}`
    };
  },

  parseInviteCode(options) {
    if (!options) return '';
    if (options.inviteCode) {
      return String(options.inviteCode).toUpperCase().trim();
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

  processPendingInvite() {
    const code = this._pendingInviteCode || getApp().globalData.pendingInviteCode;
    if (!code || !/^[A-Z0-9]{6}$/.test(code)) return;

    this._pendingInviteCode = '';
    getApp().globalData.pendingInviteCode = '';

    const { hasFamily, family } = this.data;
    if (hasFamily && family && family.familyId === code) {
      wx.showToast({ title: '您已在该家庭中', icon: 'none' });
      return;
    }

    if (hasFamily) {
      wx.showModal({
        title: '收到家庭邀请',
        content: `是否加入邀请码 ${code} 的家庭？加入后将离开当前家庭。`,
        confirmText: '加入',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              switchingFamily: true,
              showJoinForm: true,
              showCreateForm: false,
              inviteCode: code,
              fromInvite: true
            });
            this.loadInvitePreview(code);
          }
        }
      });
      return;
    }

    this.setData({
      showJoinForm: true,
      showCreateForm: false,
      inviteCode: code,
      fromInvite: true
    });
    this.loadInvitePreview(code);
  },

  async loadInvitePreview(inviteCode) {
    try {
      const res = await callFunction('familyOperate', {
        action: 'preview',
        inviteCode
      });
      if (res.preview) {
        this.setData({ invitePreview: res.preview });
      }
    } catch (err) {
      console.warn('加载邀请预览失败', err);
    }
  },

  onPullDownRefresh() {
    this.loadFamilyInfo(true).finally(() => wx.stopPullDownRefresh());
  },

  applyFamilyInfo({ hasFamily, family, settings, user }) {
    applyFamilyContext({ hasFamily, family, settings, user });
    const userInfo = user || getFamilyContext().userInfo;
    const normalized = normalizeSettings(settings);
    this.setData({
      hasFamily,
      family,
      settings,
      userInfo,
      isCreator: !!(user && user.role === 'creator'),
      showCreateForm: false,
      showJoinForm: false,
      showBabyEditForm: false,
      switchingFamily: false,
      robotWebhook: normalized.robotWebhook,
      notifyEnabled: normalized.notifyEnabled,
      notifyTime: normalized.notifyTime
    });
    if (hasFamily && family) {
      this.resolveBabyAvatarUrl(family).then((babyAvatarUrl) => {
        this.setData({ babyAvatarUrl });
      });
    }
    this.initNickNameFromCache();
  },

  applySettingsToPage(settings) {
    const normalized = normalizeSettings(settings);
    applyFamilyContext({
      hasFamily: true,
      family: this.data.family,
      settings,
      user: this.data.userInfo
    });
    this.setData({
      settings,
      robotWebhook: normalized.robotWebhook,
      notifyEnabled: normalized.notifyEnabled,
      notifyTime: normalized.notifyTime
    });
    this.initNickNameFromCache();
  },

  async resolveBabyAvatarUrl(family) {
    if (!family || !family.babyAvatar) {
      return '/images/illustrations/baby-avatar.png';
    }
    const [url] = await resolveCloudFileUrls([family.babyAvatar]);
    return url || '/images/illustrations/baby-avatar.png';
  },

  async loadFamilyInfo(force = false) {
    const requestId = ++this._loadRequestId;
    try {
      await syncFamilyContext(force);
      if (requestId !== this._loadRequestId || this._savingSettings) return;

      const { hasFamily, family, settings, userInfo } = getFamilyContext();
      const normalized = normalizeSettings(settings);
      const babyAvatarUrl = hasFamily ? await this.resolveBabyAvatarUrl(family) : '/images/illustrations/baby-avatar.png';
      this.setData({
        hasFamily,
        family,
        settings,
        userInfo,
        babyAvatarUrl,
        isCreator: !!(userInfo && userInfo.role === 'creator'),
        robotWebhook: normalized.robotWebhook,
        notifyEnabled: normalized.notifyEnabled,
        notifyTime: normalized.notifyTime
      });
      this.initNickNameFromCache();
      this.refreshMemberNickName();
    } catch (err) {
      console.error('加载家庭信息失败:', err);
    }
  },

  initNickNameFromCache() {
    const profile = getCachedProfile();
    const fromUser = this.data.userInfo && this.data.userInfo.nickName;
    const nickName = (profile && profile.nickName)
      || (isValidNickName(fromUser) ? fromUser : '');
    this.setData({
      nickName,
      hasValidNick: isValidNickName(nickName)
    });
  },

  async applyNickName(nickName, avatarUrl) {
    const value = (nickName || '').trim();
    if (!isValidNickName(value)) return false;

    this.setData({ nickName: value, hasValidNick: true });
    const res = await syncProfileToServer({ nickName: value, avatarUrl: avatarUrl || '' });
    if (res && res.family) {
      applyFamilyContext({
        hasFamily: this.data.hasFamily,
        family: res.family,
        settings: this.data.settings,
        user: res.user || this.data.userInfo
      });
      this.setData({
        family: res.family,
        userInfo: res.user || this.data.userInfo
      });
    } else if (res && res.user) {
      this.setData({ userInfo: res.user });
    }
    return true;
  },

  requireNickName(action) {
    if (this.data.hasValidNick) return true;
    this.setData({ pendingAction: action || '' });
    wx.showToast({ title: '请先点击使用微信昵称', icon: 'none' });
    return false;
  },

  async continuePendingAction() {
    const action = this.data.pendingAction;
    if (!action) return;
    this.setData({ pendingAction: '' });
    if (action === 'create') {
      await this.createFamily();
    } else if (action === 'join') {
      await this.joinFamily();
    }
  },

  onNickNameInput(e) {
    const nickName = (e.detail.value || '').trim();
    this.setData({
      nickName,
      hasValidNick: isValidNickName(nickName)
    });
  },

  async onNickNameReview(e) {
    if (!e.detail.pass) return;
    const ok = await this.applyNickName(e.detail.value);
    if (ok) await this.continuePendingAction();
  },

  async onNickNameBlur(e) {
    const ok = await this.applyNickName(e.detail.value);
    if (ok && this.data.pendingAction) {
      await this.continuePendingAction();
    }
  },

  async refreshMemberNickName() {
    const profile = getCachedProfile();
    if (!profile || !this.data.hasFamily) return;

    try {
      const res = await syncProfileToServer(profile);
      if (res && res.family) {
        applyFamilyContext({
          hasFamily: true,
          family: res.family,
          settings: this.data.settings,
          user: res.user || this.data.userInfo
        });
        this.setData({
          family: res.family,
          userInfo: res.user || this.data.userInfo
        });
      }
    } catch (err) {
      console.error('同步微信昵称失败:', err);
    }
  },

  // 显示创建表单
  showCreate() {
    this.initNickNameFromCache();
    this.setData({ showCreateForm: true, showJoinForm: false, switchingFamily: false, fromInvite: false });
  },

  showJoin() {
    this.initNickNameFromCache();
    this.setData({ showJoinForm: true, showCreateForm: false, switchingFamily: false, fromInvite: false });
  },

  showSwitchCreate() {
    wx.showModal({
      title: '创建新家庭',
      content: '创建新家庭后将离开当前家庭，确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            switchingFamily: true,
            showCreateForm: true,
            showJoinForm: false,
            babyName: '',
            babyBirth: ''
          });
        }
      }
    });
  },

  showSwitchJoin() {
    wx.showModal({
      title: '加入其他家庭',
      content: '加入新家庭后将离开当前家庭，确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            switchingFamily: true,
            showJoinForm: true,
            showCreateForm: false,
            inviteCode: ''
          });
        }
      }
    });
  },

  showBabyEdit() {
    const { family } = this.data;
    this.setData({
      showBabyEditForm: true,
      editBabyName: family ? family.babyName : '',
      editBabyBirth: family ? (family.babyBirth || '') : '',
      editBabyAvatar: family ? (family.babyAvatar || '') : '',
      editBabyAvatarUrl: this.data.babyAvatarUrl
    });
  },

  cancelBabyEdit() {
    this.setData({ showBabyEditForm: false });
  },

  onEditBabyNameInput(e) { this.setData({ editBabyName: e.detail.value }); },
  onEditBabyBirthChange(e) { this.setData({ editBabyBirth: e.detail.value }); },

  onCreateAvatarChange(e) {
    const { fileIds, imageUrls } = e.detail;
    this.setData({
      createBabyAvatarTemp: (fileIds && fileIds[0]) || '',
      createBabyAvatarUrl: (imageUrls && imageUrls[0]) || ''
    });
  },

  chooseCreateAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        this.setData({
          createBabyAvatarTemp: file.tempFilePath,
          createBabyAvatarUrl: file.tempFilePath
        });
      }
    });
  },

  removeCreateAvatar() {
    this.setData({ createBabyAvatarTemp: '', createBabyAvatarUrl: '' });
  },

  onEditAvatarChange(e) {
    const { fileIds, imageUrls } = e.detail;
    this.setData({
      editBabyAvatar: (fileIds && fileIds[0]) || '',
      editBabyAvatarUrl: (imageUrls && imageUrls[0]) || ''
    });
  },

  async uploadBabyAvatar(filePath, familyId) {
    const ext = filePath.split('.').pop() || 'jpg';
    const cloudPath = `avatar/${familyId}/baby.${ext}`;
    return uploadImage(filePath, cloudPath);
  },

  onBabyNameInput(e) { this.setData({ babyName: e.detail.value }); },
  onBabyBirthChange(e) { this.setData({ babyBirth: e.detail.value }); },
  onInviteCodeInput(e) { this.setData({ inviteCode: e.detail.value }); },
  onWebhookInput(e) { this.setData({ robotWebhook: e.detail.value }); },
  async onNotifySwitch(e) {
    const notifyEnabled = e.detail.value;
    const prev = this.data.notifyEnabled;
    this.setData({ notifyEnabled });
    const ok = await this.saveSettings({ notifyEnabled });
    if (!ok) this.setData({ notifyEnabled: prev });
  },
  async onNotifyTimeChange(e) {
    const notifyTime = e.detail.value;
    const prev = this.data.notifyTime;
    this.setData({ notifyTime });
    const ok = await this.saveSettings({ notifyTime });
    if (!ok) this.setData({ notifyTime: prev });
  },
  onSaveSettingsTap() {
    this.saveSettings();
  },

  requestSubscribeReminders() {
    const tmplIds = [milkReminderTmplId, sleepReminderTmplId].filter(Boolean);
    if (!tmplIds.length) {
      wx.showModal({
        title: '模板未配置',
        content: '请在 config/subscribe.js 中填入微信公众平台申请的订阅消息模板 ID 后重试。',
        showCancel: false
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const accepted = tmplIds.filter((id) => res[id] === 'accept');
        if (accepted.length) {
          wx.showToast({ title: `已订阅 ${accepted.length} 项提醒`, icon: 'success' });
        } else {
          wx.showToast({ title: '未开启订阅', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '订阅请求失败', icon: 'none' });
      }
    });
  },

  async onTestNotifyTap() {
    const { familyId } = getFamilyContext();
    if (!this.data.notifyEnabled) {
      wx.showToast({ title: '请先开启每日推送', icon: 'none' });
      return;
    }
    if (!this.data.robotWebhook.trim()) {
      wx.showToast({ title: '请先填写 Webhook', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '推送中...' });
    try {
      const res = await callFunction('dailyNotify', { force: true, familyId });
      wx.hideLoading();
      const item = (res.results || []).find((r) => r.familyId === familyId);
      if (item && item.status === 'success') {
        wx.showToast({ title: '测试推送成功', icon: 'success' });
        return;
      }
      if (item && item.status === 'failed') {
        wx.showToast({ title: item.error || '推送失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '未找到可推送的家庭设置', icon: 'none' });
    } catch (err) {
      wx.hideLoading();
    }
  },

  // 保存设置
  async saveSettings(overrides) {
    if (overrides && overrides.type) overrides = {};
    overrides = overrides || {};

    const { familyId } = getFamilyContext();
    if (!familyId) {
      wx.showToast({ title: '请先创建或加入家庭', icon: 'none' });
      return false;
    }

    const payload = {
      action: 'updateSettings',
      familyId,
      robotWebhook: overrides.robotWebhook !== undefined ? overrides.robotWebhook : this.data.robotWebhook,
      notifyEnabled: overrides.notifyEnabled !== undefined ? overrides.notifyEnabled : this.data.notifyEnabled,
      notifyTime: overrides.notifyTime !== undefined ? overrides.notifyTime : this.data.notifyTime
    };

    this._savingSettings = true;
    this._loadRequestId += 1;
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await callFunction('familyOperate', payload);
      if (res.settings) {
        this.applySettingsToPage(res.settings);
      }
      wx.hideLoading();
      wx.showToast({ title: '设置已保存', icon: 'success' });
      return true;
    } catch (err) {
      wx.hideLoading();
      return false;
    } finally {
      this._savingSettings = false;
    }
  },

  // 保存宝宝信息
  async saveBabyInfo() {
    const { editBabyName, editBabyBirth, editBabyAvatar } = this.data;
    if (!editBabyName.trim()) {
      wx.showToast({ title: '请输入宝宝姓名', icon: 'none' });
      return;
    }

    const { familyId } = getFamilyContext();
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await callFunction('familyOperate', {
        action: 'updateBaby',
        familyId,
        babyName: editBabyName.trim(),
        babyBirth: editBabyBirth,
        babyAvatar: editBabyAvatar
      });
      wx.hideLoading();
      if (res.family) {
        const babyAvatarUrl = await this.resolveBabyAvatarUrl(res.family);
        applyFamilyContext({
          hasFamily: true,
          family: res.family,
          settings: this.data.settings,
          user: this.data.userInfo
        });
        this.setData({
          family: res.family,
          babyAvatarUrl,
          showBabyEditForm: false
        });
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  },

  // 创建家庭
  async createFamily() {
    const { babyName, babyBirth, switchingFamily, nickName, createBabyAvatarTemp } = this.data;
    if (!babyName.trim()) {
      wx.showToast({ title: '请输入宝宝姓名', icon: 'none' });
      return;
    }
    if (!this.requireNickName('create')) return;

    wx.showLoading({ title: '创建中...' });
    try {
      await syncProfileToServer({ nickName, avatarUrl: '' });
      const res = await callFunction('familyOperate', {
        action: 'create',
        babyName: babyName.trim(),
        babyBirth,
        nickName,
        switchFamily: switchingFamily
      });
      if (res.family && createBabyAvatarTemp) {
        const familyId = res.family.familyId;
        const babyAvatar = await this.uploadBabyAvatar(createBabyAvatarTemp, familyId);
        const updateRes = await callFunction('familyOperate', {
          action: 'updateBaby',
          familyId,
          babyAvatar
        });
        if (updateRes.family) res.family = updateRes.family;
      }
      wx.hideLoading();
      this.setData({ createBabyAvatarTemp: '', createBabyAvatarUrl: '' });
      this.applyFamilyInfo(res);
      wx.showToast({ title: '创建成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  },

  // 加入家庭
  async joinFamily() {
    const { inviteCode, switchingFamily, nickName } = this.data;
    if (!inviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (!this.requireNickName('join')) return;

    wx.showLoading({ title: '加入中...' });
    try {
      await syncProfileToServer({ nickName, avatarUrl: '' });
      const res = await callFunction('familyOperate', {
        action: 'join',
        inviteCode: inviteCode.trim(),
        nickName,
        switchFamily: switchingFamily
      });
      wx.hideLoading();
      this.applyFamilyInfo(res);
      this.setData({ fromInvite: false });
      wx.showToast({ title: '加入成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
    }
  },

  // 复制邀请信息
  copyInviteCode() {
    const { family } = this.data;
    if (!family) return;
    const babyName = family.babyName || '宝宝';
    const text = `邀请你加入「${babyName}」的成长记录，打开「宝宝成长助手」小程序，在「我的」页输入邀请码：${family.familyId}`;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '邀请信息已复制', icon: 'success' })
    });
  },


  // 移除成员
  removeMember(e) {
    const { openid, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认移除',
      content: `确定要移除成员「${name}」吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('familyOperate', {
              action: 'removeMember',
              targetOpenid: openid
            });
            wx.showToast({ title: '已移除', icon: 'success' });
            this.loadFamilyInfo();
          } catch (err) { /* handled */ }
        }
      }
    });
  },

  // 退出家庭
  leaveFamily() {
    const content = this.data.isCreator
      ? '退出后创建者权限将移交给其他成员（若无其他成员则家庭保留为空），确定退出吗？'
      : '确定要退出当前家庭吗？';
    wx.showModal({
      title: '确认退出',
      content,
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await callFunction('familyOperate', { action: 'leave' });
            this.applyFamilyInfo({
              hasFamily: false,
              family: null,
              settings: null,
              user: res.user
            });
            await syncFamilyContext(true);
            wx.showToast({ title: '已退出', icon: 'success' });
          } catch (err) { /* handled */ }
        }
      }
    });
  }
});
