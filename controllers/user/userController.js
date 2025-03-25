const User = require('../../models/userSchema');
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

// const loadHomepage = async(req,res)=>{
//     try {
//         const user = req.session.user;
//         if(user){

//             const userData = await User.findOne({_id:user._id});
//             res.render("home",{user:userData})

//         }else{
//             return res.render("home",{user:null});
//         }
        
//     } catch (error) {
//         console.log('Home page not found')
//         res.status(500).send("Server error");
//     }
// }
const loadHomepage = async (req, res) => {
    try {
        // console.log("Session User Data:", req.session.user); // Debugging: Check what's stored in the session

        if (!req.session.user) {
            return res.render("home", { user: null });
        }

        // console.log("Session User ID:", req.session.user); // Debugging: Show user ID from session
        
        const userData = await User.findById(req.session.user);
        
        if (!userData) {
            console.log("User not found in DB");
            return res.render("home", { user: null });
        }

        res.render("home", { user: userData });
    } catch (error) {
        console.log("Error in loadHomepage:", error);
        res.status(500).send("Server error");
    }
};
// dfghj


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

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout
}