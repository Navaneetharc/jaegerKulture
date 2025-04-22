const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController');
const categoryController = require("../controllers/admin/categoryController");
const productController = require('../controllers/admin/productController');
const {userAuth,adminAuth} = require("../middlewares/auth");
const orderController = require("../controllers/admin/orderController");
const inventoryController = require('../controllers/admin/inventoryController')

const uploadDir = path.join(__dirname, '../public/uploads/product-images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `product-${uniqueSuffix}${path.extname(file.originalname)}`); 
    }
});
const uploads = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});



// routes
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
// edit
router.get('/editCategory',adminAuth,categoryController.getEditCategory);
router.put('/editCategory/:id', adminAuth, categoryController.editCategory);

// product Management
router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array('images', 3),productController.addProducts);
router.get('/products/:page?', adminAuth, productController.getAllProducts);
router.get('/blockProduct/:id', adminAuth,productController.productBlocked);
router.get('/unblockProduct/:id', adminAuth,productController.productunBlocked);
router.get('/editProduct/:id', adminAuth, productController.loadEditProducts);
router.put('/editProduct/:id', adminAuth, uploads.any(), productController.editProduct);

//routes for customer and category pagination
router.get('/categories/:page?', adminAuth, categoryController.categoryInfo);


// order management
router.get('/orders',orderController.getOrderManagement);

// stock/inventory management
router.get('/stock',inventoryController.getStockManagement);
  
module.exports = router