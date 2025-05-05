const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const User   = require('../../models/userSchema');

const getMyWalletPage = async (req, res) => {
  try {
    const userIdRaw = req.user._id;
    console.log('Fetching wallet for userId:', userIdRaw);

    const userId = typeof userIdRaw === 'string'
      ? mongoose.Types.ObjectId(userIdRaw)
      : userIdRaw;

    const balance = req.user.wallet ?? 0;

    const transactions = await Wallet
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    console.log('Transactions fetched:', transactions);

    res.render('myWallet', { balance, transactions });
  } catch (error) {
    console.error('Error rendering wallet page:', error);
    res.redirect('/pageNotFound');
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

