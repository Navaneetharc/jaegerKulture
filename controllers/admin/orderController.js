const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Refund = require('../../models/refundSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');





const getOrderManagement = async (req, res) => {
  try {
    const page    = parseInt(req.query.page) || 1;
    const limit   = 10;
    const skip    = (page - 1) * limit;
    const search  = req.query.search?.trim();

    let query = {};

    if (search) {
      const users = await User.find({
        $or: [
          { name:  { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(user => user._id);

      query = {
        $or: [
          { orderId: { $regex: search, $options: 'i' } },
          { userId:  { $in: userIds } }
        ]
      };
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages  = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId')
      .populate('orderItems.product')
      .populate('address.addressDocId');

    const baseUrl = req.baseUrl + req.path;

    res.render('orderManagement', {
      orders,
      currentPage: page,
      totalPages,
      baseUrl,
      search
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};



const getOrderDetails = async (req, res) => {
  try {
    const id = req.query.id;
    const order = await Order.findById(id)
      .populate('userId')
      .populate('orderItems.product')
      .populate('address.addressDocId');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const refunds = await Refund.find({
      order: id,
      status: 'Requested'
    }).populate('product');

    const displayOrder = JSON.parse(JSON.stringify(order));

    const productsWithRefunds = refunds.map(refund => refund.product._id.toString());


    if (order.status === 'Return Requested' || refunds.length > 0) {
      displayOrder.status = 'Delivered';

      const itemsForReturn = order.orderItems.filter(item => {
        const pid = item.product._id.toString();
        const isReturned   = item.currentStatus === 'Returned';
        const isReturnReq  = item.currentStatus === 'Return Requested';
        const hasRefundReq = productsWithRefunds.includes(pid);

        return isReturned || isReturnReq || hasRefundReq;
      });


      if (itemsForReturn.length > 0) {
        displayOrder.returnRequest = {
          status: 'Pending',
          reason: order.cancelReason || 'Return requested',
          items: itemsForReturn.map(item => ({
            product: item.product,
            quantity: item.quantity,
            variant: item.variant,
            productImage: item.productImage,
            status: item.currentStatus === 'Returned' 
              ? 'Returned & Refunded' 
              : 'Return Requested'
          })),
          _id: order._id
        };


        if (displayOrder.returnRequest.items.length === 0) {
          console.log('No items in return request after mapping!');
        }
      } else {
        displayOrder.returnRequest = { status: null, items: [], _id: order._id };
        console.log('No items found for return!');
      }
    } else {
      displayOrder.returnRequest = { status: null, items: [], _id: order._id };
      console.log('No return requests found for this order');
    }

    

    res.render('adminOrderDetails', { order: displayOrder, refunds });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/pageerror');
  }
};


const getOrderTracking = async (req, res) => {
    try {
        const id = req.params.id;
        const order = await Order.findById(id)
            .populate('userId')
            .populate('orderItems.product')
            .populate('address.addressDocId');

        res.render('orderTracking', { order });
    } catch (error) {
        console.error(error);
        res.redirect('admin/pageerror');
    }
};

const updateOrderStatus = async (req, res) => {
  try {
      const { orderId, newStatus } = req.body;

      const allowed = [
          'Pending',
          'Order Placed',
          'Order Confirmed',
          'Order Shipped',
          'Delivered',
          'Returned',
          'Payment Failed',
          'Return Requested'
      ];
      if (!allowed.includes(newStatus)) {
          return res.status(400).send('Invalid status');
      }

      const order = await Order.findById(orderId);
      if (!order) {
          return res.status(404).send('Order not found');
      }

      order.status = newStatus;

      order.orderItems.forEach(item => {
          item.currentStatus = newStatus;

          if (!Array.isArray(item.statusHistory)) {
              item.statusHistory = [];
          }

          const lastEntry = item.statusHistory[item.statusHistory.length - 1];
          if (!lastEntry || lastEntry.status !== newStatus) {
              item.statusHistory.push({
                  status: newStatus,
                  timestamp: new Date()
              });
          }
      });

      await order.save();
      res.redirect(`/admin/orderDetails?id=${orderId}`);
  } catch (error) {
      console.error('Error updating order status:', error);
      res.redirect('/admin/pageerror');
  }
};

const approveReturns = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send('Order not found');

    console.log(`Processing return approval for order ${orderId}`);

    const refunds = await Refund.find({
      order: orderId,
      status: 'Requested'
    });

    if (refunds.length === 0) {
      return res.redirect(`/admin/orderDetails?id=${orderId}`);
    }

    const returnedItemIds = refunds.map(r => r.itemId.toString());

    let refundAmount = 0;

    for (const item of order.orderItems) {
      const itemIdStr = item._id.toString();
      if (!returnedItemIds.includes(itemIdStr)) continue;

      item.currentStatus = 'Returned';
      if (!item.statusHistory) item.statusHistory = [];
      item.statusHistory.push({
        status: 'Returned',
        timestamp: new Date()
      });

      const itemRefund = (item.price || 0) * (item.quantity || 1);
      refundAmount += itemRefund;

      const sizeKey = item.variant?.size;
      if (sizeKey) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { [`variant.size.${sizeKey}`]: item.quantity }
        });
      }
    }

    const totalItems   = order.orderItems.length;
    const returnedCount = order.orderItems.filter(i => i.currentStatus === 'Returned').length;

    if (returnedCount === totalItems) {
      order.status = 'Returned';
    } else if (returnedCount > 0) {
      order.status = 'Delivered';
    }

    await order.save();

    if (refundAmount > 0) {
      const user = await User.findById(order.userId);
      if (user) {
        const oldBalance = user.wallet || 0;
        user.wallet = oldBalance + refundAmount;
        if (user.walletHistory) {
          user.walletHistory.push({
            type: 'credit',
            amount: refundAmount,
            description: `Refund for order ${order.orderId}`,
            date: new Date()
          });
        }
        await user.save();

        const addressToUse =
          await Address.findOne({ userId: user._id, isDefault: true }) ||
          await Address.findOne({ userId: user._id });

        if (!addressToUse) {
          console.warn(`No address found for this user ${user._id}`);
        } else {
          await Wallet.create({
            userId: user._id,
            address: {
              addressDocId: addressToUse._id,
              addressDetailId: addressToUse.addressDetailId || addressToUse._id
            },
            amount: refundAmount,
            transactionId: `REF${order._id}-${Date.now().toString().slice(-6)}`,
            payment_type: 'refund',
            entryType: 'CREDIT',
            type: 'refund',
            orderId: order._id
          });
        }
      }
    }

    await Refund.updateMany(
      { order: orderId, status: 'Requested', itemId: { $in: returnedItemIds } },
      { status: 'Approved' }
    );

    res.redirect(`/admin/orderDetails?id=${orderId}`);
  } catch (error) {
    console.error('Error approving returns:', error);
    res.redirect('/admin/pageerror');
  }
};

const rejectReturns = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send('Order not found');

    const refunds = await Refund.find({ 
      order: orderId,
      status: 'Requested'
    });
    
    const returnedProductIds = refunds.map(refund => refund.product._id.toString());

    order.orderItems.forEach(item => {
      if (item.currentStatus === 'Return Requested' ||
          returnedProductIds.includes(item.product.toString())) {
        item.currentStatus = 'Delivered';
        item.statusHistory = item.statusHistory || [];
        item.statusHistory.push({ status: 'Delivered', timestamp: new Date() });
      }
    });
    
    const anyPendingReturns = order.orderItems.some(item => 
      item.currentStatus === 'Return Requested'
    );

    if (anyPendingReturns) {
      order.status = 'Return Requested';
    } else {
      order.status = 'Delivered';
    }
     
    await order.save();

    await Refund.updateMany(
      { order: orderId, status: 'Requested', product: { $in: returnedProductIds } }, 
      { status: 'Rejected' }
    );

    res.redirect(`/admin/orderDetails?id=${orderId}`);
  } catch (error) {
    console.error('Error rejecting returns:', error);
    res.redirect('/admin/pageerror');
  }
};


module.exports = {
    getOrderManagement,
    getOrderDetails,
    getOrderTracking,
    updateOrderStatus,
    approveReturns,
    rejectReturns,
};

