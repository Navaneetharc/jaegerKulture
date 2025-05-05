// models/refundSchema.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const refundSchema = new Schema({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  itemId: {                         
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
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
  }
}, { timestamps: true });

module.exports = mongoose.model('Refund', refundSchema);
