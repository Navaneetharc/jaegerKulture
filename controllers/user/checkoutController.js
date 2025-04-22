const Address = require('../../models/addressSchema'); 
const Cart    = require('../../models/cartSchema');
const User    = require('../../models/userSchema');
const Product = require('../../models/productSchema');


const getCheckoutPage = async (req,res) => {
        
    try {
        const userId = req.user._id;
        const address = await Address.findOne({ userId });
        if (!address) {
        return res.render('checkout', { addresses: [] });
        }
        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];
    res.render('checkout', { addresses: address.details , items, user: req.user });
    } catch (error) {
        res.redirect("/pageerror");
    }
}

module.exports = {
    getCheckoutPage,
}