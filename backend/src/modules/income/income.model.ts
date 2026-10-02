import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const INCOME_TYPES = ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export interface IIncome extends Document {
  userId: Types.ObjectId;
  amount: number;
  source: string;
  date: Date;
  incomeType: IncomeType;
  description?: string;
  recurring: boolean;
  importMetadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const incomeSchema = new Schema<IIncome>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    source: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    date: {
      type: Date,
      required: true,
    },
    incomeType: {
      type: String,
      enum: INCOME_TYPES,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    recurring: {
      type: Boolean,
      default: false,
    },
    importMetadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

incomeSchema.index({ userId: 1, date: -1 });

export const Income: Model<IIncome> =
  mongoose.models.Income || mongoose.model<IIncome>('Income', incomeSchema);
