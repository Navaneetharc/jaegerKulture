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

        // console.log('Files received:', req.files); // Debug log
        // console.log('Product data:', products); // Debug log

        const productExists = await Product.findOne({
            productName:products.productName,

        });

        if(productExists){
            return res.status(400).json("Product already exists, please try another name");
        }

        let images = [];

        if(req.files && req.files.length > 0){
            console.log('Processing files...'); // Debug log
            // Create upload directory if it doesn't exist
            const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for(let i = 0; i < req.files.length; i++){
                const file = req.files[i];
                console.log('Processing file:', file); // Debug log
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

                    console.log('Image saved:', filename); // Debug log
                    images.push(filename);

                    // Delete the temporary file
                    await fs.promises.unlink(file.path);
                } catch (error) {
                    console.error('Error processing image:', error);
                    // If there's an error, try to delete the temporary file
                    try {
                        await fs.promises.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Error deleting temporary file:', unlinkError);
                    }
                }

                
            }
        } else {
            console.log('No files received'); // Debug log
        }
        console.log('Final images array:', images); // Debug log


        const categoryId = await Category.findOne({name:products.category});

        if(!categoryId){
            return res.status(400).send("Invalid category name")
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            quantity: products.quantity,
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
        console.log('New product before save:', newProduct); // Debug log

        await newProduct.save();
        return res.redirect("/admin/addProducts");

   
    
    } catch (error) {
        console.error('Error saving product:', error);
        return res.redirect("/admin/pageerror")
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
}
 