var loyaltyService = require('../services/loyalty.service');
var loyaltyRewardService = require('../services/loyalty-reward.service');

async function getConfig(req, res, next) {
  try {
    var result = await loyaltyService.getConfig(req.user, req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updateConfig(req, res, next) {
  try {
    var result = await loyaltyService.updateConfig(req.body || {}, req.user, req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getRewards(req, res, next) {
  try {
    var result = await loyaltyRewardService.getRewards(req.user, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function createReward(req, res, next) {
  try {
    var result = await loyaltyRewardService.createReward(req.body || {}, req.user, req.query || {});
    res.status(201).json({
      success: true,
      message: 'Tạo gói phần thưởng đổi điểm thành công.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateReward(req, res, next) {
  try {
    var result = await loyaltyRewardService.updateReward(req.params.id, req.body || {}, req.user);
    res.json({
      success: true,
      message: 'Cập nhật thông tin phần thưởng thành công.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function deleteReward(req, res, next) {
  try {
    await loyaltyRewardService.deleteReward(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Gói phần thưởng đã được ngưng áp dụng thành công.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getConfig: getConfig,
  updateConfig: updateConfig,
  getRewards: getRewards,
  createReward: createReward,
  updateReward: updateReward,
  deleteReward: deleteReward
};
