
const Cart    = require('../../models/cartSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');

const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1, variants = {} } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const validSizes = Object.keys(product.variant.size); 
    const selectedSize = variants.size;

    if (!selectedSize || !validSizes.includes(selectedSize.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Please select a valid product size.' });
    }
    

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existing = cart.items.find(i =>
      i.productId.toString() === productId && i.variants.size === selectedSize
    );

    if (existing) {
      existing.quantity += Number(quantity);
    } else {
      cart.items.push({
        productId,
        name: product.productName,
        quantity: Number(quantity),
        price: product.salePrice,
        basePrice: product.regularPrice,
        productImage: product.productImage[0],
        variants: { size: selectedSize },
        category: product.category,
      });
    }

    await cart.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { cart: cart._id }
    });
    console.log("Item:",cart.items);
     const totalCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

     return res
       .status(200)
       .json({
         message:    "Added to cart",
         totalCount: cart.items.length  
       });
       
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err });
  }
};

const getCartPage = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart
      .findOne({ userId })
      .populate('items.productId');

    const items = cart?.items || [];

    return res.render('myCart', { items, user: req.user });
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
    const { itemId } = req.params;
    let { quantity } = req.body;
    quantity = parseInt(quantity, 10);

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found.' });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    item.quantity = quantity > 0 ? quantity : 1;
    await cart.save();

    return res.json({ success: true, quantity: item.quantity });
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
