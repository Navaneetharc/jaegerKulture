
const Address = require('../../models/addressSchema'); 


const getMyAddresses = async (req, res) => {
  try {
    const userId = req.user._id;
    const address = await Address.findOne({ userId });
    if (!address) {
      return res.render('myAddresses', { addresses: [] });
    }
    res.render('myAddresses', { addresses: address.details });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
  };
  

  const getAddMyAddressesPage = async (req, res) => {
    try {
      res.render("addMyAddresses");
    } catch (error) {
      res.redirect('/pageerror');
    }
  };

  const addMyAddresses = async (req, res) => {
    try {
      req.body = req.body.details[0]
      const userId = req.user._id; 
      const { addressType, name, addressLine1, addressLine2, city, state, pincode, phone, altPhone, landmark } = req.body;
 
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
      return res.redirect("/myAddresses?success=Address added successfully");
    } catch (error) {
      console.error("Error adding address:", error);
      return res.redirect("/myAddresses?error=Internal Server Error");
    }
  };

  // default

  const setDefaultAddress = async (req, res) => {
    try {
      const userId = req.user._id;
      const addressId = req.params.addressId;
      
      const addressDoc = await Address.findOne({ userId });
      if (!addressDoc) return res.status(404).send('Address not found');
      
      // Set all addresses to non-default
      addressDoc.details.forEach(addr => {
        addr.isDefault = false;
      });
      
      // Find the address we want to set as default
      const addressToDefault = addressDoc.details.id(addressId);
      if (!addressToDefault) return res.status(404).send('Address not found');
      
      // Set it as default
      addressToDefault.isDefault = true;
      
      await addressDoc.save();
      
      return res.redirect('/checkout?success=Default address updated');
    } catch (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
  };
  // fghjk

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


    const userId   = req.user._id;
    const detailId = req.params.detailId;
  
    if (!mongoose.Types.ObjectId.isValid(detailId)) {
      return res.status(400).send('Invalid address ID');
    }
  
    try {
      const addressDoc = await Address.findOne({ userId });
  
      if (!addressDoc) {
        return res.status(404).send('Address document not found');
      }

      const addressDetail = addressDoc.details.id(detailId);
  
      if (!addressDetail) {
        return res.status(404).send('Address not found');
      }
  
      return res.render('editAddresses', {
        address: addressDetail,
        addressId: detailId
      });
    } catch (error) {
      console.error('Error in getEditMyAddressPage:', error);
      return res.redirect('/pageerror');
    }
  };

  const editMyAddresses = async (req,res) => {
    try {

        const userId   = req.user._id;
        const detailId = req.params.detailId;
        const { addressType, name, addressLine1, addressLine2, city, state, pincode, phone, altPhone, landmark } = req.body;
        
      
    } catch (error) {
      
    }
  }
  
  const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        const existingCategory = await Category.findOne({ 
            name: categoryName, 
            _id: { $ne: id }
        });
        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }

        category.name = categoryName;
        category.description = description;
        
        await category.save();

        res.status(200).redirect('/admin/category');
    } catch (error) {
        console.error("Error editing category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
  

  module.exports = {

     getMyAddresses, 
     getAddMyAddressesPage, 
     addMyAddresses,
     getEditMyAddressPage,
     deleteAddress,
     setDefaultAddress,

    };