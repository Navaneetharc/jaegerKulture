const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const adminController = require('../controllers/admin/adminController');
const salesController = require('../controllers/admin/salesController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const { userAuth, adminAuth } = require('../middlewares/auth');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');
const upload = require('../middlewares/imageUpload');

// Ensure upload directory exists
// const uploadDir = path.join(__dirname, '../public/uploads/product-images');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadDir),
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
//     cb(null, `product-${uniqueSuffix}${path.extname(file.originalname)}`);
//   }
// });

// const uploads = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
//       return cb(new Error('Only image files are allowed!'), false);
//     }
//     cb(null, true);
//   }
// });

// Error page
router.get('/pageerror', adminController.pageerror);

// Admin authentication
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout);

// Sales report routes
router.get('/sales', adminAuth, salesController.loadSalesReport);
router.post('/sales/filter', adminAuth, salesController.updateSales);
router.post('/generate-report', adminAuth, salesController.generateReport);

// Customer management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);

// Category management
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.put('/editCategory/:id', adminAuth, categoryController.editCategory);
router.get('/categories/:page?', adminAuth, categoryController.categoryInfo);

// Product management
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post('/addProducts', adminAuth, upload.array('images', 3), productController.addProducts);
router.get('/products/:page?', adminAuth, productController.getAllProducts);
router.get('/blockProduct/:id', adminAuth, productController.productBlocked);
router.get('/unblockProduct/:id', adminAuth, productController.productunBlocked);    
router.get('/editProduct/:id', adminAuth, productController.loadEditProducts);
router.put('/editProduct/:id', adminAuth, upload.any(), productController.editProduct);

// Order management
router.get('/orders', adminAuth, orderController.getOrderManagement);
router.get('/orderDetails/:id', adminAuth, orderController.getOrderDetails);
router.post('/order-status', adminAuth, orderController.updateOrderStatus);
router.get('/orderTrack/:id', adminAuth, orderController.getOrderTracking);
router.post('/approve-return/:orderId', adminAuth, orderController.approveReturns);
router.post('/cancel-return/:orderId', adminAuth, orderController.rejectReturns);


// Coupon management
router.get('/coupons', adminAuth, couponController.loadCouponManagement);
router.post('/coupons', adminAuth, couponController.addCoupon);
router.post('/coupons/update', adminAuth, couponController.updateCoupon);
router.get('/coupons/activate/:id', adminAuth, couponController.activateCoupon);
router.get('/coupons/deactivate/:id', adminAuth, couponController.deactivateCoupon);
router.get('/coupons/delete/:id', adminAuth, couponController.deleteCoupon);

module.exports = router;
