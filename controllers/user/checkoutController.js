const Address = require('../../models/addressSchema'); 
const Cart    = require('../../models/cartSchema');
const Order   = require('../../models/orderSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const razorpay = require('../../config/payments');
const crypto = require('crypto');
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

    const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const delivery = 41;
    const tax      = subTotal * 0.05;
    const total    = subTotal + delivery + tax;

    res.render('checkout', {
      user: req.user,
      addresses,
      items,
      total, 
      razorpayKey: process.env.RAZORPAY_KEY_ID 
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
  
      const subTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const deliveryCharge = 41;
      const tax = subTotal * 0.05;
      const discount = 0;
      const totalAmount = subTotal - discount + deliveryCharge + tax;
  
      await Order.create({
        orderId: '#JK' + Math.floor(Math.random() * 1e9).toString(),
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
  
      for (const item of cart.items) {
        const productId = item.productId._id;
        const size = item.variants.size.toLowerCase();
        const quantity = item.quantity;
      
        const product = await Product.findById(productId);
        if (!product) continue;
      
        if (
          product.variant &&
          product.variant.size &&
          typeof product.variant.size[size] === 'number'
        ) {
          product.variant.size[size] -= quantity;
          if (product.variant.size[size] < 0) {
            product.variant.size[size] = 0;
          }
      
          const allSizesZero = Object.values(product.variant.size).every(qty => qty === 0);
          if (allSizesZero) {
            product.status = "Out of stock";
          }
      
          await product.save();
        }
      }
      
  
      await Cart.deleteOne({ userId });
  
      res.redirect('/order-success');
    } catch (err) {
      console.error('Error placing order:', err);
      next(err);
    }
  };
  
  const createRazorPay = async (req, res, next) => {
    try {
      const userId = req.user._id;
      const cartDoc = await Cart.findOne({ userId }).populate('items.productId');
      const items = cartDoc?.items || [];
      if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  
      const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const delivery = 41;
      const tax      = subTotal * 0.05;
      const total    = Math.round((subTotal + delivery + tax) * 100); // paise
  
      const order = await razorpay.orders.create({ amount: total, currency: 'INR', receipt: `receipt_${Date.now()}` });
      res.json({ order_id: order.id, amount: order.amount });
    } catch (err) {
      next(err);
    }
  };

  const verifyRazorpayPayment = async (req, res, next) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, selectedAddress } = req.body;
  
      const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
  
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, redirect: '/order-failure' });
      }
  
      const userId = req.user._id;
      const addressDoc = await Address.findOne({ userId });
      const addressDetail = addressDoc.details.id(selectedAddress);
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      const items = cart?.items || [];
  
      const orderItems = items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        basePrice: item.basePrice,
        price: item.price,
        variant: { size: item.variants.size.toLowerCase() },
        productImage: item.productImage || item.productId.images[0],
        currentStatus: 'Order Placed',
        statusHistory: [{ status: 'Order Placed', timestamp: new Date() }]
      }));
  
      const subTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const deliveryCharge = 41;
      const tax = parseFloat((subTotal * 0.05).toFixed(2));
      const totalAmount = parseFloat((subTotal + deliveryCharge + tax).toFixed(2));
  
      await Order.create({
        orderId: '#JK' + Date.now().toString() + Math.floor(Math.random() * 1000),
        razorpayOrderId: razorpay_order_id,
        userId,
        orderItems,
        address: { addressDocId: addressDoc._id, addressDetailId: addressDetail._id },
        paymentMethod: 'razorpay',
        paymentStatus: 'Paid',
        paymentId: razorpay_payment_id,
        coupon: 0,
        subTotal,
        deliveryCharge,
        tax,
        totalAmount,
        status: 'Order Placed'
      });
  
      for (const item of items) {
        const product = await Product.findById(item.productId._id);
        if (!product) continue;
        const sizeKey = item.variants.size.toLowerCase();
        if (product.variant?.size?.[sizeKey] != null) {
          product.variant.size[sizeKey] = Math.max(0, product.variant.size[sizeKey] - item.quantity);
          if (Object.values(product.variant.size).every(qty => qty === 0)) product.status = 'Out of stock';
          await product.save();
        }
      }
  
      await Cart.deleteOne({ userId });
      res.json({ success: true, redirect: '/order-success' });
    } catch (err) {
      console.error('Razorpay Verification Error:', err);
      return res.status(500).json({ success: false, redirect: '/order-failure' });

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

  const loadOrderFailurePage = async (req,res) => {
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
      res.render('orderFailure',{
        order: latestOrder,
        address: addressDetail,
        email: user.email,
        subtotal: subtotal, 
      })
    } catch (error) {
      console.error(error)
      res.redirect('/pageNotFound');
    }
  }
  
module.exports = {
    getCheckoutPage,
    placeOrder,
    createRazorPay,
    verifyRazorpayPayment,
    loadOrderSuccess,
    loadOrderFailurePage,

}