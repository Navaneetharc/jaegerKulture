const mongoose = require('mongoose');
const { Schema } = mongoose;

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
    type: String
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
    type: String,
    unique: true
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

userSchema.pre('save', function(next) {
  if (this.isNew && !this.referralCode) {
    let hint = (this.name || '').trim().slice(0, 3).toUpperCase();
    if (hint.length < 2) hint = 'USR';

    const rand4 = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    this.referralCode = `#JK${hint}${rand4}`;
  }
  next();
});

userSchema.post('save', function(error, doc, next) {
  if (
    error.name === 'MongoServerError' &&
    error.code === 11000 &&
    error.keyPattern?.referralCode
  ) {
    doc.referralCode = undefined;
    return doc.save()
      .then(() => next())
      .catch(err => next(err));
  }
  next(error);
});

userSchema.post('save', function(error, doc, next) {
  if (
    error.name === 'MongoServerError' &&
    error.code === 11000 &&
    error.keyPattern?.phone
  ) {
    return next(new Error('Phone number already exists.'));
  }
  next(error);
});

module.exports = mongoose.model('User', userSchema);
