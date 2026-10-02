import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Bills',
  'Education',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Travel',
  'Utilities',
  'Other',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Mobile Wallet',
  'Other',
] as const;

export const TRANSACTION_TYPES = ['NEED', 'WANT'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface IExpense extends Document {
  userId: Types.ObjectId;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  date: Date;
  paymentMethod: PaymentMethod;
  description: string;
  transactionType: TransactionType;
  recurring: boolean;
  importMetadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
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
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
    },
    subcategory: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    date: {
      type: Date,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    transactionType: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
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

expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1, date: -1 });

export const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', expenseSchema);
