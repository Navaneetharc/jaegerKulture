const mongoose = require('mongoose');
const {Schema} = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    details: [{
        addressType: {
            type: String,
            enum: ["Home", "Office", "Other"], 
            required: true
        },
        name: {
            type: String,
            required: true
        },
        addressLine1 : {
            type : String,
        },
        addressLine2 : {
            type : String
        },          
        city: {
            type: String,
            required: true
        },
        landmark: {
            type: String,
            required: false
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        altPhone: {
            type: String,
            required: false
        },
        isDefault: {
            type: Boolean,
            default: false
          }
    }]
}, { timestamps: true }); 

const Address = mongoose.model("Address",addressSchema);
module.exports = Address;