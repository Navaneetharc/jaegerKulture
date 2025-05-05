const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Refund = require('../../models/refundSchema');

const getMyOrdersPage = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);

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

    res.render("myOrders", {
      orders,
      user,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Error in getMyOrdersPage:", error);
    res.redirect('/admin/pageerror');
  }
};


const getOrderDetails = async (req, res) => {
    try {
        const user = await User.findById(req.session.user);
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

        res.render("orderDetails", { order, user });
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

        if (!order.statusHistory) {
            order.statusHistory = [];
        }

        order.status = 'Cancelled';
        order.cancelReason = cancelReason;

        order.statusHistory.push({
            status: 'Cancelled',
            date: new Date(),
            reason: cancelReason,
        });

        await order.save();

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








