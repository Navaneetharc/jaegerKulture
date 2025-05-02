const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Refund = require('../../models/refundSchema');

// Fetch all orders of the user
const getMyOrdersPage = async (req, res) => {
    try {
        const user = await User.findById(req.session.user);
        const orders = await Order.find({ userId: user._id })  // Only fetch user's own orders
            .sort({ createdAt: -1 })
            .populate('orderItems.product')
            .populate('address.addressDocId');
        res.render("myOrders", { orders, user });
    } catch (error) {
        console.error("Error in getMyOrdersPage:", error);
        res.redirect('/admin/pageerror');
    }
};

// Fetch details of a specific order
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

// Cancel an order
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

// Handle returning the entire order
const returnFullOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { returnReason, otherReason } = req.body;

        const order = await Order.findById(orderId).populate('orderItems.product');

        if (!order) {
            return res.status(404).render('notFound');
        }

        const reason = returnReason === 'Other' ? otherReason : returnReason;

        // Set return marker on all order items
        order.orderItems.forEach(item => {
            item.currentStatus = 'Return Requested';
            item.cancelReason = reason;
            
            // Ensure statusHistory array exists
            if (!item.statusHistory) item.statusHistory = [];
            
            // Add status history entry
            item.statusHistory.push({
                status: 'Return Requested',
                timestamp: new Date()
            });
        });

        // Create Refund documents for all items
        for (const item of order.orderItems) {
            const refund = new Refund({
                order: order._id,
                product: item.product._id,
                userId: order.userId,
                reason: reason,
                status: 'Requested',
                variantSize: item.variant?.size || 'N/A'
            });
            await refund.save();
        }

        // Update order status
        order.status = 'Return Requested';
        order.cancelReason = reason;
        await order.save();

        res.redirect(`/orderDetails/${orderId}`);
    } catch (error) {
        console.error('Error in returnFullOrder:', error);
        res.redirect('/admin/pageerror');
    }
};

// Handle returning selected items
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

        // Mark only selected items for return
        order.orderItems.forEach(item => {
            // Check if this item is in the return list
            if (returnItems.includes(item._id.toString())) {
                item.currentStatus = 'Return Requested';
                item.cancelReason = reason;
                
                // Ensure statusHistory array exists
                if (!item.statusHistory) item.statusHistory = [];
                
                // Add status history entry
                item.statusHistory.push({
                    status: 'Return Requested',
                    timestamp: new Date()
                });
            }
        });

        // Create Refund documents only for selected items
        for (const itemId of returnItems) {
            const item = order.orderItems.find(i => i._id.toString() === itemId);
            if (item) {
                const refund = new Refund({
                    order: order._id,
                    product: item.product._id,
                    userId: order.userId,
                    reason: reason,
                    status: 'Requested',
                    variantSize: item.variant?.size || 'N/A'
                });
                await refund.save();
            }
        }

        // We set the whole order status to Return Requested
        // But we'll track individual item status separately
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









// const Order = require('../../models/orderSchema');
// const User = require('../../models/userSchema');

// const getMyOrdersPage = async (req, res) => {
//     try {
//         const user = await User.findById(req.session.user);
//         const orders = await Order.find()
//               .populate('userId') 
//               .sort({ createdAt: -1 })
//               .populate('orderItems.product')
//               .populate('address.addressDocId');
//         // console.log("User in session:", req.session.user);
//         res.render("myOrders",{ orders, user});
//     } catch (error) {
//         res.redirect('/admin/pageerror');
//     }
// };

// const getOrderDetails = async (req, res) => {
//   try {
//       const user = await User.findById(req.session.user);
//       const id = req.params.id;

//       const order = await Order.findById(id)
//           .populate('userId')
//           .populate('orderItems.product')
//           .populate('address.addressDocId')
//           .populate('address.addressDetailId');

//       if (!order) {
//           return res.status(404).render('notFound');
//       }

//       order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];

//       // Pass orderItems but no need to loop over them
//       res.render("orderDetails", { order, user });
//   } catch (error) {
//       console.error("Error in getOrderDetails:", error);
//       res.redirect('/admin/pageerror');
//   }
// };



// const cancelOrder = async (req, res) => {
//   try {
//       const orderId = req.params.id;
//       const { cancelReason } = req.body;

//       // Find the order by ID
//       const order = await Order.findById(orderId);

//       if (!order) {
//           return res.status(404).render('notFound');
//       }

//       // Ensure the statusHistory array exists
//       if (!order.statusHistory) {
//           order.statusHistory = [];  // Initialize the array if it doesn't exist
//       }

//       // Update the order's status to "Cancelled"
//       order.status = 'Cancelled';
//       order.cancelReason = cancelReason; // Save the cancellation reason

//       // Add a record to the status history (if needed)
//       order.statusHistory.push({
//           status: 'Cancelled',
//           date: new Date(),
//           reason: cancelReason,
//       });

//       // Save the updated order
//       await order.save();

//       // Redirect back to the order details page after cancelling
//       res.redirect(`/orderDetails/${orderId}`);
//   } catch (error) {
//       console.error('Error cancelling order:', error);
//       res.redirect('/admin/pageerror');
//   }
// };


// module.exports = {
//     getMyOrdersPage,
//     getOrderDetails,
//     cancelOrder,
// };
