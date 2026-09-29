import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

type MlExpense = {
  id: string;
  amount: number;
  category: string;
  date: string;
  transactionType: string;
  recurring: boolean;
  description: string;
};

type MlIncome = {
  amount: number;
  date: string;
};

export type MlModelMetrics = {
  name: 'Linear Regression' | 'Random Forest Regressor' | 'XGBoost Regressor';
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
  predictedAmount?: number;
  categoryPredictions?: {
    category: string;
    predictedAmount: number;
    previousAmount: number;
  }[];
};

export type MlTrainResponse = {
  status: string;
  monthsUsed: number;
  holdoutMonth: string;
  models: MlModelMetrics[];
  bestModel: MlModelMetrics['name'];
  saved: string[];
  message?: string;
};

export type MlPredictResponse = {
  status: string;
  predictionPeriod: string;
  previousMonthExpense: number;
  predictedAmount: number;
  changeAmount: number;
  changePercentage: number;
  bestModel: MlModelMetrics['name'];
  modelMetrics: MlModelMetrics;
  models: MlModelMetrics[];
  monthsUsed: number;
  categoryPredictions: {
    category: string;
    predictedAmount: number;
    previousAmount: number;
  }[];
  message?: string;
};

export type MlAnomalyItem = {
  expenseId: string;
  expenseDescription: string;
  amount: number;
  normalAverage: number;
  category: string;
  anomalyScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  date: string;
};

export type MlAnomalyResponse = {
  status: string;
  count: number;
  anomalies: MlAnomalyItem[];
  model: string;
  message?: string;
};

async function mlRequest<T>(path: string, body: unknown): Promise<T> {
  const url = `${config.mlServiceUrl}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError('ML service is not running. Start it on port 8000 and try again.', 503);
  }

  const data = (await response.json().catch(() => ({}))) as T & { message?: string; detail?: unknown };
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : undefined;
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new AppError(data.message || detail || 'ML service request failed.', status);
  }
  return data;
}

export function callTrain(userId: string, expenses: MlExpense[], incomes: MlIncome[]) {
  return mlRequest<MlTrainResponse>('/train', { userId, expenses, incomes });
}

export function callPredict(userId: string, expenses: MlExpense[], incomes: MlIncome[]) {
  return mlRequest<MlPredictResponse>('/predict', { userId, expenses, incomes });
}

export function callAnomalies(userId: string, expenses: MlExpense[]) {
  return mlRequest<MlAnomalyResponse>('/anomalies', { userId, expenses });
}

export type BehaviorResponse = {
  status: string;
  model: string;
  profile: string;
  topCategory: string;
  wantShare: number;
  cluster: number;
  clusterCount: number;
  silhouette: number | null;
  intervention: string;
  months: { month: string; total: number; cluster: number; wantShare: number }[];
};

export function callBehavior(userId: string, expenses: MlExpense[]) {
  return mlRequest<BehaviorResponse>('/behavior', { userId, expenses });
}
