const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for wallet history entries
const walletEntrySchema = new Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: null
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: 'Cart'
  }],
  wallet: {
    type: Number,
    default: 0
  },
  walletHistory: {
    type: [walletEntrySchema],
    default: []
  },
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  createdOn: {
    type: Date,
    default: Date.now
  },
  referralCode: {
    type: String
  },
  redeemed: {
    type: Boolean,
    default: false
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
});

const User = mongoose.model('User', userSchema);
module.exports = User;


// const mongoose = require('mongoose');
// const {Schema} = mongoose;

// const userSchema = new Schema({
//     name:{
//         type:String,
//         required:true
//     },
//     email:{
//         type:String,
//         required:true,
//         unique:true,
//     },
//     gender:{
//         type:String,
//         enum:['male', 'female'],
//         default:null
//     },
//     phone:{
//         type:String,
//         required:false,
//         unique:true,
//         sparse:true,
//         default:null
//     },
//     profileImage: {
//         type: String,
//         default: null
//     },
//     googleId:{
//         type:String,
//         unique:true,
//         sparse:true
//     },
//     password:{
//         type:String,
//         required:false
//     },
//     isBlocked:{
//         type:Boolean,
//         default:false
//     },
//     isActive:{
//        type:Boolean,
//        default:false
//     },
//     isAdmin:{
//         type:Boolean,
//         default:false
//     },
//     cart:[{
//         type:Schema.Types.ObjectId,
//         ref:"Cart",
//     }],
//     wallet:{
//         type:Number,
//         default:0,
//     },
//     walletHistory: [{
//         type: Schema.Types.ObjectId,
//         ref: 'Wallet'
//       }],
   
//     orderHistory:[{
//         type:Schema.Types.ObjectId,
//         ref:"Order"
//     }],
//     createdOn:{
//         type:Date,
//         default:Date.now,
//     },
//     referalCode:{
//         type:String,
//         // required:true
//     },
//     redeemed:{
//         type:Boolean,
//         // required:true
//     },
//     reedemedUsers:[{
//         type:Schema.Types.ObjectId,
//         ref:"User",
//         // required:true
//     }],
//     searchHistory:[{
//         category:{
//             type: Schema.Types.ObjectId,
//             ref:"Category",
//         },
        
//         searchOn:{
//             type:Date,
//             default:Date.now
//         }
//     }]
// })


// const User = mongoose.model("User",userSchema);
// module.exports = User