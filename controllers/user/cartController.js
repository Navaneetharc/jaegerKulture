
const Cart    = require('../../models/cartSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist    = require('../../models/wishlistSchema');


const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1, variants = {} } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const normalizedSize = (variants.size || '').toLowerCase();
    const sizesObj = product.variant.size; 
    if (!sizesObj.hasOwnProperty(normalizedSize)) {
      return res.status(400).json({ success: false, message: 'Please select a valid product size.' });
    }

    const stockAvailable = sizesObj[normalizedSize];
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existing = cart.items.find(item =>
      item.productId.toString() === productId &&
      item.variants.size.toLowerCase() === normalizedSize
    );

    if (existing) {
      const newQty = existing.quantity + Number(quantity);
      if (newQty > stockAvailable) {
        return res.status(400).json({
          success: false,
          message: `You already have ${existing.quantity} in your cart. Only ${stockAvailable - existing.quantity} more can be added for size ${normalizedSize.toUpperCase()}.`
        });
      }
      existing.quantity = newQty;
    } else {
      if (Number(quantity) > stockAvailable) {
        return res.status(400).json({
          success: false,
          message: `Only ${stockAvailable} items available for size ${normalizedSize.toUpperCase()}.`
        });
      }
      cart.items.push({
        productId,
        name: product.productName,
        quantity: Number(quantity),
        price: product.salePrice,
        basePrice: product.regularPrice,
        productImage: product.productImage[0],
        variants: { size: normalizedSize },
        category: product.category,
      });
    }

    await cart.save();
    await User.findByIdAndUpdate(userId, { $addToSet: { cart: cart._id } });

    const totalCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    return res.status(200).json({
      success: true,
      message: 'Added to cart',
      totalCount
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error', error: err });
  }
};


const getCartPage = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart
      .findOne({ userId })
      .populate('items.productId');

    const items = cart?.items || [];

            let wishlistCount = 0;

            if (userId) {
                const wishlist = await Wishlist.findOne({ userId });
                wishlistCount = wishlist ? wishlist.products.length : 0;
            }  

    return res.render('myCart', { items, user: req.user, wishlistCount });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
};


const removeFromCart = async (req, res) => {
  try {
    const userId    = req.user._id;
    const { itemId } = req.body;  

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item =>
      item._id.toString() !== itemId &&
      item.productId.toString() !== itemId
    );

    await cart.save();
    return res.redirect('/cart');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err });
  }
};

const updateCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const items = req.body.items; 

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items.forEach(item => {
      const itemId = item._id.toString();
      if (items[itemId]) {
        const newQuantity = parseInt(items[itemId]);
        if (newQuantity > 0) {
          item.quantity = newQuantity;
        }
      }
    });

    cart.items = cart.items.filter(item => item.quantity > 0);

    await cart.save();

    return res.redirect('/cart');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const {itemId}= req.params;
    let qty = parseInt(req.body.quantity, 10);

    const cart = await Cart.findOne({ userId });
    if(!cart) return res.status(404).json({success:false, message: 'Cart not found'});

    const item = cart.items.id(itemId);
    if(!item) return res.status(404).json({success: false, message: 'Item not found'});

    const product = await Product.findById(item.productId);
    const sizeKey = item.variants.size.toLowerCase();
    const stockAvailable = product.variant.size[sizeKey] || 0;

    if(qty > stockAvailable){
      return res.status(400).json({
        success: false,
        message: `Only ${stockAvailable} items available for size ${sizeKey.toUpperCase()}.`
      });
    }

    item.quantity = qty > 0 ? qty : 1;
    await cart.save();
    return res.json({success: true, quantity: item.quantity});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
  addToCart,
  getCartPage,
  removeFromCart,
  updateCart,
  updateCartItem,
};
