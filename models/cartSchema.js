const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema({
    name: { 
        type: String,
        required: true 
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product', 
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true 
    },
    basePrice: {
        type: Number,
        required: true 
    },
    variants: {
        size: {
            type: String,
            default: null
        }
    },
    productImage: {
        type: String,
        required: true
    }
});

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [cartItemSchema]
}, { timestamps: true });

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
