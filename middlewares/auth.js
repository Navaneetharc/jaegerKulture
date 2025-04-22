const User = require('../models/userSchema');


const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                req.user = data;
                next();
            }else{
                // If user is blocked or doesn't exist, destroy their session and redirect to login
                req.session.destroy(err => {
                    if(err) console.log("Error destroying session:", err);
                    res.redirect("/login");
                });
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("Internal server error")
        })   
    }else{
        res.redirect("/login")
    }
}

const adminAuth = (req,res,next)=>{
    if(req.session.admin){
        // Find the admin
        User.findOne({isAdmin: true})
        .then(admin => {
            if(admin){
                next();
            } else {
                req.session.destroy(err => {
                    if(err) console.log("Error destroying session:", err);
                    res.redirect("/admin/login");
                });
            }
        })
        .catch(error => {
            console.log("Error in adminAuth middleware:", error);
            res.redirect("/admin/pageerror");
        });
    } else {
        res.redirect("/admin/login");
    }
}

module.exports ={
    userAuth,
    adminAuth
}