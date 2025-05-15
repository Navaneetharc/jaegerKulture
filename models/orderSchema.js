const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
    orderId: {
        type: String,
        required: true,
        default: () => Math.floor(Math.random() * 1e9).toString() 
    },

    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product", 
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        basePrice: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        currentStatus: {
            type: String,
            enum: ['Pending', 'Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered', 'Cancelled', 'Returned', 'Payment Failed', 'Return Requested'],
            default: 'Pending'
        },
        variant: {
            size: {
                type: String,
                default: null
            }
        },
        productImage: { 
            type: String,
            required: true
        },
        cancelReason: {
            type: String
        },
        statusHistory: [{
            status: {
                type: String,
                required: true,
                enum: ['Pending', 'Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered', 'Cancelled', 'Returned', 'Payment Failed', 'Return Requested']
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }]
    }],

address: {
    addressDocId: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    addressDetailId: {
        type: Schema.Types.ObjectId
    }
},

    paymentMethod: {
        type: String,
        enum: ['cod','wallet','razorpay','paypal'],
        required: true
    },

    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Paid', 'Failed']
    },
    paypalOrderId: {
        type: String
    },
    paymentVerified: {
        type: Boolean,
        default: false
    },    
    paymentId: {
        type: String
    },
    walletAmountUsed: {
        type: Number,
        default: 0
    },
    walletTransactionId: {
        type: Schema.Types.ObjectId,
        ref: "Wallet"
    },
    failureReason: {
        type: String
    },
   couponCode: {
    type: String,
    default: null
    },
    couponName: {
    type: String,
    default: null
    },
    couponDiscount: {
    type: Number,
    default: 0
    },

    deliveryCharge: {
        type: Number,
        default: 0
    },
    tax:{
        type: Number,
        default: 0
    },

    totalAmount: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ['Pending', 'Order Placed', 'Order Confirmed', 'Order Shipped', 'Delivered', 'Cancelled', 'Returned', 'Payment Failed', 'Return Requested'],
        default: 'Pending'
    },
    cancelReason: {
        type: String,
    }
    

}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
