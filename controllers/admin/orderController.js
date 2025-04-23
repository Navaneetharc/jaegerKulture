const Order = require('../../models/orderSchema');


const getOrderManagement = async(req,res)=>{
    try {
        res.render('orderManagement');
    } catch (error) {
        res.redirect("/pageerror");
    }
}

module.exports = {
    getOrderManagement,
}