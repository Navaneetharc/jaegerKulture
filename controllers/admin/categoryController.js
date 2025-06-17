const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");


const categoryInfo = async (req,res)=>{
    try {
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;

        const categoryData = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: "i" }
        })
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalCategory = await Category.find({
            name: { $regex: ".*" + search + ".*", $options: "i" }
        }).countDocuments();

        const totalPage = Math.ceil(totalCategory/limit);
        res.render('category',{
            cat : categoryData,
            currentPage : page,
            totalPages : totalPage,
            totalCategories :  totalCategory,
            search: search,
            error: req.query.error,
            success: req.query.success
        });

    } catch (error) {
        
        console.error(error);
        res.redirect("/admin/pageerror");

    }
}

const addCategory = async(req,res)=>{
    const {name, description, Visibility, categoryOffer : rawOffer} = req.body;
    const offer       = Math.max(0, Math.min(100, parseFloat(rawOffer) || 0));
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    try {
        // console.log("Received category data:", { trimmedName, trimmedDesc, Visibility, offer });

        const existingCategory = await Category.findOne({ name: { $regex: `^${trimmedName}$`, $options: "i" } });
       
                    
        if(existingCategory){
            return res.redirect("/admin/category?error=Category already exists");
        }

        const newCategory = new Category({
            name:        trimmedName,
            description: trimmedDesc,
           categoryOffer: offer,
           isListed:    Visibility === "List"
        });           

        await newCategory.save();
        // console.log("Category saved successfully:", newCategory);

        const products = await Product.find({ category: newCategory._id });
        for (const product of products) {
        const basePrice    = Number(product.regularPrice);
        const prodOfferPct = Number(product.productOffer);
        if (Number.isNaN(basePrice) || Number.isNaN(prodOfferPct)) continue;

        const offerPercent = Math.max(newCategory.categoryOffer, prodOfferPct);
        const rawSale      = basePrice * (1 - offerPercent / 100);
        const salePrice    = Math.round(rawSale * 100) / 100;

        product.salePrice = salePrice;
        await product.save();
        }

        return res.redirect("/admin/category?success=Category added successfully");
        
    } catch (error) {
        console.error("Error adding category:", error);
        return res.redirect("/admin/category?error=Internal Server Error");
    }
}

const getListCategory = async (req,res)=>{
    try {

        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect("/admin/category");

    } catch (error) {

        res.redirect('/admin/pageerror');
        
    }
}

const getUnlistCategory = async (req,res)=>{
    try {

        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");
        
    } catch (error) {

        res.redirect('/admin/pageerror');
        
    }
}

const getEditCategory = async (req,res)=>{
    try {
        
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category});

    } catch (error) {

        res.redirect("/admin/pageerror")
        
    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const {
                      categoryName,
                      description: rawDesc,
                      categoryOffer: rawOffer
            } = req.body;

        const offer = Math.max(0, Math.min(100, parseFloat(rawOffer) || 0));
        const trimmedName  = categoryName.trim();
        const trimmedDesc  = rawDesc.trim();
        
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        const existingCategory = await Category.findOne({
          name: { $regex: `^${trimmedName}$`, $options: "i" },
         _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }

        category.name         = trimmedName;
        category.description  = trimmedDesc;
        category.categoryOffer = offer;
        
        await category.save();

        const products = await Product.find({ category: id });
          for (const product of products) {
            const basePrice     = Number(product.regularPrice);
            const prodOfferPct  = Number(product.productOffer);
        
            if (Number.isNaN(basePrice) || Number.isNaN(prodOfferPct)) {
              console.warn(
                `Skipping product ${product._id} — invalid regularPrice or productOffer:`,
                product.regularPrice, product.productOffer
              );
              continue;
            }
        
            const offerPercent   = Math.max(offer, prodOfferPct);
            const rawSalePrice   = basePrice * (1 - offerPercent / 100);
            const roundedSale    = Math.round(rawSalePrice * 100) / 100;
        
            product.salePrice = roundedSale;
            await product.save();
          }
            

        res.status(200).redirect('/admin/category');
    } catch (error) {
        console.error("Error editing category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
}