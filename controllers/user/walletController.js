const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const User   = require('../../models/userSchema');


const getMyWalletPage = async (req,res,next)=>{
  try {
    const user = await User.findById(req.session.user);
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'all';

    let filterQuery = {userId};

    switch(filter){
      case 'added':
        filterQuery.$or = [
          {entryType: 'CREDIT', type: 'add_money'},
          {entryType: 'CREDIT', type: 'referral'}
        ];
        break;

        case 'spent':
          filterQuery.entryType = 'DEBIT';
          filterQuery.type = 'product_purchase';
          break;
        
        case 'refunded':
          filterQuery.entryType = 'CREDIT';
          filterQuery.type = 'refund';
          break;
        
        case 'referrals':
          filterQuery.entryType = 'CREDIT';
          filterQuery.type = 'referral';
          break;
        
        default:

        break;

      }

        const transactions = await Wallet
        .find(filterQuery)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .lean();

        const totalTransactions = await Wallet.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalTransactions / limit);

        const agg = await Wallet.aggregate([
          {$match: {userId: new mongoose.Types.ObjectId(userId)}},
          {
            $group:{
              _id: '$userId',
              credits: {$sum: {$cond: [{$eq: ['$entryType','CREDIT']}, '$amount',0]}},
              debits: {$sum: {$cond: [{ $eq: ['$entryType', 'DEBIT']}, '$amount',0]}}
            }
          }
        ]);

        const rawBalance = (agg[0]?.credits || 0) - (agg[0]?.debits || 0);
        const balance    = rawBalance < 0 ? 0 : rawBalance;

        const cart = await Cart.findOne({userId}).populate('items.productId');
        const items = cart?.items || [];

        let wishlistCount = 0;
        if(userId){
          const wishlist = await Wishlist.findOne({userId});
          wishlistCount = wishlist ? wishlist.products.length : 0;
        }

        const showPagination = totalTransactions > limit;

        res.render('myWallet',{
          balance,
          transactions,
          user,
          items,
          wishlistCount,
          currentPage: page,
          totalPages,
          currentFilter: filter,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page + 1,
          prevPage: page - 1,
          showPagination,
          totalTransactions
        });

  } catch (error) {

    console.error('Error rendering wallet page: ', error);
    next(error);
    
  }
}




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

