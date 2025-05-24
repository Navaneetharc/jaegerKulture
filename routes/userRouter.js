const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');
const profileController = require('../controllers/user/profileController');
const { userAuth } = require('../middlewares/auth');
const productController = require('../controllers/user/productController');
const accountController = require('../controllers/user/accountController');
const orderController = require('../controllers/user/orderController');
const addressController = require('../controllers/user/addressController');
const wishlistController = require('../controllers/user/wishlistController');
const cartController = require('../controllers/user/cartController');
const walletController = require('../controllers/user/walletController');
const checkoutController = require('../controllers/user/checkoutController');
const upload = require('../middlewares/multerConfig');
const invoiceController  = require('../controllers/user/invoiceController');


// Error page
router.get('/pageNotFound', userController.pageNotFound);

// Sign up management
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    req.session.user = req.user._id;
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/login?error=session');
      }
      res.redirect('/');
    });
  }
);

// Login management
router.get('/login', userController.loadLogin);
router.post('/login', userController.login);
router.get('/logout', userController.logout);

// Homepage & shop
router.get('/',userController.loadHomepage);
router.get('/shop',userController.loadShoppingPage);
router.get('/filter', userAuth, userController.filterProduct);
router.get('/filterPrice', userAuth, userController.filterByPrice);
router.get('/search', userAuth, userController.searchProducts);
router.post('/search', userAuth, userController.searchProducts);

// Password recovery
router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid);
router.post('/verify-passForgot-otp', profileController.verifyForgotPassOtp);
router.post('/resend-forgot-pass-otp', profileController.resendForgotPassOtp);
router.get('/reset-password', profileController.getResetPassPage);
router.post('/reset-password', profileController.postNewPassword);

// Product details
router.get('/productDetails', userAuth, productController.productDetails);

// Profile routes
router.get('/profileinfo', userAuth, accountController.getAccountInfoPage);
router.get('/edit-profile/:id', userAuth, accountController.getEditAccountInfoPage);
router.put(
  '/edit-profile/:id',
  userAuth,
  upload.single('userImage'),
  accountController.editProfileInfo
);
// OTP verification routes
router.post('/request-email-otp', userAuth, accountController.requestEmailOTP);
router.post('/resend-email-otp', userAuth, accountController.resendEmailOTP);
router.post('/verify-email-otp', userAuth, accountController.verifyEmailOTP);

// Addresses & Orders
router.get('/myAddresses', userAuth, addressController.getMyAddresses);
router.get('/addAddresses', userAuth, addressController.getAddMyAddressesPage);
router.post('/addAddresses',userAuth, addressController.addMyAddresses);
router.post('/addresses/:addressId/default', userAuth, addressController.setDefaultAddress);
router.delete('/delete-address/:detailId',userAuth,addressController.deleteAddress);
router.get('/myAddresses/edit/:detailId',userAuth,addressController.getEditMyAddressPage);
router.post('/myAddresses/edit/:detailId', userAuth, addressController.editMyAddresses);
router.post('/myAddresses/edit/:detailId', userAuth, addressController.editMyAddresses);
router.post('/save-address/:detailId', userAuth, addressController.editMyAddresses);
  
   
  
  
  



router.get('/myOrders', userAuth, orderController.getMyOrdersPage);
router.get('/orderDetails/:id', userAuth, orderController.getOrderDetails);
router.post('/cancel-order/:id', userAuth, orderController.cancelOrder);
router.post('/return-order/:id',userAuth, orderController.returnFullOrder);
router.post('/return-items/:id', userAuth, orderController.returnSelectedItems);

// wishlist

router.get('/wishlist',userAuth, wishlistController.getWishlistPage);
router.post('/wishlist/add',userAuth, wishlistController.addToWishlist);
router.post('/wishlist/remove', userAuth, wishlistController.removeFromWishlist);

// Cart & Checkout
router.get('/cart', userAuth, cartController.getCartPage);
router.post('/cart/add', userAuth, cartController.addToCart);
router.put('/cart', userAuth, cartController.updateCart);
router.patch('/cart/:itemId',userAuth, cartController.updateCartItem);

// Remove an item from the cart
router.delete('/cart/remove', userAuth, cartController.removeFromCart);

// checout routes
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout', userAuth, checkoutController.placeOrder); 
// razorpay
router.post('/checkout/create-order', userAuth, checkoutController.createRazorPay);
router.post('/checkout/verify', userAuth, checkoutController.verifyRazorpayPayment);
// order success & failure routes
router.get('/order-success',userAuth, checkoutController.loadOrderSuccess);
router.get('/order-failure', userAuth,checkoutController.loadOrderFailurePage);

// Wallet routes
router.get('/wallet',userAuth, walletController.getMyWalletPage);
router.get('/wallet/transactions',userAuth, walletController.getWalletTransactions);
router.post('/wallet/refund',userAuth, walletController.refundMoney);


// Security settings
router.get('/security', userAuth, accountController.getSecurityPage);
router.post('/security', userAuth, accountController.updatePassword);

// invoices
router.get('/invoice/:orderId',invoiceController.downloadInvoice);


module.exports = router;

