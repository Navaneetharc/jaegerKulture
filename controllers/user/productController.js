

const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Cart    = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');

const productDetails = async (req, res) => {
    try {
        const userId = req.session?.user || null;
        const productId = req.query.id;
        if (!productId) return res.redirect('/pageNotFound');

        const [userData, productDoc] = await Promise.all([
            userId ? User.findById(userId).lean() : null,
            Product.findById(productId).populate('category').lean()
        ]);

        if (!productDoc) return res.redirect('/pageNotFound');

        const relatedProducts = await Product.find({
            category: productDoc.category._id,
            _id: { $ne: productId },
            isBlocked: false
        })
        .limit(4)
        .populate('category')
        .lean();

        const product = {
            ...productDoc,
            stock: productDoc.variant.size,       
            shortDescription: productDoc.description 
        };

        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];

            
                        let wishlistCount = 0;
            
                        if (userId) {
                            const wishlist = await Wishlist.findOne({ userId });
                            wishlistCount = wishlist ? wishlist.products.length : 0;
                        }  
        
            let wishlistItems = [];

            if (userId) {
                try {
                    const wishlist = await Wishlist.findOne({ userId }).lean();
                    if (wishlist) {
                        wishlistItems = wishlist.products.map(item => item.productId.toString());
                    }
                } catch (wishlistError) {
                    console.error('Error fetching wishlist:', wishlistError);
                }
}


        res.render('product-details', {
            user: userData || null,
            product,
            items,
            wishlistCount,
            wishlistItems,
            category: product.category,
            products: relatedProducts,
        });
    } catch (error) {
        console.log('Error in fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productDetails
};
