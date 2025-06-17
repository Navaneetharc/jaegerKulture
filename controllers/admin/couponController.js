const { validationResult } = require('express-validator');
const Coupon = require('../../models/couponSchema');

const loadCouponManagement = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    const { success, error } = req.query;
    return res.render('couponManagement', {
      coupons,
      success,
      error
    });
  } catch (err) {
    console.error('Error loading coupons:', err);
    return res.render('admin/pageerror');
  }
};

const addCoupon = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.xhr) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }
    return res.redirect(`/admin/coupons?error=${encodeURIComponent(errors.array()[0].msg)}`);
  }

  let { name, code, description, startDate, expiryDate, minPrice, offerPrice, usageType, status } = req.body;

  usageType = usageType === 'single' ? 'single-use' : 'multi-use';
  status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  if (new Date(expiryDate) <= new Date(startDate)) {
    if (req.xhr) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be after start date'
      });
    }
    return res.redirect(`/admin/coupons?error=${encodeURIComponent('Expiry date must be after start date')}`);
  }

  try {
    const newCoupon = new Coupon({
      name,
      code,
      description,
      startDate,
      expiryDate,
      minPrice,
      offerPrice,
      usageType,
      status
    });

    await newCoupon.save();
    // console.log('Coupon saved:', newCoupon.code);
    
    if (req.xhr) {
      return res.status(200).json({
        success: true,
        message: `Coupon ${code} created successfully!`
      });
    }
    
    return res.redirect('/admin/coupons?success=Coupon created successfully');

  } catch (err) {
    console.error("Error adding coupon:", err);
    
    let errorMessage = 'Error adding coupon';
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      errorMessage = `${field} already exists`;
    }
    
    if (req.xhr) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }
    
    return res.redirect(`/admin/coupons?error=${encodeURIComponent(errorMessage)}`);
  }
};

const updateCoupon = async (req, res) => {
  const { couponId } = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }

  try {
    let { name, code, description, startDate, expiryDate, minPrice, offerPrice } = req.body;
    let usageType = req.body.editUsageType === 'single' ? 'single-use' : 'multi-use';
    let status = req.body.editStatus === 'active' ? 'Active' : 'Inactive';

    if (new Date(expiryDate) <= new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be after start date'
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        name,
        code,
        description,
        startDate,
        expiryDate,
        minPrice,
        offerPrice,
        usageType,
        status
      },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // console.log('Coupon updated:', updatedCoupon.code);
    
    if (req.xhr) {
      return res.json({
        success: true,
        message: `Coupon ${code} updated successfully!`
      });
    }
    
    return res.redirect('/admin/coupons?success=Coupon updated successfully');

  } catch (err) {
    console.error('Error updating coupon:', err);
    
    let errorMessage = 'Error updating coupon';
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      errorMessage = `${field} already exists`;
    }
    
    if (req.xhr) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }
    
    return res.redirect(`/admin/coupons?error=${encodeURIComponent(errorMessage)}`);
  }
};

const activateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { status: 'Active' },
      { new: true }
    );

    if (!updatedCoupon) {
      if (req.xhr) {
        return res.status(404).json({
          success: false,
          message: 'Coupon not found'
        });
      }
      
      return res.redirect('/admin/coupons?error=Coupon not found');
    }

    if (req.xhr) {
      return res.json({
        success: true,
        message: `Coupon ${updatedCoupon.code} activated successfully!`
      });
    }
    
    return res.redirect('/admin/coupons?success=Coupon activated successfully');
  } catch (err) {
    console.error('Error activating coupon:', err);
    
    if (req.xhr) {
      return res.status(500).json({
        success: false,
        message: 'Error activating coupon'
      });
    }
    
    return res.redirect('/admin/pageerror');
  }
};

const deactivateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { status: 'Inactive' },
      { new: true }
    );

    if (!updatedCoupon) {
      if (req.xhr) {
        return res.status(404).json({
          success: false,
          message: 'Coupon not found'
        });
      }
      
      return res.redirect('/admin/coupons?error=Coupon not found');
    }

    if (req.xhr) {
      return res.json({
        success: true,
        message: `Coupon ${updatedCoupon.code} deactivated successfully!`
      });
    }
    
    return res.redirect('/admin/coupons?success=Coupon deactivated successfully');
  } catch (err) {
    console.error('Error deactivating coupon:', err);
    
    if (req.xhr) {
      return res.status(500).json({
        success: false,
        message: 'Error deactivating coupon'
      });
    }
    
    return res.redirect('/admin/pageerror');
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      if (req.xhr) {
        return res.status(404).json({
          success: false,
          message: 'Coupon not found'
        });
      }
      
      return res.redirect('/admin/coupons?error=Coupon not found');
    }

    if (req.xhr) {
      return res.json({
        success: true,
        message: `Coupon ${deletedCoupon.code} deleted successfully!`
      });
    }
    
    return res.redirect('/admin/coupons?success=Coupon deleted successfully');
  } catch (err) {
    console.error('Error deleting coupon:', err);
    
    if (req.xhr) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting coupon'
      });
    }
    
    return res.redirect('/admin/pageerror');
  }
};

module.exports = {
  loadCouponManagement,
  addCoupon,
  updateCoupon,
  activateCoupon,
  deactivateCoupon,
  deleteCoupon
};