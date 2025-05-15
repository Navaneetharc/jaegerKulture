const mongoose = require('mongoose');
const {Schema} = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    code : {
        type: String,
        required: true,
        unique: true,
    },
    description : {
        type: String,
    },
    startDate: {
        type: Date,
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    minPrice: {
        type: Number,
        required: true,
        min: 0
    },
    offerPrice: {
        type: Number,
        required: true,
        min: 0
    },
    usageType: {
        type: String,
        enum: ["single-use", "multi-use"],
        default: "single-use",
    },
    usersUsed: {
        type: [Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    used : {
        type : Number,
        default : 0
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
},{timestamps : true});



const Coupon = mongoose.model("Coupon",couponSchema);
module.exports = Coupon;