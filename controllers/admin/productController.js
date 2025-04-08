const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

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

        // Input validation
        const validationErrors = [];

        // Product name validation
        if (!products.productName || products.productName.trim().length < 3) {
            validationErrors.push('Product name must be at least 3 characters long');
        }

        // Description validation
        if (!products.description || products.description.trim().length < 10) {
            validationErrors.push('Short description must be at least 10 characters long');
        }

        // Long description validation
        if (!products.longDescription || products.longDescription.trim().length < 20) {
            validationErrors.push('Full description must be at least 20 characters long');
        }

        // Specifications validation
        if (!products.specifications || products.specifications.trim().length < 10) {
            validationErrors.push('Specifications must be at least 10 characters long');
        }

        // Price validation
        if (!products.regularPrice || isNaN(products.regularPrice) || parseFloat(products.regularPrice) <= 0) {
            validationErrors.push('Regular price must be a positive number');
        }

        if (!products.salePrice || isNaN(products.salePrice) || parseFloat(products.salePrice) <= 0) {
            validationErrors.push('Sale price must be a positive number');
        } else if (parseFloat(products.salePrice) >= parseFloat(products.regularPrice)) {
            validationErrors.push('Sale price must be less than regular price');
        }

        // Category validation
        if (!products.category) {
            validationErrors.push('Category is required');
        }

        // Size validation
        const sizes = [
            products.variant?.size?.s,
            products.variant?.size?.m,
            products.variant?.size?.l,
            products.variant?.size?.x,
            products.variant?.size?.xl
        ];
        const sizeLabels = ['S', 'M', 'L', 'X', 'XL'];
        let totalStock = 0;

        sizes.forEach((size, index) => {
            if (size !== undefined && size !== '') {
                if (isNaN(size) || parseInt(size) < 0) {
                    validationErrors.push(`Size ${sizeLabels[index]} must be a non-negative number`);
                } else {
                    totalStock += parseInt(size);
                }
            }
        });

        if (totalStock === 0) {
            validationErrors.push('At least one size must have stock quantity');
        }

        // Image validation
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

        // Return validation errors if any
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        // Check for duplicate product name
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
                    // Resize and save image
                    await sharp(file.path)
                        .resize(440, 440, {
                            fit: 'cover',
                            position: 'center'
                        })
                        .jpeg({ quality: 80 })
                        .toFile(resizedImagePath);

                    images.push(filename);

                    // Delete the temporary file
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

        const categoryId = await Category.findOne({name: products.category});

        if(!categoryId){
            return res.status(400).json({ error: "Invalid category name" });
        }

        const newProduct = new Product({
            productName: products.productName.trim(),
            description: products.description.trim(),
            longDescription: products.longDescription.trim(),
            specifications: products.specifications.trim(),
            category: categoryId._id,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
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
        const page = req.query.page || 1;
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
                totalPages:page,
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
        console.log("Blocking product with ID:", id);
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

// const getEditProduct = async (req,res)=>{
//     try {

//         const id = req.params.id;
//         const product = await Product.findOne({_id:id});
//         const category = await Category.find({});
//         res.render("edit-product",{
//             product:product,
//             cat:category,

//         })
        
//     } catch (error) {

//         res.redirect("/admin/pageerror")
        
//     }
// }


// const editProduct = async (req,res)=>{
//     try {

//         const id = req.params.id;
//         const product = await Product.findOne({_id:id});
//         const data = req.body;
//         const existingProduct = await Product.findOne({
//             productname:data.productName,
//             _id:{$ne:id}
//         })

//         if(existingProduct){
//             return res.status(400).json({error:"Product with this name already exist. Please try with another name"});
//         }

//         const images = [];

//         if(req.files && req.files.length>0){
//             for(let i=0;i<req.files.length;i++){
//                 images.push(req.files[i].filename);
//             }
//         }

//         const updateFields = {
//             productName: products.productName,
//             description: products.description,
//             longDescription: products.longDescription,
//             specifications: products.specifications,
//             category: categoryId._id,
//             regularPrice: parseFloat(products.regularPrice),
//             salePrice: parseFloat(products.salePrice),
            
//             variant: {
//                 size: {
//                     s: parseInt(products.variant?.size?.s) || 0,
//                     m: parseInt(products.variant?.size?.m) || 0,
//                     l: parseInt(products.variant?.size?.l) || 0,
//                     x: parseInt(products.variant?.size?.x) || 0,
//                     xl: parseInt(products.variant?.size?.xl) || 0
//                 }
//             },
//             productImage: images,
//             status: "Available",

//         }
//         if(req.files.length>0){
//             updateFields.$push = {productImage:{$each:images}};
//         }

//         await Product.findByIdAndUpdate(id,updateFields,{new:true});
//         res.redirect("/admin/products");

//     } catch (error) {
//         console.error(error);
//         res.redirect("/admin/pageerror");
        
//     }
// }

// const deleteSingleImage = async (req,res)=>{
//     try {

//         const {imageNameToServer,productIdToServer} = req.body;
//         const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
//         const imagePath = path.join("public","uploads","re-image",imageNameToServer);
//         if(fs.existsSync(imagePath)){
//             await fs.unlinkSync(imagePath);
//             console.log(`Image ${imagenameToServer} deleted successfully`);
//         }else{
//             console.log(`Image ${imageNameToServer} not found`);
//         }
//         res.send({status:true});
        
//     } catch (error) {

//         res.redirect("/admin/pageerror");
        
//     }
// }

const getEditProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({});
        res.render("edit-product", {
            product: product,
            cat: category,
        });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        let product = await Product.findOne({ _id: id });
        const data = req.body;

        // Check for duplicate product name
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });
        if (existingProduct) {
            return res.status(400).json({ error: "Product with this name already exists. Please try with another name" });
        }

        // Copy the existing images array
        let updatedImages = [...product.productImage];

        // Expecting 'removedImages' as a JSON-stringified array of filenames that were removed in the UI.
        const removedImages = data.removedImages ? JSON.parse(data.removedImages) : [];

        // For each removed image, check if a new file was uploaded.
        // It is assumed that the order of req.files corresponds to the order of removedImages.
        if (removedImages.length > 0 && req.files && req.files.length > 0) {
            for (let i = 0; i < removedImages.length; i++) {
                const removedImage = removedImages[i];
                const index = updatedImages.indexOf(removedImage);
                if (index !== -1) {
                    if (req.files[i]) {
                        // New image provided for replacement: delete old file from storage
                        const imagePath = path.join("public", "uploads", "re-image", removedImage);
                        if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                        }
                        // Replace with the new image filename
                        updatedImages[index] = req.files[i].filename;
                    }
                    // If no new file was provided, do nothing – the old image remains.
                }
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            longDescription: data.longDescription,
            specifications: data.specifications,
            category: data.category, // Ensure your frontend sends the correct category identifier
            regularPrice: parseFloat(data.regularPrice),
            salePrice: parseFloat(data.salePrice),
            variant: {
                size: {
                    s: parseInt(data.variant?.size?.s) || 0,
                    m: parseInt(data.variant?.size?.m) || 0,
                    l: parseInt(data.variant?.size?.l) || 0,
                    x: parseInt(data.variant?.size?.x) || 0,
                    xl: parseInt(data.variant?.size?.xl) || 0
                }
            },
            productImage: updatedImages,
            status: "Available"
        };

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect("/admin/products");
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } });
        const imagePath = path.join("public", "uploads", "re-image", imageNameToServer);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        } else {
            console.log(`Image ${imageNameToServer} not found`);
        }
        res.send({ status: true });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

module.exports = {

    getProductAddPage,
    addProducts,
    getAllProducts,
    productBlocked,
    productunBlocked,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    
}
 