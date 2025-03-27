const mongoose = require('mongoose');
const { Schema } = mongoose;


const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    salePrice: {
        type: Number,
        required: true,
    },
    productOffer: {
        type: Number,
        default: 0,
    },
    quantity: {
        type: Number,
        default: 0, 
    },
    variant: { 
        size: {
            s: { type: Number, required: true, default: 0 },
            m: { type: Number, required: true, default: 0 },
            l: { type: Number, required: true, default: 0 },
            x: { type: Number, required: true, default: 0 },
            xl: { type: Number, required: true, default: 0 }
        }
    },
    productImage: {
        type: [String],
        required: true  
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"], 
        required: true,  
        default: "Available"
    }
}, { timestamps: true });


const Product = mongoose.model("Product", productSchema);
module.exports = Product;
