'use client';

import { useEffect, useState } from 'react';
import { AIInsight } from '../../../types';
import { recommendationsService } from '../../../services/recommendations.service';
import { ApiError } from '../../../lib/api';
import { Lightbulb, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecommendations = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await recommendationsService.list();
      setRecommendations(res.recommendations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecommendations();
  }, []);

  return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          <p className="typo-overline text-slate-400">Overview</p>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-100 mt-1">Recommendations</h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Personalized tips from your spending, budgets, goals, and health score.
          </p>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            <span>{error}</span>
            <button type="button" onClick={() => void loadRecommendations()} className="font-medium underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          {loading ? (
            <p className="text-sm text-slate-400">Loading recommendations…</p>
          ) : recommendations.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Lightbulb className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-100">No recommendations yet</p>
              <p className="text-sm text-slate-400">Add income, expenses, and budgets to unlock personalized tips.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border text-sm ${
                    item.type === 'warning'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : item.type === 'positive'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {item.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : item.type === 'positive' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-slate-100">{item.title}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 capitalize">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
