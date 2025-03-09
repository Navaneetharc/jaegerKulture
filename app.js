const express = require('express');
const app = express();
const env = require('dotenv').config();
const db = require("./config/db");
db()
const path = require('path');
const adminRouter = require('./routes/adminRouter')

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.use(express.static('public'));


// Admin

app.use('/admin',adminRouter);
app.get('/login', (req, res) => {
    res.render('admin/adminLogin'); 
});
app.get('/dashboard', (req, res) => {
    res.render('admin/admin-dashboard'); 
});
app.get('/customers',(req,res)=>{
    res.render('admin/customer');
})
app.get('/categories',(req,res)=>{
    res.render('admin/categories');
})
app.use('products',(req,res)=>{
    res.render('admin/products')
})


app.listen(3000, () => console.log(`Server running on http://localhost:3000`));

module.exports = app;
