const Category = require("../../models/categorySchema");


const categoryInfo = async (req,res)=>{
    try {
        // ----
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        // ----
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
    const {name, description, Visibility} = req.body;
    try {
        console.log("Received category data:", {name, description, Visibility});

        const existingCategory = await Category.findOne({name});
        if(existingCategory){
            return res.redirect("/admin/category?error=Category already exists");
        }

        const newCategory = new Category({
            name,
            description,
            isListed: Visibility === "List" ? true : false
        });

        await newCategory.save();
        console.log("Category saved successfully:", newCategory);
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
        const { categoryName, description } = req.body;

        // Find the category to ensure it exists
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Check for duplicate category name (excluding the current category)
        const existingCategory = await Category.findOne({ 
            name: categoryName, 
            _id: { $ne: id } // Exclude the current category from the check
        });
        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }

        // Update the category (PUT replaces the resource)
        category.name = categoryName;
        category.description = description;
        // Note: If you want to update isListed here, include it in the form and req.body

        await category.save();

        // Return a 200 OK status with a redirect (REST-compliant for web apps)
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