import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { Expense } from '../expense/expense.model.js';
import { callForecastIntervals } from '../ml/ml.client.js';

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

export async function runForecastLab(userId: string) {
  assertDatabase();
  const expenses = await Expense.find({ userId }).select('amount category date transactionType recurring description');
  if (expenses.length === 0) {
    throw new AppError('Add expenses in at least 4 different months before running the interval forecast.', 400);
  }
  return callForecastIntervals(
    userId,
    expenses.map((item) => ({
      id: String(item._id),
      amount: item.amount,
      category: item.category,
      date: item.date.toISOString().slice(0, 10),
      transactionType: item.transactionType,
      recurring: Boolean(item.recurring),
      description: item.description || '',
    }))
  );
}
