const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const pageerror = async (req, res) => {
    res.render("admin-error");
};

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.render("admin-login", { message: null });
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;                 
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                // console.log("Admin session set:", req.session.admin);
                req.session.save(() => {
                    res.redirect('/admin');
                });
            } else {
                return res.render("admin-login", { message: "Invalid email or password" });
            }
        } else {
            return res.render("admin-login", { message: "Invalid email or password" });
        }
    } catch (error) {
        console.log("Login error:", error);
        return res.redirect("/admin/pageerror");
    }
};

const getDateRanges = () => {
    const now = new Date();
    
    // Weekly range (current week - Monday to Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Monthly range (current month)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Yearly range (current year)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    endOfYear.setHours(23, 59, 59, 999);
    
    return {
        weekly: { start: startOfWeek, end: endOfWeek },
        monthly: { start: startOfMonth, end: endOfMonth },
        yearly: { start: startOfYear, end: endOfYear }
    };
};

// Helper function to calculate stats for a specific time period
const calculatePeriodStats = async (startDate, endDate) => {
    try {
        // Revenue for the period
        const revenueData = await Order.aggregate([
            { 
                $match: { 
                    status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
        ]);
        const revenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
        
        // Orders for the period
        const orders = await Order.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        // Products and categories (these don't change by time period, but we can get current totals)
        const products = await Product.countDocuments();
        const categories = await Category.countDocuments();
        
        return {
            revenue: revenue,
            orders: orders,
            products: products,
            categories: categories
        };
    } catch (error) {
        console.error('Error calculating period stats:', error);
        return {
            revenue: 0,
            orders: 0,
            products: 0,
            categories: 0
        };
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            const dateRanges = getDateRanges();
            
            const weeklyStats = await calculatePeriodStats(dateRanges.weekly.start, dateRanges.weekly.end);
            const monthlyStats = await calculatePeriodStats(dateRanges.monthly.start, dateRanges.monthly.end);
            const yearlyStats = await calculatePeriodStats(dateRanges.yearly.start, dateRanges.yearly.end);
            
            const revenueData = await Order.aggregate([
                { $match: { status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] } } },
                { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
            ]);
            const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
            
            const totalOrders = await Order.countDocuments();
            const totalProducts = await Product.countDocuments();
            const totalCategories = await Category.countDocuments();
            
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const monthlyEarningData = await Order.aggregate([
                { 
                    $match: { 
                        status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] },
                        createdAt: { 
                            $gte: new Date(`${currentYear}-${currentMonth}-01`),
                            $lt: new Date(currentMonth === 12 ? `${currentYear + 1}-01-01` : `${currentYear}-${currentMonth + 1}-01`)
                        }
                    }
                },
                { $group: { _id: null, monthlyEarning: { $sum: "$totalAmount" } } }
            ]);
            const monthlyEarning = monthlyEarningData.length > 0 ? monthlyEarningData[0].monthlyEarning : 0;
            
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const weeklySales = await Order.aggregate([
                {
                    $match: {
                        status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] },
                        createdAt: { $gte: startOfWeek }
                    }
                },
                {
                    $group: {
                        _id: { $dayOfWeek: "$createdAt" },
                        totalAmount: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const weeklyChartData = daysOfWeek.map((day, index) => {
                const dayData = weeklySales.find(item => item._id === index + 1);
                return dayData ? dayData.totalAmount : 0;
            });
            
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            
            const monthlySales = await Order.aggregate([
                {
                    $match: {
                        status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] },
                        createdAt: { $gte: startOfYear }
                    }
                },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        totalAmount: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthlyChartData = months.map((month, index) => {
                const monthData = monthlySales.find(item => item._id === index + 1);
                return monthData ? monthData.totalAmount : 0;
            });
            
            const yearStart = new Date();
            yearStart.setFullYear(yearStart.getFullYear() - 5);
            yearStart.setMonth(0, 1);
            yearStart.setHours(0, 0, 0, 0);
            
            const yearlySales = await Order.aggregate([
                {
                    $match: {
                        status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] },
                        createdAt: { $gte: yearStart }
                    }
                },
                {
                    $group: {
                        _id: { $year: "$createdAt" },
                        totalAmount: { $sum: "$totalAmount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            const currentYearNum = new Date().getFullYear();
            const years = Array.from({ length: 6 }, (_, i) => (currentYearNum - 5 + i).toString());
            const yearlyChartData = years.map(year => {
                const yearData = yearlySales.find(item => item._id === parseInt(year));
                return yearData ? yearData.totalAmount : 0;
            });
            
            const bestSellingCategories = await Order.aggregate([
                { $match: { status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] } } },
                { $unwind: "$orderItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "productDetails.category",
                        foreignField: "_id",
                        as: "categoryDetails"
                    }
                },
                { $unwind: "$categoryDetails" },
                {
                    $group: {
                        _id: "$categoryDetails._id",
                        categoryName: { $first: "$categoryDetails.name" },
                        totalSales: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } }
                    }
                },
                { $sort: { totalSales: -1 } },
                { $limit: 10 }
            ]);
            
            const bestSellingProducts = await Order.aggregate([
                { $match: { status: { $in: ['Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered'] } } },
                { $unwind: "$orderItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" },
                {
                    $group: {
                        _id: "$orderItems.product",
                        productName: { $first: "$productDetails.productName" },
                        totalSales: { $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] } },
                        totalQuantity: { $sum: "$orderItems.quantity" }
                    }
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 5 }
            ]);
            
            const totalSalesValue = bestSellingProducts.reduce((sum, product) => sum + product.totalQuantity, 0);
            
            const topProducts = bestSellingProducts.map(product => {
                return {
                    ...product,
                    percentage: Math.round((product.totalQuantity / totalSalesValue) * 100)
                };
            });
            
            const categoryChartData = {
                labels: bestSellingCategories.map(cat => cat.categoryName),
                data: bestSellingCategories.map(cat => cat.totalSales)
            };
            
            res.render("admin-dashboard", {
                totalRevenue,
                totalOrders,
                totalProducts,
                totalCategories,
                monthlyEarning,
                weeklyChartData,
                monthlyChartData,
                yearlyChartData,
                categoryChartData,
                topProducts,
                weeklyStats,
                monthlyStats,
                yearlyStats
            });
            
        } catch (error) {
            console.error("Dashboard load error:", error);
            res.redirect("/admin/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};

const logout = async (req, res) => {
    try {
       delete req.session.admin;
       req.session.save(err => {
        if(err){
            console.log("Error saving session on admin logout", err);
            return res.redirect('/admin/pageerror');
        }
        res.redirect("/admin/login");
       });
    } catch (error) {
        console.log("Unexpected error during logout", error);
        res.redirect("/admin/pageerror");
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,  
    pageerror,
    logout,
};

