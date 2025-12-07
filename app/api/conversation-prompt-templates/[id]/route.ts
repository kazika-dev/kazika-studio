import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getConversationPromptTemplateById,
  updateConversationPromptTemplate,
  deleteConversationPromptTemplate
} from '@/lib/db';
import type { UpdatePromptTemplateRequest } from '@/types/conversation';

/**
 * GET /api/conversation-prompt-templates/[id]
 * Get a single conversation prompt template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const template = await getConversationPromptTemplateById(templateId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check ownership (or if it's a global template)
    if (template.user_id && template.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Failed to get conversation prompt template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get conversation prompt template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversation-prompt-templates/[id]
 * Update a conversation prompt template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const existingTemplate = await getConversationPromptTemplateById(templateId);

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const body: UpdatePromptTemplateRequest = await request.json();

    // Check if this is only updating the isDefault flag
    const isOnlyDefaultFlagUpdate =
      body.isDefault !== undefined &&
      body.name === undefined &&
      body.description === undefined &&
      body.templateText === undefined;

    // Check ownership (allow default flag updates for all templates, but other updates only for owned templates)
    if (!isOnlyDefaultFlagUpdate && existingTemplate.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const template = await updateConversationPromptTemplate(templateId, body);

    return NextResponse.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    console.error('Failed to update conversation prompt template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation prompt template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversation-prompt-templates/[id]
 * Delete a conversation prompt template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const existingTemplate = await getConversationPromptTemplateById(templateId);

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingTemplate.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteConversationPromptTemplate(templateId);

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Failed to delete conversation prompt template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation prompt template' },
      { status: 500 }
    );
  }
}
