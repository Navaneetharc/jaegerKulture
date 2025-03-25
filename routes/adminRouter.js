// const express = require('express');
// const router = express.Router();
// const adminController = require('../controllers/admin/adminController')
// const customerController = require('../controllers/admin/customerController');
// const {userAuth,adminAuth} = require("../middlewares/auth");

// router.get("/pageerror",adminController.pageerror);
// // Admin login
// router.get('/login',adminController.loadLogin);
// router.post('/login',adminController.login);
// router.get('/', adminAuth,adminController.loadDashboard);
// router.get('/logout',adminController.logout);

// // customer 
// router.get('/users',adminAuth,customerController.customerInfo);
// router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
// router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);


// module.exports = router



const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController');
const categoryController = require("../controllers/admin/categoryController");
const {userAuth,adminAuth} = require("../middlewares/auth");

router.get("/pageerror",adminController.pageerror);
// Admin login
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/', adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);

// customer management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unblockCustomer', adminAuth, customerController.customerunBlocked);

// category Management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory);

module.exports = router