const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { kMaxLength } = require("buffer");

const getProductAddPage = async (req,res)=>{
    try {       
        const category = await Category.find({isListed:true});
        res.render("product-add",{
            cat:category,           
        });
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
};
const addProducts = async (req,res)=>{
    try {
        const products = req.body;
        const validationErrors = [];
       
        if (!products.productName || products.productName.trim().length < 3) {
            validationErrors.push('Product name must be at least 3 characters long');
        }

        if (!products.description || products.description.trim().length < 10) {
            validationErrors.push('Short description must be at least 10 characters long');
        }

        if (!products.longDescription || products.longDescription.trim().length < 20) {
            validationErrors.push('Full description must be at least 20 characters long');
        }

        if (!products.specifications || products.specifications.trim().length < 10) {
            validationErrors.push('Specifications must be at least 10 characters long');
        }

        if (!products.regularPrice || isNaN(products.regularPrice) || parseFloat(products.regularPrice) <= 0) {
            validationErrors.push('Regular price must be a positive number');
        }

       
        if (!products.productOffer || products.productOffer < 0 || products.productOffer > 100) {
            validationErrors.push('Offer percentage must be between 0 and 100');
        }
        

        if (!products.category) {
            validationErrors.push('Category is required');
        }       


        const { s = '', m = '', l = '', x = '', xl = '' } = products.variant?.size || {};
            const sizeInputs = [s, m, l, x, xl];
            const sizeLabels = ['S', 'M', 'L', 'X', 'XL'];

            let totalStock = 0;

            sizeInputs.forEach((rawQty, idx) => {
                const qty = rawQty === '' ? 0 : parseInt(rawQty, 10);

                if (isNaN(qty) || qty < 0) {
                    validationErrors.push(`Size ${sizeLabels[idx]} must be a non-negative number`);
                } else {
                    totalStock += qty;
                }
            });

            if (totalStock === 0) {
                validationErrors.push('At least one size must have stock quantity');
            }


        if (!req.files || req.files.length !== 3) {
            validationErrors.push('Exactly 3 product images are required');
        } else {
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            for (const file of req.files) {
                if (!validTypes.includes(file.mimetype)) {
                    validationErrors.push('Only JPG, JPEG, and PNG images are allowed');
                    break;
                }
                if (file.size > maxSize) {
                    validationErrors.push('Image size must be less than 5MB');
                    break;
                }
            }
        }

        if (validationErrors.length) {
            return res.status(400).json({ errors: validationErrors });
        }

        const productExists = await Product.findOne({
            productName: products.productName.trim(),
        });

        if(productExists){
            return res.status(400).json({ error: "Product already exists, please try another name" });
        }

        let images = [];

        if(req.files && req.files.length === 3){
            const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for(let i = 0; i < req.files.length; i++){
                const file = req.files[i];
                const filename = `product-${Date.now()}-${i}.jpg`;
                const resizedImagePath = path.join(uploadDir, filename);

                try {
                    await sharp(file.path)
                        .resize(440, 440, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .jpeg({ quality: 80 })
                        .toFile(resizedImagePath);

                    images.push(filename);

                    await fs.promises.unlink(file.path);
                } catch (error) {
                    console.error('Error processing image:', error);
                    try {
                        await fs.promises.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Error deleting temporary file:', unlinkError);
                    }
                    return res.status(500).json({ error: "Error processing image" });
                }
            }
        }

        const regularPrice  = parseFloat(products.regularPrice);
        const productOffer = isNaN(parseFloat(products.productOffer)) ? 0 : parseFloat(products.productOffer);

        const category = await Category.findOne({name: products.category});

        if(!category){
            return res.status(400).json({ error: "Invalid category name" });
        }

        const categoryOffer = category.categoryOffer || 0;
        const effectiveOffer = Math.max(productOffer, categoryOffer);
        const rawSalePrice = regularPrice * (1 - effectiveOffer / 100);
        const salePrice = Math.round(rawSalePrice * 100) / 100;

        // const salePrice = regularPrice - (regularPrice * (productOffer / 100));
       // const categoryId = await Category.findOne({name: products.category});

        

        const newProduct = new Product({
            productName: products.productName.trim(),
            description: products.description.trim(),
            longDescription: products.longDescription.trim(),
            specifications: products.specifications.trim(),
            category: category._id,
            regularPrice: regularPrice,
            salePrice: salePrice,
            productOffer: productOffer,
            variant: {
                size: {
                    s: parseInt(products.variant?.size?.s) || 0,
                    m: parseInt(products.variant?.size?.m) || 0,
                    l: parseInt(products.variant?.size?.l) || 0,
                    x: parseInt(products.variant?.size?.x) || 0,
                    xl: parseInt(products.variant?.size?.xl) || 0
                }
            },
            productImage: images,
            status: "Available",
        });

        await newProduct.save();
        return res.redirect("/admin/products");
    
    } catch (error) {
        console.error('Error saving product:', error);
        return res.status(500).json({ error: "Error saving product", details: error.message });
    }
}

const getAllProducts = async (req,res)=>{
    try {
        const search = req.query.search || "";
        const page = parseInt(req.params.page) || 1;
        const limit = 4;
        const productData = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},              
            ],
        }).countDocuments();

        const category = await Category.find({isListed:true});

        if(category){
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
            })
        }else{
            res.render("page-404");
        }

    } catch (error) {
        res.redirect("/admin/pageerror");
    }
};

const productBlocked = async(req,res)=>{
    try {
        
        let id = req.params.id;
        // console.log("Blocking product with ID:", id);
        const result = await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        console.log("Update result:", result);
        res.redirect("/admin/products")

    } catch (error) {

        console.error("Error blocking product:", error);
        res.redirect("/admin/pageerror");
        
    }
}

const productunBlocked = async (req,res)=>{
    try {
        
        let id = req.params.id;
        console.log("Unblocking product with ID:", id);
        const result = await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        console.log("Update result:", result);
        res.redirect("/admin/products")

    } catch (error) {
        
        console.error("Error unblocking product:", error);
        res.redirect("/admin/pageerror");
    }
};


const loadEditProducts = async(req,res)=>{
    try {
     const id = req.params.id;
     const product = await Product.findOne({_id:id}).populate('category');
   
     if(!product){
       return res.redirect('/admin/pageerror');
     }
     const cat = await Category.find({isListed:true});
    
     res.render('edit-product',{
       product: product,
       cat: cat
     });
    } catch (error) {
     console.log("Edit product load error:", error);
     res.redirect('/admin/pageerror');
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            productName,
            description,
            longDescription,
            specifications,
            category,
            regularPrice,
            productOffer,
            variant,
            removedImages
        } = req.body;

        const product = await Product.findOne({ _id: id });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (!productName || !description || !longDescription || !specifications || !category || !regularPrice || !productOffer) {
            return res.status(400).json({ message: "All fields are required" });
        }

        let images = [...product.productImage];
        const uploadDir = path.join(__dirname, '../../public/uploads/product-images');

        if (removedImages) {
            let imagesToRemove;
            try {
                imagesToRemove = JSON.parse(removedImages);
            } catch (err) {
                imagesToRemove = [];
            }
            imagesToRemove.forEach(imageName => {
                const index = images.indexOf(imageName);
                if (index !== -1) {
                    const imagePath = path.join(uploadDir, imageName);
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                    }
                    images[index] = null;
                }
            });
        }

        if (req.files) {
            if (Array.isArray(req.files)) {
                req.files.forEach(file => {
                    const match = file.fieldname.match(/productImages\[(\d+)\]/);
                    if (match) {
                        const idx = parseInt(match[1], 10);
                        images[idx] = file.filename;
                    }
                });
            } else {
                Object.keys(req.files).forEach(key => {
                    const match = key.match(/productImages\[(\d+)\]/);
                    if (match) {
                        const idx = parseInt(match[1], 10);
                        const file = req.files[key][0];
                        images[idx] = file.filename;
                    }
                });
            }
        }

        const categoryDoc = await Category.findById(category);
        if(!categoryDoc){
            return res.status(400).json({message: "Invalid category"});
        }

        const categoryOffer = categoryDoc.categoryOffer || 0;
        const parsedProductOffer = parseFloat(productOffer) || 0;
        const effectiveOffer = Math.max(parsedProductOffer, categoryOffer);
        const parsedRegularPrice = parseFloat(regularPrice);
        const rawSalePrice = parsedRegularPrice * (1 - effectiveOffer / 100);
        const salePrice = Math.round(rawSalePrice * 100) / 100;

        // Update 
        product.productName = productName;
        product.description = description;
        product.longDescription = longDescription;
        product.specifications = specifications;
        product.category = category;
        product.regularPrice  = parsedRegularPrice;
        product.salePrice     = salePrice;
        product.productOffer  = parsedProductOffer;
        product.variant = variant;
        product.productImage = images.filter(img => img !== null);

        // Save
        await product.save();

        res.status(200).redirect('/admin/products');
    } catch (error) {
        console.error('Error in editProduct:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {

    getProductAddPage,
    addProducts,
    getAllProducts,
    productBlocked,
    productunBlocked,
    loadEditProducts,
    editProduct,
}
 