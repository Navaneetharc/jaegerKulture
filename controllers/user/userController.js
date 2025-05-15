const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema'); 
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');
const Cart    = require('../../models/cartSchema');


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
        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];

            let wishlistCount = 0;

            if (userId) {
                const wishlist = await Wishlist.findOne({ userId });
                wishlistCount = wishlist ? wishlist.products.length : 0;
            }           

        let productData = await Product.find({
            isBlocked: false,
            category: {$in: categories.map(category => category._id)}
        })
        .sort({createdAt: -1})
        .limit(4)
        .populate('category');
        
        
        if(!productData || productData.length === 0) {
            
            productData = [];
        }

        if(userId){
            const userData = await User.findById(userId);
            return res.render('home',{user: userData, products: productData,items,wishlistCount});
        }else{
            return res.render("home",{products: productData,items,wishlistCount});
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

const signup = async(req, res) => {
    try {       
        const {name, phone, email, password, gender, referralCode} = req.body;
        // console.log(req.body);

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }        
        
        if (referralCode) {
            if (!/^[A-Za-z0-9#]{5,15}$/.test(referralCode)) {
                return res.render("signup", { message: "Invalid referral code format" });
            }
            
            const referrer = await User.findOne({ referralCode });
            if (!referrer) {
                return res.render("signup", { message: "Invalid referral code" });
            }
            
            req.session.referrerId = referrer._id;
            req.session.referralCode = referralCode;
        }

        console.log("Calling generateOtp...");
        const otp = generateOtp();
        console.log("OTP:", otp);

        const emailSent = await sendVerificationEmail(email, otp);

        if(!emailSent) {
            return res.json({ error: 'Failed to send email' });
        }

        req.session.userOtp = otp;
        req.session.userData = {name, phone, email, password, gender};

        res.render("verify-otp");
        
        if (process.env.NODE_ENV === 'development') {
            console.log("OTP Sent:", otp);
        }

    } catch (error) {
        console.error('signup error', error);
        res.redirect('/login');
    }
}



const securePassword = async (password)=>{
    try {
        
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash;

    } catch (error) {
        
    }

    
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    console.log("Expected OTP:", req.session.userOtp);

    if (!req.session.userOtp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired. Please request a new one" });
    }

    if (otp !== req.session.userOtp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please Try Again" });
    }

    const { name, email, phone, password, gender } = req.session.userData;
    const passwordHash = await securePassword(password);

    const newUser = new User({
      name,
      email,
      phone,
      password: passwordHash,
      gender,
      isActive: true
    });
    const savedUser = await newUser.save();

    if (req.session.referrerId) {
      try {
        const referrer = await User.findById(req.session.referrerId);
        if (referrer) {
          await User.findByIdAndUpdate(referrer._id, {
            $inc: { wallet: 25 },
            $push: {
              walletHistory: {
                type:        "credit",
                amount:      25,
                description: "Referral bonus: new signup"
              }
            },
            $push: { redeemedUsers: savedUser._id }
          });

          await new Wallet({
            userId:        referrer._id,
            transactionId: `REF-${Date.now()}`,
            payment_type:  "referral",
            amount:        25,
            status:        "completed",
            entryType:     "CREDIT",
            type:          'referral'
          }).save();

          console.log("Referral bonus of ₹25 added to referrer's wallet");
        }
      } catch (refErr) {
        console.error("Error processing referral bonus:", refErr);
      }
    }

    req.session.user = savedUser._id;
    delete req.session.userOtp;
    delete req.session.referrerId;
    delete req.session.referralCode;

    return res.json({ success: true, redirectUrl: "/" });
  } catch (err) {
    console.error("Error verifying OTP", err);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};




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
        req.session.user = findUser._id;       

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
        const userId   = req.session.user; 
        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
                
        const sortOption = req.query.sort;
        const searchQuery = req.query.query || "";
        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];
        
       
        let sortObject = { createdAt: -1 };
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 }; 
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 };
        }
        
        let query = {
            isBlocked: false,
            category: {$in: categories.map(cat => cat._id)}
        };

       
        if (searchQuery) {
            query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
        }
        
        let wishlistItems = [];
    if (req.session.user) {
        try {
            const wishlist = await Wishlist.findOne({ userId: req.session.user });
            if (wishlist) {
                wishlistItems = wishlist.products.map(item => item.productId.toString());
            }
        } catch (wishlistError) {
            console.error('Error fetching wishlist:', wishlistError);
        }
    }

    let wishlistCount = 0;

    if (userId) {
        const wishlist = await Wishlist.findOne({ userId });
        wishlistCount = wishlist ? wishlist.products.length : 0;
    }


        const products = await Product.find(query)
        .populate('category')
        .sort(sortObject)
        .lean();

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
            searchQuery: searchQuery,
            items,
            wishlistItems: wishlistItems || [] ,
            wishlistCount
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
        const userId   = req.session.user; 
        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];
        
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

        if (searchQuery) {
            query.productName = { $regex: ".*" + searchQuery + ".*", $options: "i" };
        }

        let sortObject = { createdAt: -1 }; 
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 }; 
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 }; 
        }

        const products = await Product.find(query)
            .populate('category')
            .sort(sortObject);

        const categories = await Category.find({ isListed: true });

        let wishlistItems = [];
    if (req.session.user) {
        try {
            const wishlist = await Wishlist.findOne({ userId: req.session.user });
            if (wishlist) {
                wishlistItems = wishlist.products.map(item => item.productId.toString());
            }
        } catch (wishlistError) {
            console.error('Error fetching wishlist:', wishlistError);
        }
    }

    let wishlistCount = 0;

    if (userId) {
        const wishlist = await Wishlist.findOne({ userId });
        wishlistCount = wishlist ? wishlist.products.length : 0;
    }

    

        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = products.slice(startIndex, endIndex);
        const totalPages = Math.ceil(products.length / limit);

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
            searchQuery: searchQuery,
            items,
            wishlistItems: wishlistItems || [] ,
            wishlistCount,
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
        const userId   = req.session.user; 
        let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];

        if (priceRange) {
    
            const prices = priceRange.split(' - ').map(price => 
                parseInt(price.replace('₹', '').replace(',', ''))
            );
            if (prices.length === 2) {
                minPrice = prices[0];
                maxPrice = prices[1];
            }
        }

        let sortObject = { createdAt: -1 }; 
        
        if (sortOption === 'price_low') {
            sortObject = { salePrice: 1 };
        } else if (sortOption === 'price_high') {
            sortObject = { salePrice: -1 };
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

        let wishlistItems = [];
    if (req.session.user) {
        try {
            const wishlist = await Wishlist.findOne({ userId: req.session.user });
            if (wishlist) {
                wishlistItems = wishlist.products.map(item => item.productId.toString());
            }
        } catch (wishlistError) {
            console.error('Error fetching wishlist:', wishlistError);
        }
    }

    let wishlistCount = 0;

    if (userId) {
        const wishlist = await Wishlist.findOne({ userId });
        wishlistCount = wishlist ? wishlist.products.length : 0;
    }

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
            sortOption: sortOption,
            items,
            wishlistItems: wishlistItems || [] ,
            wishlistCount,
        });

    } catch (error) {
        console.error('Error in filterByPrice:', error);
        res.redirect('/shop');
    }
}




const searchProducts = async (req, res) => {
    try {
      const user = req.session.user;
      const userData = user ? await User.findOne({ _id: user }) : null;
      
      
      const searchTerm = req.body.query || req.query.query || req.session.searchQuery || "";
      req.session.searchQuery = searchTerm; 
  
    
      const sortOption = req.query.sort;
      
     
      const categories = await Category.find({ isListed: true }).lean();
      
      let products = [];
      const userId   = req.session.user; 
      let cart = await Cart
              .findOne({ userId })
              .populate('items.productId');
        
            const items = cart?.items || [];
     
      if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
        products = req.session.filteredProducts.filter(product =>
          product.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        const categoryIds = categories.map(category => category._id.toString());
        products = await Product.find({
          productName: { $regex: ".*" + searchTerm + ".*", $options: "i" },
          isBlocked: false,
          category: { $in: categoryIds }
        })
          .populate("category")
          .lean();
      }

      let wishlistItems = [];
      if (req.session.user) {
          try {
              const wishlist = await Wishlist.findOne({ userId: req.session.user });
              if (wishlist) {
                  wishlistItems = wishlist.products.map(item => item.productId.toString());
              }
          } catch (wishlistError) {
              console.error('Error fetching wishlist:', wishlistError);
          }
      }

      let wishlistCount = 0;

      if (userId) {
          const wishlist = await Wishlist.findOne({ userId });
          wishlistCount = wishlist ? wishlist.products.length : 0;
      }
  
      if (sortOption === "price_low") {
        products.sort((a, b) => a.salePrice - b.salePrice);
      } else if (sortOption === "price_high") {
        products.sort((a, b) => b.salePrice - a.salePrice);
      } else {
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
  
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
        searchQuery: searchTerm,
        items,
        wishlistItems: wishlistItems || [] ,
        wishlistCount,
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