// 云函数：login - 获取用户 openid，判断是否已有家庭
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickName, avatarUrl } = event;

  try {
    // 查询用户是否已存在
    const userRes = await db.collection('users').where({ _openid: openid }).get();
    let user = userRes.data.find((u) => u.familyId) || userRes.data[0];

    if (!user) {
      // 新用户，创建记录
      const newUser = {
        _openid: openid,
        nickName: nickName || '微信用户',
        avatarUrl: avatarUrl || '',
        familyId: '',
        role: '',
        createTime: db.serverDate()
      };
      const addRes = await db.collection('users').add({ data: newUser });
      user = { _id: addRes._id, _openid: openid, ...newUser };
    } else if (nickName || avatarUrl) {
      // 更新昵称头像
      const updateData = {};
      if (nickName) updateData.nickName = nickName;
      if (avatarUrl) updateData.avatarUrl = avatarUrl;
      await db.collection('users').doc(user._id).update({ data: updateData });
      user = { ...user, ...updateData };
    }

    let family = null;
    let settings = null;
    const hasFamily = !!user.familyId;

    if (hasFamily) {
      const familyRes = await db.collection('families')
        .where({ familyId: user.familyId })
        .limit(1)
        .get();
      family = familyRes.data[0] || null;

      const settingsRes = await db.collection('settings')
        .where({ familyId: user.familyId })
        .limit(1)
        .get();
      settings = settingsRes.data[0] || null;
    }

    return {
      success: true,
      openid,
      user,
      family,
      settings,
      hasFamily
    };
  } catch (err) {
    console.error('login 错误:', err);
    return { success: false, message: err.message || '登录失败' };
  }
};
