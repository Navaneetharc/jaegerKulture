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
            search: search

        });

    } catch (error) {
        
        console.error(error);
        res.redirect("/admin/pageerror");

    }
}

const addCategory = async(req,res)=>{
    const {name,description, Visibility} = req.body;
    try {

        const existingCategory = await Category.findOne({name});
        if(existingCategory){
            return res.status(400).json({error:"Category already exist"})
        }
        const newCategory = new Category({
            name,
            description,
            isListed: Visibility === "List" ? true : false
        })

        await newCategory.save();
        return res.json({message:"Category added succesfully"})
        
    } catch (error) {
        
        return res.status(500).json({error:"Internal Server Error"})
        
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

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
}