
const getStockManagement = async(req,res)=>{
    try {
        res.render('inventory');
    } catch (error) {
        res.redirect('/pageerror');
    }
}

module.exports = {
    getStockManagement,
}