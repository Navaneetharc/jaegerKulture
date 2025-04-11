const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');


const pageNotFound = async(req,res)=>{
    try {

        res.render('page-404')
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const loadSignup = async (req,res)=>{
    try {
        return res.render('signup');
    } catch (error) {
        console.error('Home page not loading:',error);
        res.status(500).send('Server Error');
    }
}


const loadHomepage = async (req, res) => {
    try {
        const userId = req.session.user;
        const categories = await Category.find({isListed:true});
        // console.log("Found categories:", categories);

        let productData = await Product.find({
            isBlocked: false,
            category: {$in: categories.map(category => category._id)}
        })
        .sort({createdAt: -1})
        .limit(4)
        .populate('category');

        // console.log("Found products:", JSON.stringify(productData, null, 2));
        // console.log("Product image paths:", productData.map(p => p.productImage));

        if(!productData || productData.length === 0) {
            
            productData = [];
        }

        if(userId){
            const userData = await User.findById(userId);
            return res.render('home',{user: userData, products: productData});
        }else{
            return res.render("home",{products: productData});
        }

    } catch (error) {
        console.log("Error in loading homepage:", error);
        res.status(500).send("Server error");
    }
};



function generateOtp() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP:", otp);  
    return otp;
}


async function sendVerificationEmail(email,otp){
    try {
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',  
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD  
            }
        });

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to: email,
            subject:"Verify your account bro!",
            text:`Your OTP is ${otp}`,
            html:`<b> your OTP : ${otp}</b>`,
        })

        return info.accepted.length > 0

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async(req,res)=>{

    try {
        
        const {name,phone,email,password,cPassword} = req.body;

        console.log(req.body);
        
        const findUser = await User.findOne({ email });
        if (findUser) {
            
            return res.render("signup", { message: "User with this email already exists" });
        }
        
        console.log("Calling generateOtp...");
        const otp = generateOtp();
        console.log("OTP:", otp);


        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json({ error: 'Failed to send email' });
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        res.render("verify-otp");
        
        if (process.env.NODE_ENV === 'development') {
            console.log("OTP Sent:", otp);
        }
        

    } catch (error) {

        console.error('signup error',error);
        res.redirect('/pageNotFound')
        
    }
}

const securePassword = async (password)=>{
    try {
        
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash;

    } catch (error) {
        
    }
}

const verifyOtp = async(req,res)=>{
    try {
        const {otp} = req.body;

        console.log("Recieved OTP:",otp);
        console.log("Expected OTP:",req.session.userOtp);

        if (!req.session.userOtp) {
            return res.status(400).json({success: false, message: "OTP has expired. Please request a new one"});
        }

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;
            delete req.session.userOtp; // Clear the OTP after successful verification
            return res.json({success:true,redirectUrl:"/"})
        }else{
            return res.status(400).json({success:false, message:"Invalid OTP, Please Try Again"})
        }

    } catch (error) {

        console.error("Error verifying OTP",error);
        return res.status(500).json({success:false,message:"An error occured"})
        
    }
}

const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please Try again"});
        }
    } catch (error) {

        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please Try again"})
        
    }
}

const loadLogin = async (req,res)=>{
    try {
        
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }

    } catch (error) {
        res.redirect("/pageNotFound");
    }
} 

const login = async(req,res)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:false,email:email});
        if(!findUser){
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by Admin"})
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        // console.log("Session Before Setting User:", req.session);
        req.session.user = findUser._id;
        // console.log("Session After Setting User:", req.session);
       

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("login", { message: "Session error. Please try again." });
            }
            console.log("Session successfully saved.");
            res.redirect("/");
        });


    } catch (error) {
        
        console.error("Login error",error);
        res.render("login",{message:"Login failed. Please try again later"})

    }
}

const logout = async (req,res)=>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound");
            }
            return res.redirect('/login')
        })

    } catch (error) {

        console.log("Logout error",error);
        res.redirect("/pageNotFound")
        
    }
}
 
const loadShoppingPage = async(req,res)=>{
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
        
        // Get sort parameter from query
        const sortOption = req.query.sort;
        const searchQuery = req.query.query || "";
        
        // Define sort object based on sort option
        let sortObject = { createdAt: -1 }; // Default sort
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 }; // Sort by price low to high
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 }; // Sort by price high to low
        }
        
        let query = {
            isBlocked: false,
            category: {$in: categories.map(cat => cat._id)}
        };

        // Add search query if it exists
        if (searchQuery) {
            query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
        }
        
        const products = await Product.find(query)
        .populate('category')
        .sort(sortObject)
        .lean();

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 6;
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(products.length / itemsPerPage);
        const currentProduct = products.slice(startIndex, endIndex);

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalProducts: products.length,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: null,
            sortOption: sortOption,
            searchQuery: searchQuery
        });

    } catch (error) {
        console.error('Error in loadShoppingPage:', error);
        res.redirect('/pageNotFound');
    }
}

const filterProduct = async(req,res)=>{
    try {
        const user = req.session.user;
        const categoryId = req.query.category;
        const priceRange = req.query.price;
        const sortOption = req.query.sort;
        const searchQuery = req.query.query || "";
        
        let query = {
            isBlocked: false
        };

        if (categoryId) {
            query.category = categoryId;
        }

        if (priceRange) {
            const prices = priceRange.split(' - ').map(price => 
                parseInt(price.replace('₹', '').replace(',', ''))
            );

            if (prices.length === 2) {
                query.salePrice = {
                    $gte: prices[0],
                    $lte: prices[1]
                };
            }
        }
        
        if (!categoryId) {
            const categories = await Category.find({ isListed: true });
            query.category = { $in: categories.map(cat => cat._id) };
        }

        // Add search query if it exists
        if (searchQuery) {
            query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
        }

        // Define sort object based on sort option
        let sortObject = { createdAt: -1 }; // Default sort
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 }; // Sort by price low to high
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 }; // Sort by price high to low
        }

        const products = await Product.find(query)
            .populate('category')
            .sort(sortObject);

        const categories = await Category.find({ isListed: true });

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = products.slice(startIndex, endIndex);
        const totalPages = Math.ceil(products.length / limit);

        // Get user data if logged in
        let userData = null;
        if (user) {
            userData = await User.findById(user);
            if (userData && categoryId) {
                userData.searchEntry = userData.searchEntry || [];
                userData.searchEntry.push({
                    category: categoryId,
                    searchedOn: new Date()
                });
                await userData.save();
            }
        }

        // Get price range for display if it exists
        let priceRangeObj = null;
        if (priceRange) {
            const prices = priceRange.split(' - ').map(price => 
                parseInt(price.replace('₹', '').replace(',', ''))
            );
            if (prices.length === 2) {
                priceRangeObj = {
                    min: prices[0],
                    max: prices[1]
                };
            }
        }

        res.render('shop', {
            user: userData,
            products: paginatedProducts,
            category: categories,
            totalProducts: products.length,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: categoryId,
            priceRange: priceRangeObj,
            sortOption: sortOption,
            searchQuery: searchQuery
        });

    } catch (error) {
        console.error('Error in filterProduct:', error);
        res.redirect('/shop');
    }
}

const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id: user});
        const categories = await Category.find({isListed: true}).lean();

        const priceRange = req.query.price;
        const sortOption = req.query.sort;
        let minPrice = 0;
        let maxPrice = Number.MAX_VALUE;

        if (priceRange) {
    
            const prices = priceRange.split(' - ').map(price => 
                parseInt(price.replace('₹', '').replace(',', ''))
            );
            if (prices.length === 2) {
                minPrice = prices[0];
                maxPrice = prices[1];
            }
        }

        // Define sort object based on sort option
        let sortObject = { createdAt: -1 }; // Default sort
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 }; // Sort by price low to high
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 }; // Sort by price high to low
        }

        const findProducts = await Product.find({
            salePrice: {
                $gte: minPrice,
                $lte: maxPrice
            },
            isBlocked: false,
            category: { $in: categories.map(cat => cat._id) }
        })
        .populate('category')
        .sort(sortObject)
        .lean();

        // Pagination
        const itemsPerPage = 6;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        res.render('shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            totalProducts: findProducts.length,
            currentPage: currentPage,
            totalPages: totalPages,
            selectedCategory: null,
            priceRange: {
                min: minPrice,
                max: maxPrice
            },
            sortOption: sortOption
        });

    } catch (error) {
        console.error('Error in filterByPrice:', error);
        res.redirect('/shop');
    }
}




// const searchProducts = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const userData = user ? await User.findOne({ _id: user }) : null;
//         const search = req.body.query || "";
//         const categories = await Category.find({ isListed: true }).lean();

//         let products = [];
//         // Check if filtered products are available in session
//         if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
//             // Use filtered products from the session
//             products = req.session.filteredProducts.filter(product =>
//                 product.productName.toLowerCase().includes(search.toLowerCase())
//             );
//         } else {
//             // Otherwise, search the entire product collection with common filters
//             const categoryIds = categories.map(category => category._id.toString());
//             products = await Product.find({
//                 productName: { $regex: ".*" + search + ".*", $options: "i" },
//                 isBlocked: false,
//                 category: { $in: categoryIds }
//             })
//                 .populate("category")
//                 .lean();
//         }

//         // Sort products by creation date descending (most recent first)
//         products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//         // Pagination setup
//         const itemsPerPage = 6;
//         const currentPage = parseInt(req.query.page) || 1;
//         const startIndex = (currentPage - 1) * itemsPerPage;
//         const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);
//         const totalPages = Math.ceil(products.length / itemsPerPage);

//         res.render("shop", {
//             user: userData,
//             products: paginatedProducts,
//             category: categories,
//             totalProducts: products.length,
//             currentPage: currentPage,
//             totalPages: totalPages,
//             selectedCategory: req.query.category || null,
//             sortOption: req.query.sort || null,
//             priceRange: req.query.price || null,
//             searchQuery: search
//         });
//     } catch (error) {
//         console.error("Error in searchProducts:", error);
//         res.redirect("/pageNotFound");
//     }
// };

const searchProducts = async (req, res) => {
    try {
      const user = req.session.user;
      const userData = user ? await User.findOne({ _id: user }) : null;
      
      // Get the search term from body, query, or session.
      // This makes sure that when you sort (a GET request), the search term is preserved.
      const searchTerm = req.body.query || req.query.query || req.session.searchQuery || "";
      req.session.searchQuery = searchTerm; // persist for subsequent requests
  
      // Get sort option from query parameters
      const sortOption = req.query.sort;
      
      // Fetch categories that are listed
      const categories = await Category.find({ isListed: true }).lean();
      
      let products = [];
      // If filtered products exist in session, search within that subset
      if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
        products = req.session.filteredProducts.filter(product =>
          product.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        // Otherwise, search in the entire collection (restricted by listed categories)
        const categoryIds = categories.map(category => category._id.toString());
        products = await Product.find({
          productName: { $regex: ".*" + searchTerm + ".*", $options: "i" },
          isBlocked: false,
          category: { $in: categoryIds }
        })
          .populate("category")
          .lean();
      }
  
      // Apply sorting only on the searched products
      if (sortOption === "price_low") {
        products.sort((a, b) => a.salePrice - b.salePrice);
      } else if (sortOption === "price_high") {
        products.sort((a, b) => b.salePrice - a.salePrice);
      } else {
        // Default sort by creation date (newest first)
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
  
      // Pagination setup
      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);
      const totalPages = Math.ceil(products.length / itemsPerPage);
      
      res.render("shop", {
        user: userData,
        products: paginatedProducts,
        category: categories,
        totalProducts: products.length,
        currentPage: currentPage,
        totalPages: totalPages,
        selectedCategory: req.query.category || null,
        sortOption: sortOption || null,
        priceRange: req.query.price || null,
        searchQuery: searchTerm
      });
    } catch (error) {
      console.error("Error in searchProducts:", error);
      res.redirect("/pageNotFound");
    }
  };
  


module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,
}