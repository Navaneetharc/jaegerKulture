const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');

function generateOtp(){
    const digits = "1234567890";
    let otp  = "";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP : ${otp}</h4></b>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: ", info.messageId); 

        return true;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
};

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    } catch (error) {
        
    }
}

const getForgotPassPage = async(req,res)=>{
    try {
        res.render("forgot-password");      
    } catch (error) {
        res.redirect('/pageNotFound');        
    }
}
const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                console.log('OTP:', otp);
                res.render('forgotPass-otp');  
            } else {
                res.render("forgot-password", { message: "Failed to send OTP. Please try again" });
            }

        } else {
            res.redirect('/forgot-password?error=1');
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;     
        if (!req.session.userOtp) {
            return res.json({success: false, message: "OTP has expired. Please request a new one"});
        }

        if(enteredOtp === req.session.userOtp){
            
            delete req.session.userOtp;
            res.json({success:true, redirectUrl:'/reset-password'});
        }else{
            res.json({success:false, message:"OTP is not matching"});
        }
    } catch (error) {
        res.status(500).json({success:false, message:"An error occurred, please try again"});
    }
}

const postNewPassword = async(req,res)=>{
    try {
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1 === newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login");
        }else{
            res.render('reset-password',{message:"Passwords did not matched"});
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const resendForgotPassOtp = async(req,res)=>{
    try {
        const email = req.session.email;
        if(!email){
            return res.status(400).json({success:false, message:"Email not found in session"});
        }
        
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        
        if(emailSent){
            delete req.session.userOtp;
            req.session.userOtp = otp;
            res.status(200).json({success:true, message:"OTP Resent Successfully"});
            console.log("Resend OTP: ",otp) 
        }else{
            res.status(500).json({success:false, message:"Failed to resend OTP. Please try again"});
        }
    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false, message:"Internal Server Error. Please try again"});
    }
}

const getResetPassPage = async(req,res)=>{
    try {
        res.render("reset-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendForgotPassOtp,
    postNewPassword,
}


