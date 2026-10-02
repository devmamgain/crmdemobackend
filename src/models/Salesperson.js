import mongoose from 'mongoose';

const salespersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatar: { type: String, default: '' }, // initials or image URL
    role: { type: String, default: 'Account Executive' },
    team: { type: String, default: 'Sales' },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Salesperson', salespersonSchema);
