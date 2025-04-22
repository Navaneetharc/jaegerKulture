

const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Cart    = require('../../models/cartSchema');

const productDetails = async (req, res) => {
    try {
        const userId = req.session?.user || null;
        const productId = req.query.id;
        if (!productId) return res.redirect('/pageNotFound');
        // let cart = await Cart.findOne({ userId });



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

        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];
        
            

        res.render('product-details', {
            user: userData || null,
            product,
            items,
            category: product.category,
            products: relatedProducts // Add related products to the template
        });
    } catch (error) {
        console.log('Error in fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productDetails
};
