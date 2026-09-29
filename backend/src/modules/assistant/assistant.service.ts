import mongoose from 'mongoose';
import { z } from 'zod';
import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { isDatabaseConnected } from '../../config/db.js';
import { AssistantMessage } from './assistant.model.js';
import { runAssistantEngine, EngineContext } from './assistant-engine.js';
import { ChatTurn } from './conversation-context.js';
import { getProfile } from '../profile/profile.service.js';
import { getSummary } from '../summary/summary.service.js';
import { listBudgets, PublicBudget } from '../budget/budget.service.js';
import { listGoals } from '../goal/goal.service.js';
import { getLatestPrediction } from '../prediction/prediction.service.js';
import { getHealthScore } from '../score/score.service.js';
import { buildSecureFinancialContext } from './financial-context.js';
import { buildWhatIfResponse } from './affordability.service.js';
import { buildEducationResponse } from './financial-education.service.js';
import { FallbackAIProvider, getAIProvider, OllamaProvider, StructuredAIResponse } from './ai-provider.js';

export const askAssistantSchema = z.object({
  question: z.string().trim().min(1, 'Enter a question.').max(500, 'Keep the question under 500 characters.'),
  useOllama: z.boolean().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(2000),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;

export type PublicChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: StructuredAIResponse;
  source?: string;
  createdAt: string;
};

const MAX_STORED_MESSAGES = 200;
const ASSISTANT_SOURCE = 'SmartFin AI Copilot';

function assertDatabase() {
  if (!isDatabaseConnected()) {
    throw new AppError('Database is not connected. Try again in a moment.', 503);
  }
}

function budgetLabel(budget: PublicBudget) {
  return budget.category || 'Overall';
}

async function loadEngineContext(userId: string): Promise<EngineContext> {
  const [profile, summary, budgetResult, goalResult, prediction, health] = await Promise.all([
    getProfile(userId).catch(() => ({ name: 'User' })),
    getSummary(userId, { months: 6 }).catch(() => ({
      currentMonth: { key: new Date().toISOString().slice(0, 7), label: 'Current Month' },
    })),
    listBudgets(userId, {}).catch(() => ({ budgets: [] })),
    listGoals(userId).catch(() => ({ goals: [] })),
    getLatestPrediction(userId).catch(() => null),
    getHealthScore(userId).catch(() => null),
  ]);

  return {
    name: profile.name,
    monthKey: summary.currentMonth.key,
    monthLabel: summary.currentMonth.label,
    budgets: budgetResult.budgets.map((budget) => ({
      label: budgetLabel(budget),
      amount: budget.amount,
      spent: budget.spent,
      remaining: budget.remaining,
      utilization: budget.utilization,
    })),
    goals: goalResult.goals.map((goal) => ({
      name: goal.name,
      remaining: goal.remaining,
      requiredMonthly: goal.requiredMonthly,
      status: goal.status,
    })),
    health: health
      ? {
          overallScore: health.overallScore,
          status: health.status,
          recommendations: health.recommendations,
        }
      : null,
    prediction: prediction
      ? {
          period: prediction.predictionPeriod,
          amount: prediction.predictedAmount,
          changePercentage: prediction.changePercentage,
          modelUsed: prediction.modelUsed,
          categories: prediction.categoryPredictions.map((row) => ({
            category: row.category,
            predictedAmount: row.predictedAmount,
          })),
        }
      : null,
  };
}

function toPublicMessage(doc: {
  _id: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
  createdAt: Date;
}): PublicChatMessage {
  return {
    id: String(doc._id),
    role: doc.role,
    text: doc.text,
    source: doc.source || undefined,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function trimOldMessages(userId: string) {
  const count = await AssistantMessage.countDocuments({ userId });
  if (count <= MAX_STORED_MESSAGES) return;

  const overflow = count - MAX_STORED_MESSAGES;
  const oldest = await AssistantMessage.find({ userId }).sort({ createdAt: 1 }).limit(overflow).select('_id');
  const ids = oldest.map((item) => item._id);
  if (ids.length > 0) {
    await AssistantMessage.deleteMany({ _id: { $in: ids } });
  }
}

async function saveExchange(userId: string, question: string, answer: string, source: string) {
  const [userDoc, assistantDoc] = await AssistantMessage.insertMany([
    { userId, role: 'user', text: question },
    { userId, role: 'assistant', text: answer, source },
  ]);
  await trimOldMessages(userId);
  return [toPublicMessage(userDoc), toPublicMessage(assistantDoc)];
}

export async function listChatMessages(userId: string, limit = 100) {
  assertDatabase();
  const items = await AssistantMessage.find({ userId }).sort({ createdAt: 1 }).limit(limit).lean();
  return items.map((item) =>
    toPublicMessage({
      _id: item._id as mongoose.Types.ObjectId,
      role: item.role,
      text: item.text,
      source: item.source,
      createdAt: item.createdAt,
    })
  );
}

export async function clearChatMessages(userId: string) {
  assertDatabase();
  await AssistantMessage.deleteMany({ userId });
}

export async function getAssistantStatus() {
  const ollama = new OllamaProvider();
  const ollamaAvailable = await ollama.isAvailable();
  return {
    ollamaAvailable,
    model: config.ollamaModel,
    aiProvider: process.env.AI_PROVIDER || 'fallback',
  };
}

export async function askAssistant(userId: string, input: AskAssistantInput) {
  assertDatabase();
  const engineCtx = await loadEngineContext(userId);
  const history = input.history || [];

  const engineResult = await runAssistantEngine(userId, input.question, history, engineCtx);
  const verifiedAnswer = engineResult.answer.trim();

  let structuredResponse: StructuredAIResponse;

  if (engineResult.structuredOverride) {
    structuredResponse = engineResult.structuredOverride;
  } else if (engineResult.isWhatIf && verifiedAnswer) {
    structuredResponse = buildWhatIfResponse(input.question, verifiedAnswer);
  } else if (engineResult.isEducation && engineResult.educationTopic) {
    structuredResponse = await buildEducationResponse(input.question, engineResult.educationTopic);
  } else {
    const finContext = await buildSecureFinancialContext(userId);
    const aiProvider = getAIProvider();

    let wrapped: StructuredAIResponse | null = null;

    if (verifiedAnswer && (await aiProvider.isAvailable())) {
      wrapped = await aiProvider.generateResponse(input.question, finContext, history, verifiedAnswer);
    }

    if (!wrapped) {
      const fallback = new FallbackAIProvider();
      wrapped = await fallback.generateResponse(input.question, finContext, history, verifiedAnswer);
    }

    structuredResponse =
      wrapped ||
      (await new FallbackAIProvider().generateResponse(input.question, finContext, history, verifiedAnswer))!;
  }

  const mainAnswerText = structuredResponse.summary;

  const messages = await saveExchange(userId, input.question, mainAnswerText, structuredResponse.source);

  return {
    answer: mainAnswerText,
    structured: structuredResponse,
    source: structuredResponse.source,
    messages,
  };
}
