'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Trash2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { getInitials, useAuth } from '../../../context/AuthContext';
import {
  assistantService,
  AssistantChatMessage,
  AssistantHistoryTurn,
} from '../../../services/assistant.service';
import { summaryService } from '../../../services/summary.service';
import { ApiError } from '../../../lib/api';
import Link from 'next/link';

interface StructuredAIResponse {
  title?: string;
  summary: string;
  evidence?: string[];
  recommendation?: string;
  action?: { label: string; href: string };
  source?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  structured?: StructuredAIResponse;
  timestamp: string;
  source?: string;
}

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStamp(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function welcomeMessage(firstName: string): Message {
  return {
    id: 'welcome',
    sender: 'assistant',
    text: `Hello ${firstName}! How can I assist with your finances today?`,
    structured: {
      title: 'AI Financial Copilot',
      summary: `Hello ${firstName}! I can answer from your live SmartFin ledger or explain personal finance topics — budgeting, savings, debt, investing, and how to use the app.`,
      evidence: [
        'Your data: "Give me a monthly financial summary" or "Where am I spending the most?"',
        'General finance: "What is the 50/30/20 rule?" or "How much should I save for an emergency fund?"',
        'Personal figures always come from your records — never guessed.',
      ],
      recommendation: 'Say hi, pick a quick prompt, or ask anything about your money.',
    },
    timestamp: nowStamp(),
    source: 'SmartFin AI Copilot',
  };
}

function toUiMessage(item: AssistantChatMessage): Message {
  return {
    id: item.id,
    sender: item.role,
    text: item.text,
    structured: item.structured,
    timestamp: formatStamp(item.createdAt),
    source: item.source,
  };
}

export default function AIAssistantPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [useOllama, setUseOllama] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [liveContext, setLiveContext] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoadingHistory(true);
      try {
        const [statusResult, historyResult, summaryData] = await Promise.all([
          assistantService.status().catch(() => ({ ollamaAvailable: false })),
          assistantService.messages().catch(() => ({ messages: [] })),
          summaryService.get(6).catch(() => null),
        ]);
        if (cancelled) return;

        setUseOllama(statusResult.ollamaAvailable);
        setLiveContext(summaryData?.currentMonth || null);
        setMessages(
          historyResult.messages.length > 0
            ? historyResult.messages.map(toUiMessage)
            : [welcomeMessage(firstName)]
        );
      } catch {
        if (cancelled) return;
        setMessages([welcomeMessage(firstName)]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [firstName]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const quickQuestions = [
    'Give me a monthly financial summary',
    'Why did my savings decrease?',
    'Where am I spending the most?',
    'How much did I spend on food this month?',
    'Compare this month with last month',
    'How much can I save every month?',
    'Help me create a budget',
    'How long will it take me to reach my savings goal?',
    'What are my biggest unnecessary expenses?',
    'Find unusual spending',
    'Show my recurring subscriptions',
    'What happens if my income increases by 20%?',
    'Can I afford a laptop for Rs. 150,000?',
    'What happens if I save Rs. 15,000 every month?',
    'What happens if my rent increases?',
    'How much should I save for an emergency fund?',
    'What changed in my finances this month?',
  ];

  const handleClear = async () => {
    if (clearing || sending) return;
    setClearing(true);
    try {
      await assistantService.clear();
      setMessages([welcomeMessage(firstName)]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'assistant',
          text: err instanceof ApiError ? err.message : 'Unable to clear chat right now.',
          timestamp: nowStamp(),
          source: 'Error',
        },
      ]);
    } finally {
      setClearing(false);
    }
  };

  const handleSend = async (questionText?: string) => {
    const question = (questionText || input).trim();
    if (!question || sending || loadingHistory) return;

    const history: AssistantHistoryTurn[] = messages
      .filter((item) => item.id !== 'welcome' && item.source !== 'Error')
      .slice(-10)
      .map((item) => ({
        role: item.sender,
        text: item.text,
      }));

    const tempUserId = `temp_u_${Date.now()}`;
    const userMsg: Message = {
      id: tempUserId,
      sender: 'user',
      text: question,
      timestamp: nowStamp(),
    };

    setMessages((prev) => [...prev.filter((item) => item.id !== 'welcome'), userMsg]);
    if (!questionText) setInput('');
    setSending(true);

    try {
      const result = await assistantService.ask(question, useOllama, history);
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== tempUserId),
        ...result.messages.map(toUiMessage),
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'assistant',
          text: err instanceof ApiError ? err.message : 'Unable to answer right now. Check that the backend is running.',
          timestamp: nowStamp(),
          source: 'Error',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-semibold text-slate-100">AI Financial Copilot</h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> Grounded in Live Data
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live ledger insights · General finance guidance · Natural conversation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={clearing || sending || loadingHistory}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-md border border-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Chat
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Chat Column */}
          <div className="lg:col-span-3 space-y-4 flex flex-col h-[calc(100vh-16rem)] min-h-[520px]">
            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 custom-scrollbar">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending || loadingHistory}
                  onClick={() => void handleSend(q)}
                  className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-ink-900 text-slate-200 hover:text-white text-xs font-medium border border-slate-800 whitespace-nowrap transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{q}</span>
                </button>
              ))}
            </div>

            {/* Messages Scroll View */}
            <div
              ref={chatRef}
              className="flex-1 p-6 rounded-xl bg-slate-950 border border-slate-800 overflow-y-auto space-y-4 custom-scrollbar"
            >
              {loadingHistory ? (
                <div className="space-y-4">
                  <div className="h-16 bg-slate-900 animate-pulse rounded-xl w-3/4 border border-slate-800" />
                  <div className="h-16 bg-slate-800 animate-pulse rounded-xl w-2/3 ml-auto" />
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.sender === 'user';
                  const struct = message.structured;

                  return (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-1">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-2xl p-5 rounded-xl text-xs space-y-3 ${
                          isUser
                            ? 'bg-ink-900 text-white font-medium rounded-tr-xs'
                            : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-xs'
                        }`}
                      >
                        {struct && !isUser ? (
                          <div className="space-y-3 text-xs">
                            {struct.title && (
                              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <h4 className="font-semibold text-slate-100 text-sm">{struct.title}</h4>
                              </div>
                            )}

                            <p className="leading-relaxed text-slate-300 font-medium text-xs">
                              {struct.summary || message.text}
                            </p>

                            {struct.evidence && struct.evidence.length > 0 && (
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Evidence &amp; Observations
                                </p>
                                <ul className="space-y-1 text-xs text-slate-300">
                                  {struct.evidence.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-emerald-400 font-bold">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {struct.recommendation && (
                              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-100 space-y-1">
                                <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5" /> Recommendation
                                </p>
                                <p className="text-xs leading-relaxed">{struct.recommendation}</p>
                              </div>
                            )}

                            {struct.action && (
                              <Link
                                href={struct.action.href}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline pt-1"
                              >
                                {struct.action.label} <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
                        )}

                        <div
                          className={`flex items-center justify-between text-[11px] pt-1.5 border-t ${
                            isUser ? 'border-white/10 text-slate-300' : 'border-slate-800 text-slate-500'
                          }`}
                        >
                          <span>{message.timestamp}</span>
                          {message.source && !isUser && (
                            <span className="font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              {message.source}
                            </span>
                          )}
                        </div>
                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                          {getInitials(user?.name)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex items-center gap-2.5 text-slate-400 text-xs p-3.5 bg-slate-900 rounded-xl border border-slate-800 w-fit animate-pulse">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-slate-200">Thinking…</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-3 shrink-0"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances, SmartFin features, or say hello..."
                disabled={loadingHistory}
                className="flex-1 px-4 py-3.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 font-medium"
              />
              <button
                type="submit"
                disabled={sending || loadingHistory || !input.trim()}
                className="px-5 py-3.5 rounded-md bg-ink-900 hover:bg-ink-800 text-white font-medium text-xs transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Context Right Sidebar */}
          <div className="space-y-4">
            {/* Live Ledger Card */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Live Ledger
                </h3>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/20">
                  {liveContext?.label || 'Active'}
                </span>
              </div>

              {liveContext ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Income</span>
                    <span className="font-semibold text-slate-100">Rs. {liveContext.income?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Expenses</span>
                    <span className="font-semibold text-slate-100">Rs. {liveContext.expense?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-emerald-500/10 text-emerald-100 border border-emerald-500/20">
                    <span className="font-medium">Net Savings</span>
                    <span className="font-semibold">Rs. {liveContext.savings?.toLocaleString()} ({liveContext.savingsRate}%)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Loading ledger data…</p>
              )}
            </div>

            {/* Quick Intelligence Links */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">Financial Tools</h4>
              <div className="space-y-1.5 text-xs font-medium">
                <Link
                  href="/anomalies"
                  className="flex items-center justify-between p-3 rounded-lg text-slate-300 hover:bg-slate-950 transition-colors group border border-transparent hover:border-slate-800"
                >
                  <span>Unusual Spending</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-100" />
                </Link>
                <Link
                  href="/recurring"
                  className="flex items-center justify-between p-3 rounded-lg text-slate-300 hover:bg-slate-950 transition-colors group border border-transparent hover:border-slate-800"
                >
                  <span>Subscriptions &amp; Bills</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-100" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
