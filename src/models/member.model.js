const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  matricNumber: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
  level: { type: String, enum: ['100', '200', '300', '400', '500', 'Postgraduate'], required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Prefer not to say'] },
  stateOfOrigin: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dues: [{
    session: { type: String, required: true }, // e.g. "2024/2025"
    semester: { type: String, enum: ['First', 'Second', 'Both'] },
    amount: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paidAt: { type: Date },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String }
  }],
  notes: { type: String, maxlength: 500 },
  registrationToken: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberRegistrationLink', default: null },
  registeredAt: { type: Date, default: null }
}, { timestamps: true });

memberSchema.index({ name: 'text', email: 'text', matricNumber: 'text' });
memberSchema.index({ level: 1 });
memberSchema.index({ 'dues.paid': 1 });

module.exports = mongoose.model('Member', memberSchema);
