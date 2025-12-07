import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getConversationPromptTemplates,
  createConversationPromptTemplate
} from '@/lib/db';
import type { CreatePromptTemplateRequest } from '@/types/conversation';

/**
 * GET /api/conversation-prompt-templates
 * Get all conversation prompt templates for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const templates = await getConversationPromptTemplates(user.id);

    return NextResponse.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Failed to get conversation prompt templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get conversation prompt templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversation-prompt-templates
 * Create a new conversation prompt template
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreatePromptTemplateRequest = await request.json();

    if (!body.name || !body.templateText) {
      return NextResponse.json(
        { success: false, error: 'Name and templateText are required' },
        { status: 400 }
      );
    }

    const template = await createConversationPromptTemplate(
      user.id,
      body.name,
      body.templateText,
      body.description,
      body.isDefault
    );

    return NextResponse.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Failed to create conversation prompt template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation prompt template' },
      { status: 500 }
    );
  }
}
