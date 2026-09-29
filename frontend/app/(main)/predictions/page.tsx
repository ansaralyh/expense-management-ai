'use client';

import { useEffect, useMemo, useState } from 'react';
import { Prediction, PredictionModel } from '../../../types';
import { chartTheme, tooltipStyle } from '../../../lib/theme';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { predictionService } from '../../../services/prediction.service';
import { ApiError } from '../../../lib/api';

const MODEL_ORDER: PredictionModel['name'][] = [
  'XGBoost Regressor',
  'Random Forest Regressor',
  'Linear Regression',
];

export default function PredictionsPage() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedModel, setSelectedModel] = useState<PredictionModel['name']>('XGBoost Regressor');
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState('');

  const loadPrediction = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await predictionService.get();
      setPrediction(res.prediction);
      if (res.prediction) {
        setSelectedModel(res.prediction.modelUsed);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrediction();
  }, []);

  const handleRetrain = async () => {
    setError('');
    setTraining(true);
    try {
      const res = await predictionService.train();
      setPrediction(res.prediction);
      setSelectedModel(res.prediction.modelUsed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to train forecast models.');
    } finally {
      setTraining(false);
    }
  };

  const compared = useMemo(() => {
    const rows = prediction?.comparedModels?.length
      ? prediction.comparedModels
      : prediction
        ? [prediction.modelMetrics]
        : [];
    return MODEL_ORDER.map((name) => rows.find((row) => row.name === name)).filter(Boolean) as PredictionModel[];
  }, [prediction]);

  const activeMetrics = compared.find((row) => row.name === selectedModel) || prediction?.modelMetrics;
  const forecastAmount =
    prediction && selectedModel === prediction.modelUsed
      ? prediction.predictedAmount
      : (prediction?.comparedModels?.find((row) => row.name === selectedModel) as { predictedAmount?: number } | undefined)
          ?.predictedAmount ?? prediction?.predictedAmount;

  return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div className="space-y-1">
            <p className="typo-overline text-slate-400">Machine learning</p>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100">Expense forecasts</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Trains Linear Regression, Random Forest, and XGBoost on your expense history via the Python service on port 8000.
            </p>
          </div>
          <button
            onClick={handleRetrain}
            disabled={training}
            className="px-5 py-2.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} />
            {training ? 'Training models…' : 'Train and forecast'}
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={loadPrediction} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading forecast…</p>
        ) : !prediction ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400 space-y-2">
            <BrainCircuit className="w-8 h-8 text-slate-500" />
            <p className="text-slate-100 font-medium">No forecast yet</p>
            <p>Add expenses in at least 3 different months, then train. The Python service must be running on port 8000.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Model comparison (holdout month)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {(compared.length ? compared : [prediction.modelMetrics]).map((info) => {
                  const isSelected = selectedModel === info.name;
                  const isBest = info.name === prediction.modelUsed;
                  return (
                    <button
                      type="button"
                      key={info.name}
                      onClick={() => setSelectedModel(info.name)}
                      className={`text-left p-5 rounded-xl transition-all border ${
                        isSelected ? 'bg-slate-900 border-emerald-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-slate-100">{info.name}</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            isBest
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isBest ? 'BEST' : 'EVALUATED'}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                        <div className="flex justify-between">
                          <span>R²</span>
                          <strong className="text-emerald-400">{info.r2}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>MAE</span>
                          <span>Rs. {info.mae.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>RMSE</span>
                          <span>Rs. {info.rmse.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>MAPE</span>
                          <span>{info.mape}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase">Forecast for</span>
                  <h2 className="text-xl font-semibold text-slate-100">{prediction.predictionPeriod}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Using {prediction.modelUsed} · {prediction.monthsUsed || '—'} months of history · previous month Rs.{' '}
                    {prediction.previousMonthExpense.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    {selectedModel === prediction.modelUsed ? 'Selected model total' : `${selectedModel} total`}
                  </span>
                  <h3 className="text-3xl font-display font-semibold text-emerald-400">
                    Rs. {(forecastAmount || 0).toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {prediction.changePercentage >= 0 ? '+' : ''}
                    {prediction.changePercentage}% vs last month
                  </p>
                </div>
              </div>

              <div className="h-80 w-full pt-2">
                {prediction.categoryPredictions.length === 0 ? (
                  <p className="text-sm text-slate-400">No category breakdown returned.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prediction.categoryPredictions} barCategoryGap="28%" barGap={6}>
                      <XAxis dataKey="category" stroke={chartTheme.axis} fontSize={chartTheme.tickFontSize} tickLine={false} />
                      <YAxis
                        stroke={chartTheme.axis}
                        fontSize={chartTheme.tickFontSize}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `Rs.${v / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: number) => [`Rs. ${Number(val).toLocaleString()}`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: `${chartTheme.legendFontSize}px` }} />
                      <Bar dataKey="previousAmount" fill={chartTheme.mutedBar} name="Last month actual" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="predictedAmount" fill={chartTheme.copper} name="Next month forecast" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {activeMetrics && (
              <p className="text-xs text-slate-500">
                Holdout evaluation for {activeMetrics.name}: MAE Rs. {activeMetrics.mae.toLocaleString()}, RMSE Rs.{' '}
                {activeMetrics.rmse.toLocaleString()}, MAPE {activeMetrics.mape}%, R² {activeMetrics.r2}. Saved {prediction.generatedDate}.
              </p>
            )}
          </>
        )}
      </div>
  );
}
