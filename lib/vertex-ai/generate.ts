/**
 * Unified AI generation service for conversation generation
 * Supports Vertex AI (Gemini, Claude) and Google Generative AI fallback
 */

import { generateText } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getVertexClient, isVertexAIConfigured } from './client';
import { getModelProvider, type ConversationModel, type ModelProvider } from './constants';

export interface GenerateOptions {
  model: ConversationModel | string;
  prompt: string;
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: ModelProvider;
}

/**
 * Generate conversation content using the specified model
 * Automatically routes to the correct provider based on model selection
 */
export async function generateConversationContent(options: GenerateOptions): Promise<GenerateResult> {
  const { model, prompt, maxTokens = 8192 } = options;
  const provider = getModelProvider(model);

  console.log(`[Generate] Using model: ${model}, provider: ${provider}`);

  switch (provider) {
    case 'vertex-gemini': {
      if (!isVertexAIConfigured()) {
        console.warn('[Generate] Vertex AI not configured, falling back to google-genai');
        return generateWithGoogleGenAI({ model: 'gemini-2.0-flash-exp', prompt, maxTokens });
      }

      const vertex = getVertexClient();
      const result = await generateText({
        model: vertex(model),
        prompt,
        maxOutputTokens: maxTokens,
      });

      return {
        text: result.text,
        model,
        provider: 'vertex-gemini',
      };
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn('[Generate] ANTHROPIC_API_KEY not configured, falling back to google-genai');
        return generateWithGoogleGenAI({ model: 'gemini-2.0-flash-exp', prompt, maxTokens });
      }

      const { createAnthropic } = await import('@ai-sdk/anthropic');
      const anthropic = createAnthropic({ apiKey });

      const result = await generateText({
        model: anthropic(model),
        prompt,
        maxOutputTokens: maxTokens,
      });

      return {
        text: result.text,
        model,
        provider: 'anthropic',
      };
    }

    case 'google-genai':
    default: {
      return generateWithGoogleGenAI({ model, prompt, maxTokens });
    }
  }
}

/**
 * Generate using Google Generative AI SDK (fallback/legacy)
 */
async function generateWithGoogleGenAI(options: GenerateOptions): Promise<GenerateResult> {
  const { model, prompt, maxTokens } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  const result = await genModel.generateContent(prompt);
  const text = result.response.text();

  return {
    text,
    model,
    provider: 'google-genai',
  };
}
