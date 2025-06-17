// In coupons.js
const Coupon = require('../models/couponSchema');

const applyCoupon = async (userId, code, subTotal, consume = false) => {
  if (!code) return { discount: 0, message: null };

  const now = new Date();
  const coupon = await Coupon.findOne({
    code,
    status: 'Active',
    startDate: { $lte: now },
    expiryDate: { $gte: now },
    minPrice: { $lte: subTotal }
  });
  if (!coupon) return { discount: 0, message: 'Invalid or expired coupon' };

  if (coupon.usageType === 'single-use' && coupon.usersUsed.includes(userId)) {
    return { discount: 0, message: 'You have already used this coupon' };
  }

  // compute discount
  let discount = 0;
  if (coupon.offerPrice < 100) {
    discount = Math.floor(subTotal * (coupon.offerPrice / 100));
    if (coupon.code === 'WELCOME20' && discount > 200) {
      discount = 200;
    }
  } else {
    discount = coupon.offerPrice;
  }

  // Only mutate/save if consume=true
  if (consume) {
    console.log(`[Coupon] Consuming coupon ${code} for user ${userId}`)
    console.log('[Coupon] saved, used count is now', coupon.used);
    coupon.used = (coupon.used || 0) + 1;
    if (!coupon.usersUsed.includes(userId)) {
      coupon.usersUsed.push(userId);
    }
    await coupon.save();
  }

  return { discount, message: 'Coupon applied successfully' };
};

module.exports = { applyCoupon };
