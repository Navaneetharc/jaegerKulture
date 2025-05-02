const mongoose = require('mongoose');
const {Schema} = mongoose;

const refundSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
         ref: 'Product',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Requested', 'Approved', 'Rejected'],
        default: 'Requested'
    },
    variantSize: {  
        type: String
    },
},{timestamps : true});

const Refund = mongoose.model("Refund", refundSchema);

module.exports = Refund;
