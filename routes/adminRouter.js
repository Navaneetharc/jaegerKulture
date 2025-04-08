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


// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../public/uploads/product-images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Folder to store uploaded images
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
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

// product Management
router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array('images', 3),productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts);
router.get('/blockProduct/:id', adminAuth,productController.productBlocked);
router.get('/unblockProduct/:id', adminAuth,productController.productunBlocked);
router.get('/editProduct/:id',adminAuth,productController.getEditProduct);
router.post('/editProduct/:id',adminAuth,uploads.array('images', 3),productController.editProduct)
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

  
module.exports = router