require('dotenv').config();
const express = require('express');
const db = require("./config/db");
const path = require('path');
const adminRouter = require('./routes/adminRouter');
const userRouter = require('./routes/userRouter');
const session = require('express-session');
const passport = require('./config/passport');
const methodOverride = require('method-override');

const app = express();
db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(methodOverride('_method')); 


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}))



app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
})



app.set('view engine', 'ejs');
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));





app.use("/",userRouter);
app.use("/admin",adminRouter);




const port = process.env.PORT || 4000;

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

module.exports = app