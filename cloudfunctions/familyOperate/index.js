// 云函数：familyOperate - 家庭组操作
const {
  cloud, db, getUser, findFamilyByOpenid, resolveUserFamily, verifyFamilyMember, generateFamilyId
} = require('./utils');

async function ensureSettings(familyId) {
  const settingsRes = await db.collection('settings').where({ familyId }).get();
  if (settingsRes.data.length) {
    const [primary, ...duplicates] = settingsRes.data.sort((a, b) => {
      const aTime = a.updateTime ? new Date(a.updateTime).getTime() : 0;
      const bTime = b.updateTime ? new Date(b.updateTime).getTime() : 0;
      return bTime - aTime;
    });
    await Promise.all(duplicates.map((item) => db.collection('settings').doc(item._id).remove()));
    return primary;
  }

  const settingsDoc = {
    familyId,
    robotWebhook: '',
    notifyEnabled: false,
    notifyTime: '08:00',
    lastNotifyDate: '',
    lastNotifySentOn: '',
    updateTime: db.serverDate()
  };
  const addSettingsRes = await db.collection('settings').add({ data: settingsDoc });
  return { _id: addSettingsRes._id, ...settingsDoc };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  try {
    switch (action) {
      case 'create':
        return await createFamily(openid, event);
      case 'join':
        return await joinFamily(openid, event);
      case 'leave':
        return await leaveFamily(openid);
      case 'removeMember':
        return await removeMember(openid, event);
      case 'get':
        return await getFamilyInfo(openid);
      case 'updateSettings':
        return await updateSettings(openid, event);
      case 'updateBaby':
        return await updateBaby(openid, event);
      case 'syncNickName':
        return await syncNickName(openid, event);
      case 'preview':
        return await previewFamily(event);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('familyOperate 错误:', err);
    return { success: false, message: err.message || '操作失败' };
  }
};

/** 从当前家庭脱离（成员退出 / 创建者移交或退出） */
async function detachFromFamily(openid, user) {
  if (!user || !user.familyId) return { success: true };

  const verify = await verifyFamilyMember(openid, user.familyId);
  if (!verify.valid) {
    await db.collection('users').doc(user._id).update({
      data: { familyId: '', role: '' }
    });
    return { success: true, user: { ...user, familyId: '', role: '' } };
  }

  const { family } = verify;
  const otherMembers = family.members.filter((m) => m.openid !== openid);
  const updateData = { members: otherMembers };

  if (user.role === 'creator' && otherMembers.length) {
    const newCreator = { ...otherMembers[0], role: 'creator' };
    updateData.members = [newCreator, ...otherMembers.slice(1)];
    updateData.creatorOpenid = newCreator.openid;

    const newCreatorUser = await getUser(newCreator.openid);
    if (newCreatorUser) {
      await db.collection('users').doc(newCreatorUser._id).update({
        data: { role: 'creator' }
      });
    }
  } else if (user.role === 'creator') {
    updateData.creatorOpenid = '';
  }

  await db.collection('families').doc(family._id).update({ data: updateData });
  await db.collection('users').doc(user._id).update({
    data: { familyId: '', role: '' }
  });

  return { success: true, user: { ...user, familyId: '', role: '' } };
}

/** 创建家庭 */
async function createFamily(openid, event) {
  const { babyName, babyBirth, babyAvatar, nickName, avatarUrl, switchFamily } = event;
  if (!babyName) return { success: false, message: '请输入宝宝姓名' };

  let user = await getUser(openid);
  if (user && user.familyId) {
    if (!switchFamily) {
      return { success: false, message: '您已加入家庭，请先退出' };
    }
    const detachRes = await detachFromFamily(openid, user);
    user = detachRes.user || (await getUser(openid));
  }

  const familyId = await generateFamilyId();
  const displayName = resolveDisplayName(nickName, user);
  const familyDoc = {
    familyId,
    babyName,
    babyBirth: babyBirth || '',
    babyAvatar: babyAvatar || '',
    creatorOpenid: openid,
    members: [{ openid, nickName: displayName, role: 'creator' }],
    createTime: db.serverDate()
  };

  const addFamilyRes = await db.collection('families').add({ data: familyDoc });
  const family = { _id: addFamilyRes._id, ...familyDoc };

  // 更新或创建用户
  let updatedUser;
  if (user) {
    await db.collection('users').doc(user._id).update({
      data: { familyId, role: 'creator', nickName: displayName, avatarUrl: avatarUrl || user.avatarUrl }
    });
    updatedUser = { ...user, familyId, role: 'creator', nickName: displayName, avatarUrl: avatarUrl || user.avatarUrl };
  } else {
    const usersRes = await db.collection('users').where({ _openid: openid }).get();
    const existing = usersRes.data.find((u) => u.familyId) || usersRes.data[0];
    if (existing) {
      await db.collection('users').doc(existing._id).update({
        data: { familyId, role: 'creator', nickName: displayName, avatarUrl: avatarUrl || existing.avatarUrl }
      });
      updatedUser = { ...existing, familyId, role: 'creator', nickName: displayName };
    } else {
      await db.collection('users').add({
        data: {
          _openid: openid,
          nickName: displayName,
          avatarUrl: avatarUrl || '',
          familyId,
          role: 'creator',
          createTime: db.serverDate()
        }
      });
      updatedUser = { nickName: displayName, avatarUrl: avatarUrl || '', familyId, role: 'creator' };
    }
  }

  const settingsDoc = {
    familyId,
    robotWebhook: '',
    notifyEnabled: false,
    notifyTime: '08:00',
    lastNotifyDate: '',
    lastNotifySentOn: '',
    updateTime: db.serverDate()
  };
  const addSettingsRes = await db.collection('settings').add({ data: settingsDoc });
  const settings = { _id: addSettingsRes._id, ...settingsDoc };

  return {
    success: true,
    hasFamily: true,
    family,
    settings,
    user: updatedUser,
    message: '家庭创建成功'
  };
}

/** 加入家庭 */
async function joinFamily(openid, event) {
  const { inviteCode, nickName, avatarUrl, switchFamily } = event;
  if (!inviteCode) return { success: false, message: '请输入邀请码' };

  const code = inviteCode.trim().toUpperCase();
  const familyRes = await db.collection('families').where({ familyId: code }).limit(1).get();
  if (!familyRes.data.length) return { success: false, message: '邀请码无效' };

  const family = familyRes.data[0];
  if (family.members.some((m) => m.openid === openid)) {
    return { success: false, message: '您已是该家庭成员' };
  }

  let user = await getUser(openid);
  if (user && user.familyId) {
    if (user.familyId === code) {
      return { success: false, message: '您已是该家庭成员' };
    }
    if (!switchFamily) {
      return { success: false, message: '您已加入其他家庭，请先退出' };
    }
    const detachRes = await detachFromFamily(openid, user);
    user = detachRes.user || { ...user, familyId: '', role: '' };
  }

  const displayName = resolveDisplayName(nickName, user);
  const newMembers = [...family.members, { openid, nickName: displayName, role: 'member' }];

  await db.collection('families').doc(family._id).update({
    data: { members: newMembers }
  });

  if (user) {
    await db.collection('users').doc(user._id).update({
      data: { familyId: code, role: 'member', nickName: displayName }
    });
  } else {
    await db.collection('users').add({
      data: {
        _openid: openid,
        nickName: displayName,
        avatarUrl: avatarUrl || '',
        familyId: code,
        role: 'member',
        createTime: db.serverDate()
      }
    });
  }

  const updatedFamily = await db.collection('families').where({ familyId: code }).limit(1).get();
  const settings = await ensureSettings(code);
  const updatedUser = user
    ? { ...user, familyId: code, role: 'member', nickName: displayName }
    : { nickName: displayName, avatarUrl: avatarUrl || '', familyId: code, role: 'member' };

  return {
    success: true,
    hasFamily: true,
    family: updatedFamily.data[0],
    settings,
    user: updatedUser,
    message: '加入家庭成功'
  };
}

/** 退出家庭 */
async function leaveFamily(openid) {
  const user = await getUser(openid);
  if (!user || !user.familyId) return { success: false, message: '您未加入任何家庭' };

  const detachRes = await detachFromFamily(openid, user);
  return {
    success: true,
    hasFamily: false,
    user: detachRes.user,
    message: '已退出家庭'
  };
}

/** 移除成员（仅创建者） */
async function removeMember(openid, event) {
  const { targetOpenid } = event;
  if (!targetOpenid) return { success: false, message: '请指定成员' };

  const user = await getUser(openid);
  if (!user || user.role !== 'creator') {
    return { success: false, message: '仅创建者可移除成员' };
  }
  if (targetOpenid === openid) {
    return { success: false, message: '不能移除自己' };
  }

  const verify = await verifyFamilyMember(openid, user.familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const newMembers = verify.family.members.filter((m) => m.openid !== targetOpenid);
  await db.collection('families').doc(verify.family._id).update({
    data: { members: newMembers }
  });

  const targetUser = await getUser(targetOpenid);
  if (targetUser) {
    await db.collection('users').doc(targetUser._id).update({
      data: { familyId: '', role: '' }
    });
  }

  return { success: true, message: '成员已移除' };
}

function resolveDisplayName(nickName, user) {
  const name = (nickName && String(nickName).trim())
    || (user && user.nickName)
    || '微信用户';
  return String(name).trim() || '微信用户';
}

function normalizeMemberNickName(member, userNickName) {
  return userNickName || member.nickName || member.name || '微信用户';
}

async function enrichFamilyMembers(family) {
  if (!family || !Array.isArray(family.members)) return family;

  const members = await Promise.all(family.members.map(async (member) => {
    const memberUser = await getUser(member.openid);
    return {
      ...member,
      nickName: normalizeMemberNickName(member, memberUser && memberUser.nickName)
    };
  }));

  return { ...family, members };
}

/** 同步微信昵称到用户与家庭成员列表 */
async function syncNickName(openid, event) {
  const displayName = resolveDisplayName(event.nickName, null);
  if (displayName === '微信用户') {
    return { success: false, message: '请填写微信昵称' };
  }

  let user = await getUser(openid);
  if (user) {
    await db.collection('users').doc(user._id).update({ data: { nickName: displayName } });
    user = { ...user, nickName: displayName };
  } else {
    const addRes = await db.collection('users').add({
      data: {
        _openid: openid,
        nickName: displayName,
        avatarUrl: event.avatarUrl || '',
        familyId: '',
        role: '',
        createTime: db.serverDate()
      }
    });
    user = {
      _id: addRes._id,
      _openid: openid,
      nickName: displayName,
      avatarUrl: event.avatarUrl || '',
      familyId: '',
      role: ''
    };
  }

  if (!user.familyId) {
    return { success: true, user, message: '昵称已更新' };
  }

  const verify = await verifyFamilyMember(openid, user.familyId);
  if (!verify.valid) {
    return { success: true, user, message: '昵称已更新' };
  }

  const newMembers = verify.family.members.map((member) => (
    member.openid === openid ? { ...member, nickName: displayName } : member
  ));
  await db.collection('families').doc(verify.family._id).update({ data: { members: newMembers } });
  const family = await enrichFamilyMembers({ ...verify.family, members: newMembers });

  return { success: true, user, family, message: '昵称已更新' };
}

/** 获取家庭信息 */
async function getFamilyInfo(openid) {
  let { user, familyId } = await resolveUserFamily(openid);
  if (!familyId) {
    return { success: true, hasFamily: false, family: null, settings: null, user: user || null };
  }

  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) {
    return { success: true, hasFamily: false, family: null, settings: null, user: user || null };
  }

  const family = await enrichFamilyMembers(verify.family);
  let settings = null;
  const settingsRes = await db.collection('settings').where({ familyId }).limit(1).get();
  settings = settingsRes.data[0] || null;

  if (user) {
    const selfMember = family.members.find((m) => m.openid === openid);
    if (selfMember && selfMember.nickName) {
      user = { ...user, nickName: selfMember.nickName };
    }
  }

  return {
    success: true,
    hasFamily: true,
    family,
    settings,
    user
  };
}

/** 更新家庭设置 */
async function updateSettings(openid, event) {
  const { user, familyId: resolvedFamilyId } = await resolveUserFamily(openid);
  if (!resolvedFamilyId) return { success: false, message: '您未加入家庭' };

  const familyId = event.familyId || resolvedFamilyId;
  if (familyId !== resolvedFamilyId) {
    return { success: false, message: '家庭信息不匹配，请刷新后重试' };
  }

  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const { robotWebhook, notifyEnabled, notifyTime } = event;
  const current = await ensureSettings(familyId);
  const nextSettings = {
    familyId,
    robotWebhook: robotWebhook !== undefined ? String(robotWebhook || '') : (current.robotWebhook || ''),
    notifyEnabled: notifyEnabled !== undefined ? notifyEnabled === true : current.notifyEnabled === true,
    notifyTime: notifyTime !== undefined ? (notifyTime || '08:00') : (current.notifyTime || '08:00'),
    lastNotifyDate: current.lastNotifyDate || '',
    lastNotifySentOn: current.lastNotifySentOn || '',
    updateTime: db.serverDate()
  };

  await db.collection('settings').doc(current._id).set({ data: nextSettings });
  const updatedRes = await db.collection('settings').doc(current._id).get();

  return { success: true, settings: updatedRes.data, message: '设置已保存' };
}

/** 更新宝宝信息 */
async function updateBaby(openid, event) {
  const { user, familyId: resolvedFamilyId } = await resolveUserFamily(openid);
  if (!resolvedFamilyId) return { success: false, message: '您未加入家庭' };

  const familyId = event.familyId || resolvedFamilyId;
  if (familyId !== resolvedFamilyId) {
    return { success: false, message: '家庭信息不匹配，请刷新后重试' };
  }

  const verify = await verifyFamilyMember(openid, familyId);
  if (!verify.valid) return { success: false, message: verify.message };

  const { babyName, babyBirth, babyAvatar } = event;
  if (babyName !== undefined && !String(babyName).trim()) {
    return { success: false, message: '请输入宝宝姓名' };
  }

  const updateData = {};
  if (babyName !== undefined) updateData.babyName = String(babyName).trim();
  if (babyBirth !== undefined) updateData.babyBirth = babyBirth || '';
  if (babyAvatar !== undefined) updateData.babyAvatar = babyAvatar || '';

  if (!Object.keys(updateData).length) {
    return { success: false, message: '没有可更新的内容' };
  }

  const oldAvatar = verify.family.babyAvatar;
  if (babyAvatar !== undefined && oldAvatar && oldAvatar !== babyAvatar) {
    try {
      await cloud.deleteFile({ fileList: [oldAvatar] });
    } catch (err) {
      console.warn('删除旧宝宝头像失败:', err);
    }
  }

  await db.collection('families').doc(verify.family._id).update({ data: updateData });
  const updatedRes = await db.collection('families').doc(verify.family._id).get();

  return {
    success: true,
    family: updatedRes.data,
    message: '宝宝信息已更新'
  };
}

/** 邀请码预览家庭信息（无需已是成员） */
async function previewFamily(event) {
  const code = String(event.inviteCode || '').toUpperCase().trim();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { success: false, message: '邀请码格式无效' };
  }

  const familyRes = await db.collection('families').where({ familyId: code }).limit(1).get();
  const family = familyRes.data[0];
  if (!family) {
    return { success: false, message: '邀请码无效或家庭不存在' };
  }

  let babyAvatarUrl = '';
  if (family.babyAvatar) {
    try {
      const urlRes = await cloud.getTempFileURL({
        fileList: [{ fileID: family.babyAvatar, maxAge: 3600 }]
      });
      const item = (urlRes.fileList || [])[0];
      if (item && item.status === 0) babyAvatarUrl = item.tempFileURL;
    } catch (err) {
      console.warn('预览头像解析失败:', err);
    }
  }

  return {
    success: true,
    preview: {
      familyId: family.familyId,
      babyName: family.babyName || '宝宝',
      babyBirth: family.babyBirth || '',
      memberCount: (family.members || []).length,
      babyAvatarUrl
    }
  };
}
