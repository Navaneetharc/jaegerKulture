const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const moment = require('moment');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const csv = require('fast-csv');

const getDateRange = (filterType) => {
    const now = moment();
    let startDate, endDate;
    
    switch(filterType) {
        case 'today':
            startDate = now.clone().startOf('day');
            endDate = now.clone().endOf('day');
            break;
        case 'yesterday':
            startDate = now.clone().subtract(1, 'days').startOf('day');
            endDate = now.clone().subtract(1, 'days').endOf('day');
            break;
        case 'last7days':
            startDate = now.clone().subtract(7, 'days').startOf('day');
            endDate = now.clone().endOf('day');
            break;
        case 'last30days':
            startDate = now.clone().subtract(30, 'days').startOf('day');
            endDate = now.clone().endOf('day');
            break;
        case 'thisMonth':
            startDate = now.clone().startOf('month');
            endDate = now.clone().endOf('day');
            break;
        case 'lastMonth':
            startDate = now.clone().subtract(1, 'month').startOf('month');
            endDate = now.clone().subtract(1, 'month').endOf('month');
            break;
        case 'custom':
            return { startDate: null, endDate: null };
        default:
            startDate = now.clone().subtract(7, 'days').startOf('day');
            endDate = now.clone().endOf('day');
    }
    
    return { 
        startDate: startDate.toDate(), 
        endDate: endDate.toDate() 
    };
};

const processOrdersData = (orders) => {
    let totalRevenue = 0;
    let totalOrders = orders.length;
    let totalDiscount = 0;
    
    orders.forEach(order => {
        totalRevenue += order.totalAmount;
        if (order.couponDiscount) {
            totalDiscount += order.couponDiscount;
        }
    });
    
    const salesByDay = {};
    const ordersByDay = {};
    
    orders.forEach(order => {
        const day = moment(order.createdAt).format('YYYY-MM-DD');
        
        if (!salesByDay[day]) {
            salesByDay[day] = 0;
            ordersByDay[day] = 0;
        }
        
        salesByDay[day] += order.totalAmount;
        ordersByDay[day] += 1;
    });
    
    const chartLabels = Object.keys(salesByDay).sort();
    const salesData = chartLabels.map(day => salesByDay[day]);
    const ordersData = chartLabels.map(day => ordersByDay[day]);
    
    const regionSales = {
        'North America': Math.round(totalRevenue * 0.40),
        'Europe': Math.round(totalRevenue * 0.25),
        'Asia': Math.round(totalRevenue * 0.20),
        'Other': Math.round(totalRevenue * 0.15)
    };
    
    const couponUsage = {};
    orders.forEach(order => {
        if (order.couponCode) {
            if (!couponUsage[order.couponCode]) {
                couponUsage[order.couponCode] = {
                    code: order.couponCode,
                    name: order.couponName || order.couponCode,
                    totalDiscount: 0,
                    count: 0
                };
            }
            couponUsage[order.couponCode].totalDiscount += order.couponDiscount;
            couponUsage[order.couponCode].count += 1;
        }
    });
    
    const topCoupons = Object.values(couponUsage)
        .sort((a, b) => b.totalDiscount - a.totalDiscount)
        .slice(0, 3);
    
    const recentActivities = orders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 4)
        .map(order => {
            const productNames = order.orderItems.map(item => 
                `${item.product?.name || 'Product'}`
            ).join(', ');
            
            return {
                date: moment(order.createdAt).format('MMM DD'),
                amount: order.totalAmount,
                description: `sale of ${productNames}`
            };
        });
    
    const currentMonth = moment().startOf('month');
    const monthlyEarning = orders
        .filter(order => moment(order.createdAt).isAfter(currentMonth))
        .reduce((sum, order) => sum + order.totalAmount, 0);
    
    const marketingChannels = {
        'Facebook': 15,
        'Instagram': 65,
        'Google': 25,
        'Twitter': 12,
        'TikTok': 28
    };
    
    return {
        totalRevenue,
        totalOrders,
        totalDiscount,
        monthlyEarning,
        chartData: {
            labels: chartLabels.map(day => moment(day).format('MMM DD')),
            salesData,
            ordersData
        },
        regionSales,
        topCoupons,
        recentActivities,
        marketingChannels,
        grossSales: totalRevenue + totalDiscount,
        netSales: totalRevenue
    };
};

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
                console.log("Admin session set:", req.session.admin);
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

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            const { startDate, endDate } = getDateRange('last7days');
            
            const orders = await Order.find({
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $nin: ['Cancelled', 'Payment Failed'] }
            }).populate('orderItems.product');
            
            const dashboardData = processOrdersData(orders);
            
            res.render("admin-dashboard", { 
                dashboardData,
                moment,
                dateFilter: 'last7days',
                startDate: moment(startDate).format('YYYY-MM-DD'),
                endDate: moment(endDate).format('YYYY-MM-DD')
            });
        } catch (error) {
            console.error("Dashboard load error:", error);
            res.redirect("/admin/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};

const updateDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    try {
        const { dateRange, startDate, endDate } = req.body;
        let dateFilter = {};
        
        if (dateRange === 'custom' && startDate && endDate) {
            dateFilter = {
                startDate: moment(startDate).startOf('day').toDate(),
                endDate: moment(endDate).endOf('day').toDate()
            };
        } else {
            dateFilter = getDateRange(dateRange);
        }
        
        const orders = await Order.find({
            createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
            status: { $nin: ['Cancelled', 'Payment Failed'] }
        }).populate('orderItems.product');
        
        const dashboardData = processOrdersData(orders);
        
        res.json({
            success: true,
            dashboardData,
            dateFilter: dateRange,
            startDate: moment(dateFilter.startDate).format('YYYY-MM-DD'),
            endDate: moment(dateFilter.endDate).format('YYYY-MM-DD')
        });
    } catch (error) {
        console.error("Update dashboard error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const generatePDFReport = (reportData) => {
    return new Promise((resolve, reject) => {
        try {
            const uploadDir = path.join(__dirname, '../../public/reports');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const fileName = `sales_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.pdf`;
            const filePath = path.join(uploadDir, fileName);
            
            const doc = new PDFDocument({ margin: 50 });
            const writeStream = fs.createWriteStream(filePath);
            
            doc.pipe(writeStream);
            
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(12).text(`Report Period: ${reportData.dateRange.startDate} to ${reportData.dateRange.endDate}`, { align: 'center' });
            doc.moveDown(2);
            
            doc.fontSize(16).text('Summary', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(`Total Orders: ${reportData.totalOrders}`);
            doc.fontSize(12).text(`Total Revenue: $${reportData.totalRevenue.toFixed(2)}`);
            
            if (reportData.totalDiscount) {
                doc.fontSize(12).text(`Total Discount: $${reportData.totalDiscount.toFixed(2)}`);
            }
            
            doc.moveDown(2);
            
            doc.fontSize(16).text('Order Details', { underline: true });
            doc.moveDown();
            
            const tableTop = doc.y;
            const tableLeft = 50;
            const colWidths = [80, 100, 100, 80, 80, 85];
            
            doc.fontSize(10).text('Order ID', tableLeft, tableTop);
            
            doc.text('Date', tableLeft + colWidths[0] + colWidths[1], tableTop);
            doc.text('Amount', tableLeft + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
            doc.text('Status', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
            doc.text('Payment', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
            
            doc.moveTo(tableLeft, tableTop + 15)
               .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
               .stroke();
            
            let rowTop = tableTop + 20;
            
            const ordersToShow = reportData.orders.slice(0, 20);
            
            ordersToShow.forEach((order, i) => {
                if (rowTop > 700) {
                    doc.addPage();
                    rowTop = 50;
                }
                
                doc.fontSize(9).text(order.orderId, tableLeft, rowTop, { width: colWidths[0] });
                doc.fontSize(9).text(order.date, tableLeft + colWidths[0] + colWidths[1], rowTop, { width: colWidths[2] });
                doc.fontSize(9).text(`$${order.totalAmount.toFixed(2)}`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2], rowTop, { width: colWidths[3] });
                doc.fontSize(9).text(order.status, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowTop, { width: colWidths[4] });
                doc.fontSize(9).text(order.paymentMethod, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], rowTop, { width: colWidths[5] });
                
                rowTop += 20;
            });
            
            if (reportData.orders.length > 20) {
                rowTop += 10;
                doc.fontSize(10).text(`Note: Showing 20 of ${reportData.orders.length} orders. Download the CSV for complete data.`, tableLeft, rowTop);
            }
            
            if (reportData.couponsUsed && reportData.couponsUsed.length > 0) {
                doc.addPage();
                
                doc.fontSize(16).text('Coupon Usage', { underline: true });
                doc.moveDown();
                
                const couponTableTop = doc.y;
                const couponColWidths = [100, 150, 80, 80];
                
                doc.fontSize(10).text('Code', tableLeft, couponTableTop);
                doc.text('Name', tableLeft + couponColWidths[0], couponTableTop);
                doc.text('Discount', tableLeft + couponColWidths[0] + couponColWidths[1], couponTableTop);
                doc.text('Usage Count', tableLeft + couponColWidths[0] + couponColWidths[1] + couponColWidths[2], couponTableTop);
                
                doc.moveTo(tableLeft, couponTableTop + 15)
                   .lineTo(tableLeft + couponColWidths.reduce((a, b) => a + b, 0), couponTableTop + 15)
                   .stroke();
                
                let couponRowTop = couponTableTop + 20;
                
                reportData.couponsUsed.forEach(coupon => {
                    doc.fontSize(9).text(coupon.code, tableLeft, couponRowTop, { width: couponColWidths[0] });
                    doc.fontSize(9).text(coupon.name, tableLeft + couponColWidths[0], couponRowTop, { width: couponColWidths[1] });
                    doc.fontSize(9).text(`$${coupon.totalDiscount.toFixed(2)}`, tableLeft + couponColWidths[0] + couponColWidths[1], couponRowTop, { width: couponColWidths[2] });
                    doc.fontSize(9).text(coupon.count, tableLeft + couponColWidths[0] + couponColWidths[1] + couponColWidths[2], couponRowTop, { width: couponColWidths[3] });
                    
                    couponRowTop += 20;
                });
            }
            
            doc.fontSize(10).text(`Report generated on ${moment().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'center' });
            
            doc.end();
            
            writeStream.on('finish', () => {
                resolve({
                    fileName,
                    filePath: `/reports/${fileName}`
                });
            });
            
            writeStream.on('error', reject);
            
        } catch (error) {
            reject(error);
        }
    });
};

const generateExcelReport = (reportData) => {
    return new Promise((resolve, reject) => {
        try {
            const uploadDir = path.join(__dirname, '../../public/reports');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const fileName = `sales_report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
            const filePath = path.join(uploadDir, fileName);
            
            const workbook = new ExcelJS.Workbook();
            
            const summarySheet = workbook.addWorksheet('Summary');
            
            summarySheet.mergeCells('A1:E1');
            summarySheet.getCell('A1').value = 'Sales Report';
            summarySheet.getCell('A1').font = { size: 16, bold: true };
            summarySheet.getCell('A1').alignment = { horizontal: 'center' };
            
            summarySheet.mergeCells('A2:E2');
            summarySheet.getCell('A2').value = `Report Period: ${reportData.dateRange.startDate} to ${reportData.dateRange.endDate}`;
            summarySheet.getCell('A2').alignment = { horizontal: 'center' };
            
            summarySheet.getCell('A4').value = 'Summary';
            summarySheet.getCell('A4').font = { size: 12, bold: true };
            
            summarySheet.getCell('A5').value = 'Total Orders:';
            summarySheet.getCell('B5').value = reportData.totalOrders;
            
            summarySheet.getCell('A6').value = 'Total Revenue:';
            summarySheet.getCell('B6').value = reportData.totalRevenue;
            summarySheet.getCell('B6').numFmt = '$#,##0.00';
            
            if (reportData.totalDiscount) {
                summarySheet.getCell('A7').value = 'Total Discount:';
                summarySheet.getCell('B7').value = reportData.totalDiscount;
                summarySheet.getCell('B7').numFmt = '$#,##0.00';
            }
            
            const ordersSheet = workbook.addWorksheet('Orders');
            
            ordersSheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 15 },
                
                { header: 'Date', key: 'date', width: 20 },
                { header: 'Amount', key: 'amount', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Payment Method', key: 'paymentMethod', width: 15 },
                { header: 'Payment Status', key: 'paymentStatus', width: 15 }
            ];
            
            ordersSheet.getRow(1).font = { bold: true };
            
            reportData.orders.forEach(order => {
                ordersSheet.addRow({
                    orderId: order.orderId,
                    customer: order.customer,
                    date: order.date,
                    amount: order.totalAmount,
                    status: order.status,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus
                });
            });
            
            ordersSheet.getColumn('amount').numFmt = '$#,##0.00';
            
            if (reportData.couponsUsed && reportData.couponsUsed.length > 0) {
                const couponsSheet = workbook.addWorksheet('Coupons');
                
                couponsSheet.columns = [
                    { header: 'Code', key: 'code', width: 15 },
                    { header: 'Name', key: 'name', width: 25 },
                    { header: 'Total Discount', key: 'totalDiscount', width: 15 },
                    { header: 'Usage Count', key: 'count', width: 15 }
                ];
                
                couponsSheet.getRow(1).font = { bold: true };
                
                reportData.couponsUsed.forEach(coupon => {
                    couponsSheet.addRow({
                        code: coupon.code,
                        name: coupon.name,
                        totalDiscount: coupon.totalDiscount,
                        count: coupon.count
                    });
                });
                
                couponsSheet.getColumn('totalDiscount').numFmt = '$#,##0.00';
            }
            
            workbook.xlsx.writeFile(filePath)
                .then(() => {
                    resolve({
                        fileName,
                        filePath: `/reports/${fileName}`
                    });
                })
                .catch(reject);
            
        } catch (error) {
            reject(error);
        }
    });
};



const generateReport = async (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    try {
        const { 
            reportType, 
            startDate, 
            endDate, 
            includeDiscount, 
            includeSalesCount, 
            includeOrderAmount,
            reportFormat 
        } = req.body;
        
        let dateFilter = {};
        
        if (reportType === 'custom' && startDate && endDate) {
            dateFilter = {
                startDate: moment(startDate).startOf('day').toDate(),
                endDate: moment(endDate).endOf('day').toDate()
            };
        } else {
            dateFilter = getDateRange(reportType);
        }
        
        const orders = await Order.find({
            createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate }
        }).populate('orderItems.product userId');
        
        const reportData = {
            reportType,
            dateRange: {
                startDate: moment(dateFilter.startDate).format('YYYY-MM-DD'),
                endDate: moment(dateFilter.endDate).format('YYYY-MM-DD')
            },
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
            orders: orders.map(order => ({
                orderId: order.orderId,
                customer: order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : 'Unknown',
                date: moment(order.createdAt).format('YYYY-MM-DD HH:mm:ss'),
                totalAmount: order.totalAmount,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus
            }))
        };
        
        if (includeDiscount === 'true') {
            reportData.totalDiscount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
            reportData.couponsUsed = {};
            
            orders.forEach(order => {
                if (order.couponCode) {
                    if (!reportData.couponsUsed[order.couponCode]) {
                        reportData.couponsUsed[order.couponCode] = {
                            code: order.couponCode,
                            name: order.couponName || order.couponCode,
                            totalDiscount: 0,
                            count: 0
                        };
                    }
                    reportData.couponsUsed[order.couponCode].totalDiscount += order.couponDiscount;
                    reportData.couponsUsed[order.couponCode].count += 1;
                }
            });
            
            reportData.couponsUsed = Object.values(reportData.couponsUsed);
        }
        
        let reportFile;
        
        switch (reportFormat.toLowerCase()) {
            case 'pdf':
                reportFile = await generatePDFReport(reportData);
                break;
            case 'excel':
                reportFile = await generateExcelReport(reportData);
                break;
            
            default:
                return res.status(400).json({ success: false, message: 'Invalid report format' });
        }
        
        res.json({
            success: true,
            reportData,
            reportFile,
            message: `Report generated successfully in ${reportFormat.toUpperCase()} format`
        });
    } catch (error) {
        console.error("Generate report error:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session ", err);
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
    updateDashboard,
    generateReport,
    pageerror,
    logout,
};

