const mongoose = require("mongoose");
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Refund = require('../../models/refundSchema');
const Wallet   = require('../../models/walletSchema');

const getMyOrdersPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId: user._id });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('orderItems.product')
      .populate('address.addressDocId');

      let cart = await Cart
                    .findOne({ userId })
                    .populate('items.productId');
              
                  const items = cart?.items || [];
      
                  let wishlistCount = 0;
      
                  if (userId) {
                      const wishlist = await Wishlist.findOne({ userId });
                      wishlistCount = wishlist ? wishlist.products.length : 0;
                  }  

    res.render("myOrders", {
      orders,
      user,
      currentPage: page,
      totalPages,
      items,
      wishlistCount
    });
  } catch (error) {
    console.error("Error in getMyOrdersPage:", error);
    res.redirect('/admin/pageerror');
  }
};


const getOrderDetails = async (req, res) => {
    try {
        const user = await User.findById(req.session.user);
        const userId = req.user._id;
        const id = req.params.id;

        const order = await Order.findById(id)
            .populate('userId')
            .populate('orderItems.product')             
            .populate('address.addressDocId')
            .populate('address.addressDetailId');

        if (!order) {
            return res.status(404).render('notFound');
        }

        order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];

        let cart = await Cart
                      .findOne({ userId })
                      .populate('items.productId');
                
                    const items = cart?.items || [];
        
                    let wishlistCount = 0;
        
                    if (userId) {
                        const wishlist = await Wishlist.findOne({ userId });
                        wishlistCount = wishlist ? wishlist.products.length : 0;
                    }  

        res.render("orderDetails", { order, user , items, wishlistCount});
    } catch (error) {
        console.error("Error in getOrderDetails:", error);
        res.redirect('/admin/pageerror');
    }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancelReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).render('notFound');
    }

    order.status = 'Cancelled';
    order.cancelReason = cancelReason;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date(),
      reason: cancelReason
    });
    await order.save();

    const paymentMethod = (order.paymentMethod || '').toLowerCase();
    if (paymentMethod !== 'cod' && order.paymentStatus === 'Paid') {
      const userId = order.userId;
      const refundAmount = order.totalAmount || order.walletAmountUsed || 0;

      await new Wallet({
        userId:        userId,
        transactionId: `REFUND-${Date.now()}`,
        payment_type:  'refund',
        amount:        refundAmount,
        status:        'completed',
        entryType:     'CREDIT',
        type:          'refund',
        orderId:       order._id
      }).save();

      await User.findByIdAndUpdate(userId, {
        $inc: { wallet: refundAmount },
        $push: {
          walletHistory: {
            type:        'credit',
            amount:      refundAmount,
            description: `Refund for cancelled order #${order._id}`
          }
        }
      });
    }

    res.redirect(`/orderDetails/${orderId}`);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.redirect('/admin/pageerror');
  }
};




const returnFullOrder = async (req, res) => {
    try {
      const orderId = req.params.id;
      const { returnReason, otherReason } = req.body;
  
      const order = await Order.findById(orderId).populate('orderItems.product');
  
      if (!order) {
        return res.status(404).render('notFound');
      }
  
      const reason = returnReason === 'Other' ? otherReason : returnReason;
  
      for (const item of order.orderItems) {
        item.currentStatus = 'Return Requested';
        item.cancelReason = reason;
  
        if (!item.statusHistory) item.statusHistory = [];
  
        item.statusHistory.push({
          status: 'Return Requested',
          timestamp: new Date()
        });
  
        await new Refund({
          order: order._id,
          itemId: item._id, 
          product: item.product._id,
          userId: order.userId,
          reason: reason,
          status: 'Requested',
          variantSize: item.variant?.size || 'N/A'
        }).save();
      }
  
      order.status = 'Return Requested';
      order.cancelReason = reason;
      await order.save();
  
      res.redirect(`/orderDetails/${orderId}`);
    } catch (error) {
      console.error('Error in returnFullOrder:', error);
      res.redirect('/admin/pageerror');
    }
  };
  

  const returnSelectedItems = async (req, res) => {
    try {
      const orderId = req.params.id;
      const { returnItems, returnReason, otherReason } = req.body;
  
      const order = await Order.findById(orderId).populate('orderItems.product');
  
      if (!order) {
        return res.status(404).render('notFound');
      }
  
      if (!returnItems || returnItems.length === 0) {
        return res.redirect(`/orderDetails/${orderId}`);
      }
  
      const reason = returnReason === 'Other' ? otherReason : returnReason;
  
      for (const item of order.orderItems) {
        if (returnItems.includes(item._id.toString())) {
          item.currentStatus = 'Return Requested';
          item.cancelReason = reason;
  
          if (!item.statusHistory) item.statusHistory = [];
  
          item.statusHistory.push({
            status: 'Return Requested',
            timestamp: new Date()
          });
  
          await new Refund({
            order: order._id,
            itemId: item._id, 
            product: item.product._id,
            userId: order.userId,
            reason: reason,
            status: 'Requested',
            variantSize: item.variant?.size || 'N/A'
          }).save();
        }
      }
  
      order.status = 'Return Requested';
      order.cancelReason = reason;
      await order.save();
  
      res.redirect(`/orderDetails/${orderId}`);
    } catch (error) {
      console.error('Error in returnSelectedItems:', error);
      res.redirect('/admin/pageerror');
    }
  };
  

module.exports = {
    getMyOrdersPage,
    getOrderDetails,
    cancelOrder,
    returnFullOrder,
    returnSelectedItems,
};








