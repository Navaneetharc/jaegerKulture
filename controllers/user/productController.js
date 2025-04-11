// const Product = require("../../models/productSchema");
// const Category = require("../../models/categorySchema");
// const User = require("../../models/userSchema");



// const productDetails = async(req,res)=>{
//     try {
        
//         const userId = req.session.user;
//         const userData = await User.findById(userId);
//         const productId = req.query.id;
//         const product = await Product.findById(productId).populate('category');
//         const findCategory = product.category;
    
//             res.render('product-details',{
//                 user:userData,
//                 product:product,
//                 category:findCategory,

//             });

//     } catch (error) {
//         console.error('Error in fetching product details', error);
//         res.redirect('/pageNotFound');
        
//     }
// }




// module.exports = {
//     productDetails
// }

const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session?.user || null;
        const productId = req.query.id;
        if (!productId) return res.redirect('/pageNotFound');

        // Fetch user and product data in parallel (using lean() for plain objects)
        const [userData, productDoc] = await Promise.all([
            userId ? User.findById(userId).lean() : null,
            Product.findById(productId).populate('category').lean()
        ]);

        if (!productDoc) return res.redirect('/pageNotFound');

        // Get related products from the same category
        const relatedProducts = await Product.find({
            category: productDoc.category._id,
            _id: { $ne: productId }, // Exclude current product
            isBlocked: false
        })
        .limit(4)
        .populate('category')
        .lean();

        // Modify productDoc to match your EJS requirements:
        // - Add a 'stock' field from productDoc.variant.size
        // - Rename description to shortDescription
        const product = {
            ...productDoc,
            stock: productDoc.variant.size,       // { s: Number, m: Number, l: Number, x: Number, xl: Number }
            shortDescription: productDoc.description // use description as the short description
        };

        res.render('product-details', {
            user: userData || null,
            product,
            category: product.category,
            products: relatedProducts // Add related products to the template
        });
    } catch (error) {
        console.error('Error in fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productDetails
};
