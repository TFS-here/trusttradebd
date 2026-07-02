const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required.'],
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer reference is required.'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required.'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Buyer_Won', 'Seller_Won', 'Closed'],
      default: 'Pending',
    },
    reason: {
      type: String,
      required: [true, 'Dispute reason is required.'],
    },
    // Cloudinary URLs for evidence
    unboxingVideoUrl: {
      type: String,
      default: '',
    },
    adminReportPdfUrl: {
      type: String,
      default: '',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Admin who resolved it
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookups
disputeSchema.index({ order: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ buyer: 1 });
disputeSchema.index({ seller: 1 });

const Dispute = mongoose.model('Dispute', disputeSchema);
module.exports = Dispute;
