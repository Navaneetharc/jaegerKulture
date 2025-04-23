const Address = require('../../models/addressSchema'); 
const Cart    = require('../../models/cartSchema');
const Order   = require('../../models/orderSchema');
const User    = require('../../models/userSchema');
const mongoose = require('mongoose');



const getCheckoutPage = async (req, res, next) => {
    try {
      const userId = req.user._id;
      const addressDoc = await Address.findOne({ userId }).lean();
      const addresses  = addressDoc?.details || [];
  
      const cart = await Cart
        .findOne({ userId })
        .populate('items.productId')
        .lean();
  
      const items = cart?.items || [];
      if (!items.length) {
        return res.redirect('/cart');
      }
  
      res.render('checkout', {
        user: req.user,
        addresses,
        items
      });
    } catch (err) {
      next(err);
    }
  };



  const placeOrder = async (req, res, next) => {
    try {
      const userId = req.user._id;
      const { selectedAddress } = req.body;
  
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) {
        return res.redirect('/checkout?error=address-not-found');
      }
  
      const addressDetail = addressDoc.details.id(selectedAddress);

      console.log('Selected Address:', selectedAddress);


      if (!addressDetail) {
        return res.redirect('/checkout?error=address-not-found');
      }
  
      const cart = await Cart
        .findOne({ userId })
        .populate('items.productId');
  
      if (!cart || !cart.items.length) {
        return res.redirect('/cart?error=empty-cart');
      }
  
      const orderItems = cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        basePrice: item.basePrice,
        price: item.price,
        variant: { size: item.variants.size },
        productImage: item.productImage || item.productId.images[0],
        currentStatus: 'Pending',
        statusHistory: [{ status: 'Pending', timestamp: new Date() }],
      }));
  
      // Calculate pricing
      const subTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const deliveryCharge = 41;
      const tax = subTotal * 0.05;
      const discount = 0;
      const totalAmount = subTotal - discount + deliveryCharge + tax;

                   
  
      // Create the order
      await Order.create({
        orderId: '#JK'+ Math.floor(Math.random() * 1e9).toString(),
        userId,
        orderItems,
        address: {
          addressDocId: addressDoc._id,
          addressDetailId: addressDetail._id
        },
        paymentMethod: 'cod',
        paymentStatus: 'Pending',
        coupon: discount,
        subTotal,
        deliveryCharge,
        tax,
        totalAmount,
        status: 'Pending'
      });
  
      // Clear the cart
      await Cart.deleteOne({ userId });
  
      res.redirect('/order-success');
    } catch (err) {
      console.error('Error placing order:', err);
      next(err);
    }
  };

  
  const loadOrderSuccess = async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);
      
      const latestOrder = await Order.findOne({ userId })
        .sort({ createdAt: -1 }) 
        .populate('orderItems.product') 
        .populate('address.addressDocId'); 
      
      if (!latestOrder) {
        return res.redirect('/orders?error=no-order-found');
      }
  
      let subtotal = 0;
      latestOrder.orderItems.forEach(item => {
        subtotal += item.price * item.quantity;  
      });
  
      const addressDoc = latestOrder.address.addressDocId;
      
      const addressDetail = addressDoc.details.find(detail => 
        detail._id.toString() === latestOrder.address.addressDetailId.toString()
      );
  
      if (!addressDetail) {
        return res.redirect('/orders?error=address-not-found');
      }
  
  
      res.render('orderSuccess', {
        order: latestOrder,
        address: addressDetail,
        email: user.email,
        subtotal: subtotal,  
      });
  
    } catch (error) {
      console.error(error);
      res.redirect('/pageNotFound');
    }
  };
  
module.exports = {
    getCheckoutPage,
    placeOrder,
    loadOrderSuccess,
}