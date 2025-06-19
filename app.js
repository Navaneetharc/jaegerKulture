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

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next();
});


const MemoryStore = session.MemoryStore;
const userStore  = new MemoryStore();
const adminStore = new MemoryStore();



const adminSession = session({
        name:'admin_sid',
        store: adminStore,
        secret: process.env.ADMIN_SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            path: '/admin',
            secure: process.env.NODE_ENV == 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        },
    });


app.use("/admin",adminSession,adminRouter);


const userSession = session({
    name: 'user_sid',
    store: userStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 manikkur
    }
});

app.use('/', userSession, passport.initialize(), passport.session(), userRouter);



app.set('view engine', 'ejs');
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));



const port = process.env.PORT || 4000;

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));



module.exports = app 