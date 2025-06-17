const Wishlist    = require('../../models/wishlistSchema');
const Cart = require('../../models/cartSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');

const addToWishlist = async (req, res) => {
    try {
      const userId = req.user._id;
      const { productId } = req.body;
  
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const updated = await Wishlist.findOneAndUpdate(
        {userId},
        {
          $addToSet: {products: {productId, variants: {}}}
        },
        {new: true, upsert: true}
      );

      await User.findByIdAndUpdate(userId,{
        $addToSet: {wishlist: updated._id}
      });

      return res.status(200).json({
        message: "Added to wishlist",
        totalCount: updated.products.length
      });
  
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  };

  const removeFromWishlist = async (req, res) => {
    try {
      const userId = req.user._id;
      const { productId } = req.body;
  
      const updated = await Wishlist.findOneAndUpdate(
        {userId},
        {$pull: {products: {productId}}},
        {new: true}
      );
      if(!updated){
        return res.status(404).json({message: 'Whislist not found'});
      }

      return res.status(200).json({
        message: 'Removed from wishlist',
        totalCount: updated.products.length
      });
  
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  };
  

const getWishlistPage = async (req, res) => {
    try {
      const user = await User.findById(req.session.user);
      const userId = req.user._id;
  
      let wishlist = await Wishlist
        .findOne({ userId })
        .populate('products.productId');


        if(!wishlist){
          let cart = await Cart.findOne({userId}).populate('items.productId');
          const items = cart?.items || [];

          const wishlistCount = 0;

          return res.render('wishlist',{
            products: [],
            user,
            items,
            wishlistCount
          });
        }

        const beforeCount = wishlist.products.length;
        wishlist.products = wishlist.products.filter(item =>{

          if(!item.productId) return false;

          if(item.productId.isBlocked) return false;

          return true;
        })

        if(wishlist.products.length !== beforeCount){
          await wishlist.save();
        }

        const products = wishlist.products
        .map(item => item.productId)
        .filter(p => p);

        let cart = await Cart.findOne({userId}).populate('items.productId');
        const items = cart?.items || [];

        const wishlistCount = wishlist.products.length;

        return res.render('wishlist',{
          products,
          user,
          items,
          wishlistCount
        })
  
      
    } catch (error) {
      console.error('Error fetching wishlist page:', error);
      return res.redirect('/pageNotFound');
    }
  };
  
  
module.exports={
    getWishlistPage,
    addToWishlist,
    removeFromWishlist,
}
