require('dotenv').config();
const express = require('express');
const db = require("./config/db");
const path = require('path');
const adminRouter = require('./routes/adminRouter');
const userRouter = require('./routes/userRouter');
const session = require('express-session');
const passport = require('./config/passport');

const app = express();
db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))



app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
})



app.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));


app.get(
  "/google/callback",
  passport.authenticate("google", {
    successRedirect: "/", 
    failureRedirect: "/login", 
  })
);

app.set('view engine', 'ejs');
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static('public'));


app.use("/",userRouter);
app.use("/admin",adminRouter);

// app.get("/cate",(req,res)=>{
//   res.render('category');
// })


const port = process.env.PORT || 4000;

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

module.exports = app