const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: uuidv4
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: "Product", 
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    basePrice: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: true,
    },
    variant: {         
        size: { 
            type: String,
            required: true
        }
    },
    discountPrice: {
        type: Number,
        required: true,
    },
    discount: {
        type: Number,
        default: 0,
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Paid', 'Failed']
    },
    status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending'
    },
    paymentId: {
        type: String,
    },
    cancelReason: {
        type: String
    },
    coupon: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'card', 'wallet', 'razor','paypal','netbanking']
    },
    orderItemCount: { 
        type: Number,
        required: true
    },
    delivery: {
        type: Number,
        default: 0
    },
    statusHistory: [{
        status: { 
            type: String,
            required: true,
            enum: ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned']
        },
        timestamp: { 
            type: Date, 
            default: Date.now 
        }
    }],
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
