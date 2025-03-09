const mongoose = require('mongoose');
const {Schema} = mongoose;

const addressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    userName:{
        type:String,
        required:true
    },
    address:[{
        addressType:{
            type:String.Types.ObjectId,
            required:true
        },
        name:{
            type:String,
            required:true,
        },
        city:{
            type:String,
            required:true,
        },
        locality:{
            type:String,
            required:true
        },
        landMark:{
            type:String,
            required:true
        },
        houseNo:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        pincode:{
            type:Number,
            required:true
        },
        phone:{
            type:String,
            required:true
        },
        altPhone:{
            type:String,
            required:true
        },
        addressType:{
            type:String,
            enum:['home','work'],
            required:true
        }
    }]
})

const Address = mongoose.model("Address",addressSchema);
module.exports = Address;