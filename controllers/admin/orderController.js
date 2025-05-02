const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Refund = require('../../models/refundSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');



const getOrderManagement = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId')
            .sort({ createdAt: -1 })
            .populate('orderItems.product')
            .populate('address.addressDocId');

        res.render('orderManagement', { orders });
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

    // Find return/refund info
    const refunds = await Refund.find({
      order: id,
      status: 'Requested'
    }).populate('product');

    // Prepare a separate display object to avoid mutating the original order
    const displayOrder = JSON.parse(JSON.stringify(order));

    // Get IDs of products with refund requests
    const productsWithRefunds = refunds.map(refund => refund.product._id.toString());
    
    console.log('Products with refund requests:', productsWithRefunds);

    // If we have items with return requests, set up the returnRequest object
    if (order.status === 'Return Requested' || refunds.length > 0) {
      // Mark the display order as "Delivered" for UI purposes
      displayOrder.status = 'Delivered';
      
      // Filter items that have "Return Requested" status OR have a refund request
      const itemsForReturn = order.orderItems.filter(item => {
        const isReturnRequested = item.currentStatus === 'Return Requested';
        const hasRefundRequest = productsWithRefunds.includes(item.product._id.toString());
        
        console.log(`Item ${item.product._id} - Return Requested: ${isReturnRequested}, Has Refund: ${hasRefundRequest}`);
        
        return isReturnRequested || hasRefundRequest;
      });
      
      console.log('Filtered items for return:', itemsForReturn.length);
      
      if (itemsForReturn.length > 0) {
        displayOrder.returnRequest = {
          status: 'Pending',
          reason: order.cancelReason || 'Return requested',
          // Only include items marked for return
          items: itemsForReturn.map(item => ({
            product: item.product,
            quantity: item.quantity,
            variant: item.variant,
            productImage: item.productImage
          })),
          _id: order._id
        };
        
        console.log('Return request items count:', displayOrder.returnRequest.items.length);
        
        // Ensure we're only showing items that are actually requested for return
        if (displayOrder.returnRequest.items.length === 0) {
          console.log('No items in return request after mapping!');
        }
      } else {
        // No items actually requested for return
        displayOrder.returnRequest = { status: null, items: [], _id: order._id };
        console.log('No items found for return!');
      }
    } else {
      // No return requests at all
      displayOrder.returnRequest = { status: null, items: [], _id: order._id };
      console.log('No return requests found for this order');
    }

    console.log('Original status:', order.status);
    console.log('Rendered status:', displayOrder.status);
    console.log('Return request status:', displayOrder.returnRequest.status);
    console.log('Items in return request:', displayOrder.returnRequest?.items?.length || 0);

    // Render view with the display copy, leaving the original untouched
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

      // Updated allowed statuses to include 'Return Requested'
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

      // Update the top-level order status
      order.status = newStatus;

      // For each order item, update currentStatus and push history only if different
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

    // Find all refunds for this order that are in "Requested" status
    const refunds = await Refund.find({ 
      order: orderId,
      status: 'Requested'
    }).populate('product');

    // If no refund requests, nothing to do
    if (refunds.length === 0) {
      console.log('No refund requests found for this order');
      return res.redirect(`/admin/orderDetails?id=${orderId}`);
    }

    // Get IDs of products being returned
    const returnedProductIds = refunds.map(refund => refund.product._id.toString());
    console.log('Products to return:', returnedProductIds);

    let refundAmount = 0;
    let itemsProcessedForReturn = 0;
    
    // Process each item in the order
   // Process each returned item AND increase stock
   for (const item of order.orderItems) {
        const pid = item.product.toString();
        if (!returnedProductIds.includes(pid)) continue;
  
        // 1) mark the item as Returned (keeps your existing logic)
        item.currentStatus = 'Returned';
        if (!item.statusHistory) item.statusHistory = [];
        item.statusHistory.push({ status: 'Returned', timestamp: new Date() });
  
        // 2) refund amount
        const itemRefund = (item.price || 0) * (item.quantity || 1);
        refundAmount += itemRefund;
  
        // 3) increase stock for that variant size
        const sizeKey = item.variant?.size;
        if (sizeKey) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { [`variant.size.${sizeKey}`]: item.quantity }
          });
        }
      }
  

    console.log(`Total refund amount: ${refundAmount}`);
    console.log(`Processed ${itemsProcessedForReturn} items for return`);

    // Count different statuses to determine overall order status
    const itemStatusCounts = {
      Returned: 0,
      'Return Requested': 0,
      Delivered: 0,
      Other: 0
    };

    order.orderItems.forEach(item => {
      if (itemStatusCounts[item.currentStatus] !== undefined) {
        itemStatusCounts[item.currentStatus]++;
      } else {
        itemStatusCounts.Other++;
      }
    });

    console.log('Item status counts:', itemStatusCounts);

    // Determine the overall order status based on item statuses
    if (itemStatusCounts.Returned === order.orderItems.length) {
      // All items returned
      order.status = 'Returned';
      console.log('All items returned - setting order status to Returned');
    } else if (itemStatusCounts['Return Requested'] > 0) {
      // Some items still have pending return requests
      order.status = 'Return Requested';
      console.log('Some pending returns - keeping order status as Return Requested');
    } else if (itemStatusCounts.Returned > 0 && itemStatusCounts.Delivered > 0) {
      // Mix of returned and delivered items - partial return
      order.status = 'Delivered';
      console.log('Partial return processed - setting order status to Delivered');
    }
    
    await order.save();
    console.log(`Updated order ${orderId} with new statuses`);

    // Process refund if there's an amount to refund
    if (refundAmount > 0) {
      const user = await User.findById(order.userId);
      if (user) {
        console.log(`Processing refund of ${refundAmount} for user ${user._id}`);
        
        // Update user balance
        const oldBalance = user.wallet || 0;
        user.wallet = oldBalance + refundAmount;
        
        // Add wallet history entry if schema supports it
        if (user.walletHistory) {
          user.walletHistory.push({
            type: 'credit',
            amount: refundAmount,
            description: `Refund for order ${order.orderId}`,
            date: new Date()
          });
        }
        
        await user.save();
        console.log(`Updated user wallet from ${oldBalance} to ${user.wallet}`);

        // Find user's default address for the wallet record
        const userAddress = await Address.findOne({ userId: user._id, isDefault: true });
        
        // If no default address exists, get any address associated with the user
        const addressToUse = userAddress || await Address.findOne({ userId: user._id });
        
        if (!addressToUse) {
          console.warn(`No address found for user ${user._id}. Cannot process refund.`);
          return res.status(400).send('User has no address. Cannot process refund.');
        }

        console.log(`Creating wallet transaction for refund`);
        // Create transaction record
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

    // Update the refund documents to Approved status
    const updateResult = await Refund.updateMany(
      { order: orderId, status: 'Requested', product: { $in: returnedProductIds } }, 
      { status: 'Approved' }
    );
    console.log(`Updated ${updateResult.modifiedCount} refund requests to Approved`);

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

    // Find refunds for this order
    const refunds = await Refund.find({ 
      order: orderId,
      status: 'Requested'
    });
    
    // Get IDs of products being returned
    const returnedProductIds = refunds.map(refund => refund.product._id.toString());

    // Revert status only for items that were marked for return
    order.orderItems.forEach(item => {
      if (item.currentStatus === 'Return Requested' ||
          returnedProductIds.includes(item.product.toString())) {
        item.currentStatus = 'Delivered';
        item.statusHistory = item.statusHistory || [];
        item.statusHistory.push({ status: 'Delivered', timestamp: new Date() });
      }
    });
    
    // Check if any items are still in "Return Requested" status
    const anyPendingReturns = order.orderItems.some(item => 
      item.currentStatus === 'Return Requested'
    );

    // Update order status
    if (anyPendingReturns) {
      // If there are still pending return requests
      order.status = 'Return Requested';
    } else {
      // No more pending returns, all items are either delivered or returned
      order.status = 'Delivered';
    }
    
    await order.save();

    // Only update the specific refund requests that were processed
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

// const Order = require('../../models/orderSchema');
// const User = require('../../models/userSchema'); 

// const getOrderManagement = async (req, res) => {
//   try {
//     const orders = await Order.find()
//       .populate('userId') 
//       .sort({ createdAt: -1 })
//       .populate('orderItems.product') 
//       .populate('address.addressDocId'); 

//     res.render('orderManagement', { orders });

//   } catch (error) {
//     console.error(error);
//     res.redirect("/pageerror");
//   }
// };

// const getOrderDetails = async (req,res) => {
//     try {
//         const id = req.query.id;
//         const order = await Order.findOne({ _id: id })

//         .populate('userId')
//         .populate('orderItems.product')
//         .populate('address.addressDocId');

//         res.render('adminOrderDetails',{ order });
//     } catch (error) {
//         res.redirect('/admin/pageerror');
//     }
// }

//   const getOrderTracking = async (req,res) => {
//     try {
//       const id = req.params.id;
//         const order = await Order.findOne({ _id: id })

//         .populate('userId')
//         .populate('orderItems.product')
//         .populate('address.addressDocId');

//       res.render('orderTracking',{ order });
//     } catch (error) {
//       res.redirect('admin/pageerror');
//     }
//   }

//   const updateOrderStatus = async (req, res) => {
//     try {
//       const { orderId, newStatus } = req.body;
  
//       // Only these statuses are allowed (excluding “Cancelled”)
//       const allowed = [
//         'Pending',
//         'Order Placed',
//         'Order Confirmed',
//         'Order Shipped',
//         'Delivered',
//         'Returned',
//         'Payment Failed'
//       ];
//       if (!allowed.includes(newStatus)) {
//         return res.status(400).send('Invalid status');
//       }
  
//       const order = await Order.findById(orderId);
//       if (!order) {
//         return res.status(404).send('Order not found');
//       }
  
//       // 1) Update the top-level order status
//       order.status = newStatus;
  
//       // 2) For each order item, update currentStatus and push history only if different
//       order.orderItems.forEach(item => {
//         // Always update currentStatus
//         item.currentStatus = newStatus;
  
//         // Ensure statusHistory is an array
//         if (!Array.isArray(item.statusHistory)) {
//           item.statusHistory = [];
//         }
  
//         // Grab last history entry (if any)
//         const lastEntry = item.statusHistory[item.statusHistory.length - 1];
  
//         // Only push a new entry if it’s not already the same status
//         if (!lastEntry || lastEntry.status !== newStatus) {
//           item.statusHistory.push({
//             status: newStatus,
//             timestamp: new Date()
//           });
//         }
//       });
  
//       await order.save();
//       res.redirect(`/admin/orderDetails?id=${orderId}`);
//     } catch (error) {
//       console.error('Error updating order status:', error);
//       res.redirect('/admin/pageerror');
//     }
//   };
  
  

// module.exports = {
//   getOrderManagement,
//   getOrderDetails,
//   getOrderTracking,
//   updateOrderStatus,
// };


