const User = require('../models/userSchema');


const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                req.user = data;
                next();
            }else{
               delete req.session.user;
               req.session.save(() => res.redirect("/login"));
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
        User.findOne({isAdmin: true})
        .then(admin => {
            if(admin){
                next();
            } else {
               delete req.session.admin;
               req.session.save(() => redirect("/admin/login"));
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