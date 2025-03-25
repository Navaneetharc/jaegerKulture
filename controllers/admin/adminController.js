const User = require('../../models/userSchema');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');

const pageerror = async (req,res)=>{
    res.render("admin-error")
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.render("admin-login", { message: null }); // Ensure message is always passed
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;                 
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                console.log("Admin session set:", req.session.admin); // Debugging log
                // req.session.save(() => res.redirect('/admin')); // Ensure session is saved before redirecting
                req.session.save(() => {
                    res.redirect('/admin');  // Redirect to dashboard after saving session
                });
            } else {
                return res.render("admin-login", { message: "Invalid email or password" }); // Send error message
            }
        } else {
            return res.render("admin-login", { message: "Invalid email or password" });
        }
    } catch (error) {
        console.log("Login error:", error);
        return res.redirect("/pageerror");
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render("admin-dashboard");
        } catch (error) {
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};

const logout = async(req,res)=>{
    try {

        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying session ",err);
                return res.redirect('/pageerror')
            }
            res.redirect("/admin/login")
        })
        
    } catch (error) {
        console.log("unexpected error during logout",error);
        res.redirect("/pageerror")
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
};
