const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const User   = require('../../models/userSchema');

const getMyWalletPage = async (req, res, next) => {
  try {

    const user = await User.findById(req.session.user);
    const userId = req.user._id;

    const transactions = await Wallet
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const agg = await Wallet.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: {
          _id: '$userId',
          credits: { $sum: { $cond: [ { $eq: ['$entryType','CREDIT'] }, '$amount', 0 ] } },
          debits:  { $sum: { $cond: [ { $eq: ['$entryType','DEBIT']  }, '$amount', 0 ] } }
      }}
    ]);
    const balance = (agg[0]?.credits || 0) - (agg[0]?.debits || 0);

    let cart = await Cart
                  .findOne({ userId })
                  .populate('items.productId');
            
                const items = cart?.items || [];
    
                let wishlistCount = 0;
    
                if (userId) {
                    const wishlist = await Wishlist.findOne({ userId });
                    wishlistCount = wishlist ? wishlist.products.length : 0;
                }  


    res.render('myWallet', {
      balance,
      transactions,
      user,
      items,
      wishlistCount
    });
  } catch (error) {
    console.error('Error rendering wallet page:', error);
    next(error);
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Wallet
      .find({ userId })
      .sort({ createdAt: -1 });
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const refundMoney = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      amount,
      orderId,
      transactionId,
      payment_type,
      address
    } = req.body;

    const txn = await Wallet.create({
      userId,
      amount,
      orderId,
      transactionId,
      payment_type,
      entryType: 'CREDIT',
      type: 'refund',
      address
    });

    await User.findByIdAndUpdate(userId, {
      $inc:  { wallet: amount },
      $push: { walletHistory: txn._id }
    });

    res.json({ success: true, transaction: txn });
  } catch (error) {
    console.error('Error refunding money:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getMyWalletPage,
  getWalletTransactions,
  refundMoney,
};

