const mongoose = require('mongoose');
const {Schema} = mongoose;

const productSchema = new Schema({
    productName : {
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true,
    },
    anime:{
        type:String,
        required:true,
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0,
    },
    quantity:{
        type:Number,
        default:true,
    },
    stock:{
        type:Number,
        default:true
    },
    productImage:{
        type:{String},
        require:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","Out of stock","Discountinued"],
        require:true,
        default:"Available"
    }
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);
module.exports = Product;