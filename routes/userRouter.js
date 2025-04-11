const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');
const profileController = require('../controllers/user/profileController');
const {userAuth,adminAuth} = require("../middlewares/auth");
const productController = require("../controllers/user/productController");


// error page
router.get('/pageNotFound',userController.pageNotFound);

// sign up management
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
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
        // Set the user session
        req.session.user = req.user._id;
        
        // Save the session and redirect
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.redirect('/login?error=session');
            }
            res.redirect('/');
        });
    }
);

// login management
router.get('/login',userController.loadLogin);
router.post('/login',userController.login)
router.get('/logout',userController.logout);

// home page , shop page
router.get('/',userAuth,userController.loadHomepage);
router.get('/shop', userAuth, userController.loadShoppingPage);
router.get('/filter', userAuth, userController.filterProduct);
router.get('/filterPrice',userAuth,userController.filterByPrice);
router.get('/search', userAuth, userController.searchProducts);
router.post('/search',userAuth,userController.searchProducts);


router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp);
router.post('/resend-forgot-pass-otp',profileController.resendForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/reset-password",profileController.postNewPassword);

// product
router.get("/productDetails",userAuth,productController.productDetails);


module.exports = router;