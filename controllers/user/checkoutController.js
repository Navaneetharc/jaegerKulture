const Address = require('../../models/addressSchema'); 
const Cart    = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema')
const Wallet = require('../../models/walletSchema');
const Order   = require('../../models/orderSchema');
const { applyCoupon } = require('../../config/coupons');
const Coupon = require('../../models/couponSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const razorpay = require('../../config/payments');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { timeStamp } = require('console');

const getCheckoutPage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { selectedAddress, couponCode } = req.body;

    const addressDoc = await Address.findOne({ userId }).lean();
    const addresses  = addressDoc?.details || [];

    const cart = await Cart
      .findOne({ userId })
      .populate('items.productId')
      .lean();

    const items = cart?.items || [];


            let wishlistCount = 0;

            if (userId) {
                const wishlist = await Wishlist.findOne({ userId });
                wishlistCount = wishlist ? wishlist.products.length : 0;
            }  
    if (!items.length) {
      return res.redirect('/cart');
    }

    const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const delivery = 41;
    const tax      = subTotal * 0.05;
    const total    = subTotal + delivery + tax;

    const now = new Date();
    
    const coupons = await Coupon.find({
      status: 'Active',
      startDate:  { $lte: now },
      expiryDate: { $gte: now },
      minPrice: { $lte: subTotal },
      $or: [
        { usageType: 'multi-use' },
        { 
          usageType: 'single-use',
          usersUsed: { $nin: [userId] }
        }
      ]
    }).lean();

    const agg = await Wallet.aggregate([
      {$match:{userId: new mongoose.Types.ObjectId(userId)}},
      {$group:{
        _id: '$userId',
        credits: {$sum:{$cond:[{$eq: ['$entryType','CREDIT']}, '$amount', 0]}},
        debits: {$sum: {$cond:[{$eq:['$entryType','DEBIT']}, '$amount',0]}}
      }}
    ])
    const walletBalance = (agg[0]?.credits || 0) - (agg[0]?.debits || 0);

    res.render('checkout', {
      user: req.user,
      addresses,
      items,
      total, 
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      coupons,
      walletBalance,
      wishlistCount
    });
  } catch (err) {
    next(err);
  }
};

const placeOrder = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { selectedAddress, couponCode,paymentMethod } = req.body;

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.redirect('/checkout?error=address-not-found');
    }

    const addressDetail = addressDoc.details.id(selectedAddress);
    if (!addressDetail) {
      return res.redirect('/checkout?error=invalid-address-selected');
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
    const tax = parseFloat((subTotal * 0.05).toFixed(2));
    
    const { discount } = await applyCoupon(userId, couponCode, subTotal);
    
    const totalAmount = parseFloat((subTotal - discount + deliveryCharge + tax).toFixed(2));

    let couponDetails = null;
    if (couponCode && discount > 0) {
      couponDetails = await Coupon.findOne({ code: couponCode });
    }

    const newOrder = await Order.create({
      orderId: '#JK' + Math.floor(Math.random() * 1e9).toString(),
      userId,
      orderItems,
      address: {
        addressDocId: addressDoc._id,
        addressDetailId: addressDetail._id
      },
      paymentMethod,
      paymentStatus: paymentMethod === 'wallet' ? 'Paid' : 'Pending',
      paymentVerified: paymentMethod === 'wallet',
      walletAmountUsed: paymentMethod === 'wallet' ? totalAmount : 0,
      couponCode: couponCode || null,
      couponName: couponDetails?.name || null,
      couponDiscount: discount,
      subTotal,
      deliveryCharge,
      tax,
      totalAmount,
      status: 'Pending'
    });

    if(paymentMethod === 'wallet'){
      await Wallet.create({
        userId,
        transactionId: new mongoose.Types.ObjectId(), 
        payment_type: 'wallet',
        amount: totalAmount,
        status: 'completed',
        entryType: 'DEBIT',
        type: 'product_purchase',
        orderId: newOrder._id

      });
    }

    if(couponCode && discount > 0){
      await applyCoupon(userId, couponCode, subTotal, true);
    }

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
    const { couponCode } = req.body;

    const cartDoc = await Cart.findOne({ userId }).populate('items.productId');
    const items = cartDoc?.items || [];
    if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

    const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const delivery = 41;
    const tax = parseFloat((subTotal * 0.05).toFixed(2));
    
    const { discount } = await applyCoupon(userId, couponCode, subTotal, false);
    
    const total = Math.round((subTotal - discount + delivery + tax) * 100);

    const order = await razorpay.orders.create({ 
      amount: total, 
      currency: 'INR', 
      receipt: `receipt_${Date.now()}` 
    });
    
    res.json({ order_id: order.id, amount: order.amount });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    next(err);
  }
};


const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      selectedAddress,
      couponCode
    } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('Signature mismatch');
      return res.status(400).json({ success: false, redirect: '/order-failure' });
    }

    const userId = req.user._id;

    const addressDoc = await Address.findOne({ userId });
    const addressDetail = addressDoc?.details.id(selectedAddress);
    if (!addressDoc || !addressDetail) {
      console.error('Invalid address:', addressDoc, addressDetail);
      return res.status(400).json({ success: false, error: 'Address not found or invalid' });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || !cart.items.length) {
      console.error('Empty cart');
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    const orderItems = cart.items.map(item => ({
      product:       item.productId._id,
      quantity:      item.quantity,
      basePrice:     item.basePrice,
      price:         item.price,
      variant:       { size: item.variants.size.toLowerCase() },
      productImage:  item.productImage || item.productId.images[0],
      currentStatus: 'Order Placed',
      statusHistory: [{ status: 'Order Placed', timestamp: new Date() }]
    }));

    const subTotal       = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryCharge = 41;
    const tax            = parseFloat((subTotal * 0.05).toFixed(2));

    let discount = 0;
    let couponName = null;
    if (couponCode) {
      
      const couponDoc = await Coupon.findOne({ code: couponCode });
      const result = await applyCoupon(userId, couponCode, subTotal, false);

      discount = result.discount || 0;
      if (discount > 0 && couponDoc) {
        couponName = couponDoc.name;
      }
    } else {
      console.log('No couponCode provided');
    }

    const totalAmount = parseFloat((subTotal + deliveryCharge + tax - discount).toFixed(2));

    const newOrder = await Order.create({
      orderId:           '#JK' + Date.now().toString() + Math.floor(Math.random() * 1000),
      razorpayOrderId:   razorpay_order_id,
      userId,
      orderItems,
      address: {
        addressDocId:    addressDoc._id,
        addressDetailId: addressDetail._id
      },
      paymentMethod:    'razorpay',
      paymentStatus:    'Paid',
      paymentId:        razorpay_payment_id,
      subTotal,
      deliveryCharge,
      tax,
      couponCode:       couponCode || null,
      couponName,
      couponDiscount:   discount,
      totalAmount,
      status:           'Order Placed'
    });

    if (couponCode && discount > 0) {
      await applyCoupon(userId, couponCode, subTotal, true);
    }

    for (const item of cart.items) {
      const prod = await Product.findById(item.productId._id);
      if (!prod) continue;
      const sizeKey = item.variants.size.toLowerCase();
      if (prod.variant?.size?.[sizeKey] != null) {
        prod.variant.size[sizeKey] = Math.max(0, prod.variant.size[sizeKey] - item.quantity);
        if (Object.values(prod.variant.size).every(q => q === 0)) {
          prod.status = 'Out of stock';
        }
        await prod.save();
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
    const user   = await User.findById(userId);

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

    const deliveryCharge = latestOrder.deliveryCharge;
    const tax            = latestOrder.tax;

    const { discount: recalculated } = await applyCoupon(
      userId,
      latestOrder.couponCode,
      subtotal
    );

    const discount    = recalculated;
    const totalAmount = parseFloat(
      (subtotal + deliveryCharge + tax - discount).toFixed(2)
    );

    const addressDoc    = latestOrder.address.addressDocId;
    const addressDetail = addressDoc.details.id(
      latestOrder.address.addressDetailId
    );
    if (!addressDetail) {
      return res.redirect('/orders?error=address-not-found');
    }

   

    res.render('orderSuccess', {
      order:           latestOrder, 
      email:           user.email,
      orderItems:      latestOrder.orderItems,
      address:         addressDetail,
      subtotal,
      deliveryCharge,
      tax,
      discount,                       
      totalAmount,                    
      couponCode:      latestOrder.couponCode,
      couponName:      latestOrder.couponName,
      paymentMethod:   latestOrder.paymentMethod,
      paymentStatus:   latestOrder.paymentStatus
    });

  } catch (err) {
    console.error(err);
    res.redirect('/pageNotFound');
  }
};

const loadOrderFailurePage = async (req, res) => {
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

    const deliveryCharge = latestOrder.deliveryCharge;
    const tax           = latestOrder.tax;
    const discount      = latestOrder.couponDiscount || 0;
    const totalAmount   = parseFloat(
      (subtotal + deliveryCharge + tax - discount).toFixed(2)
    );

    const addressDoc    = latestOrder.address.addressDocId;
    const addressDetail = addressDoc.details.id(
      latestOrder.address.addressDetailId
    );
    if (!addressDetail) {
      return res.redirect('/orders?error=address-not-found');
    }

    res.render('orderFailure', {
      order:           latestOrder,
      email:           user.email,
      orderItems:      latestOrder.orderItems,
      address:         addressDetail,
      subtotal,
      deliveryCharge,
      tax,
      discount,
      totalAmount,
      couponCode:      latestOrder.couponCode,
      couponName:      latestOrder.couponName,
      paymentMethod:   latestOrder.paymentMethod,
      paymentStatus:   latestOrder.paymentStatus
    });
  } catch (err) {
    console.error(err);
    res.redirect('/pageNotFound');
  }
};

  
module.exports = {
    getCheckoutPage,
    placeOrder,
    createRazorPay,
    verifyRazorpayPayment,
    loadOrderSuccess,
    loadOrderFailurePage,
};


