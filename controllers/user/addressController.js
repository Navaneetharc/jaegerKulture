const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema'); 
const Cart = require('../../models/cartSchema')
const Wishlist = require('../../models/wishlistSchema');
const mongoose = require('mongoose');


const getMyAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const userId = req.user._id;
    const address = await Address.findOne({ userId });
    if (!address) {
      return res.render('myAddresses', { addresses: [],user });
    }
    let cart = await Cart
                  .findOne({ userId })
                  .populate('items.productId');
            
                const items = cart?.items || [];
    
                let wishlistCount = 0;
    
                if (userId) {
                    const wishlist = await Wishlist.findOne({ userId });
                    wishlistCount = wishlist ? wishlist.products.length : 0;
                }  

    res.render('myAddresses', { addresses: address.details ,user, items, wishlistCount});
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
  };
  

  const getAddMyAddressesPage = async (req, res) => {
    try {
      const user = await User.findById(req.session.user);
      const redirect = req.query.redirect || 'myAddresses';
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
      res.render("addMyAddresses",{user, items, wishlistCount, redirect});
    } catch (error) {
      res.redirect('/pageerror');
    }
  };

  const addMyAddresses = async (req, res) => {
    try {
      const userId = req.user._id;
      
       const { details, redirect } = req.body;

    const {
      addressType,
      name,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      phone,
      altPhone,
      landmark
    } = details[0];
 
      let addressDoc = await Address.findOne({ userId });
  
      if(!addressDoc){
        addressDoc = new Address({
          userId,
          details:[]
        });
      }

      const newIndex = addressDoc.details.length;
      const isDefault = addressDoc.details.length === 0;

    addressDoc.details.push({
        index : newIndex,
        addressType,
        name,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        phone,
        altPhone,
        landmark,
        isDefault,
      });
  
  
      await addressDoc.save();
  
      console.log("Address saved successfully");
      if (redirect === 'checkout') {
    return res.redirect('/checkout');
  } else {
    return res.redirect("/myAddresses?success=Address added successfully");
  }
    } catch (error) {
      console.error("Error adding address:", error);
      return res.redirect("/myAddresses?error=Internal Server Error");
    }
  };


  const setDefaultAddress = async (req, res) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.addressId;
      
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) return res.status(404).send('Address not found');
      
      addressDoc.details.forEach(addr => {
        addr.isDefault = false;
      });
      
      const addressToDefault = addressDoc.details.id(addressId);
      if (!addressToDefault) return res.status(404).send('Address not found');
      
      addressToDefault.isDefault = true;
      
      await addressDoc.save();
      
      return res.redirect('/checkout?success=Default address updated');
    } catch (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
  };

  const deleteAddress = async (req, res) => {
    try {
      const userId = req.user._id;
      const detailId = req.params.detailId;
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) return res.status(404).send('Address not found');
      
      addressDoc.details.pull({ _id: detailId });
      await addressDoc.save();
      
      return res.status(200).send('Address deleted');
    } catch (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
  };
  

  const getEditMyAddressPage = async (req, res) => {

    const user = await User.findById(req.session.user);
    const userId   = req.user._id;
    const detailId = req.params.detailId;
  
    if (!mongoose.Types.ObjectId.isValid(detailId)) {
      return res.status(400).send('Invalid address ID');
    }
  
    try {
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) return res.status(404).send('Address document not found');
  
      const addressDetail = addressDoc.details.id(detailId);
      if (!addressDetail) return res.status(404).send('Address not found');

      let cart = await Cart
                    .findOne({ userId })
                    .populate('items.productId');
              
                  const items = cart?.items || [];
      
                  let wishlistCount = 0;
      
                  if (userId) {
                      const wishlist = await Wishlist.findOne({ userId });
                      wishlistCount = wishlist ? wishlist.products.length : 0;
                  }  
  
      return res.render('editAddresses', {
        address: addressDetail,
        detailId,
        user,
        items,
        wishlistCount
      });
    } catch (error) {
      console.error('Error in getEditMyAddressPage:', error);
      return res.redirect('/pageerror');
    }
  };
  
  const editMyAddresses = async (req, res) => {
    try {
      const userId   = req.user._id;
      const detailId = req.params.detailId;
  
      const updated = Array.isArray(req.body.details)
        ? req.body.details[0]
        : {};
  
      const {
        addressType,
        name,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        phone,
        altPhone,
        landmark
      } = updated;
  
      const makeDefault = req.body.defaultAddress === 'on';
  
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) {
        return res.redirect('/myAddresses?error=Address not found');
      }
  
      const addressDetail = addressDoc.details.id(detailId);
      if (!addressDetail) {
        return res.redirect('/myAddresses?error=Address not found');
      }
  
      addressDetail.name         = name;
      addressDetail.phone        = phone;
      addressDetail.altPhone     = altPhone;
      addressDetail.landmark     = landmark;
      addressDetail.addressLine1 = addressLine1;
      addressDetail.addressLine2 = addressLine2;
      addressDetail.city         = city;
      addressDetail.state        = state;
      addressDetail.pincode      = pincode;
      addressDetail.addressType  = addressType;
  
      if (makeDefault) {
        addressDoc.details.forEach(a => (a.isDefault = false));
        addressDetail.isDefault = true;
      }
  
      await addressDoc.save();
      return res.redirect('/myAddresses?success=Address updated');
    } catch (error) {
      console.error('Error editing address:', error);
      return res.redirect('/myAddresses?error=Internal Server Error');
    }
  };
  
  
  

  module.exports = {

     getMyAddresses, 
     getAddMyAddressesPage, 
     addMyAddresses,
     getEditMyAddressPage,
     editMyAddresses,
     deleteAddress,
     setDefaultAddress,

    };