import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getMessageCharacters,
  addCharacterToMessage,
  removeCharacterFromMessage,
  updateMessageCharacterOrder
} from '@/lib/db';

/**
 * GET /api/conversations/messages/[id]/characters
 * メッセージに紐づくキャラクター一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Ownership check: verify user owns the conversation via studio or story
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversations:conversation_id (
          id,
          studio_id,
          story_scene_id,
          studios:studio_id (user_id),
          story_scenes:story_scene_id (
            story_id,
            stories:story_id (user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership
    const conversation = message.conversations as any;
    const isOwner =
      (conversation.studios?.user_id === user.id) ||
      (conversation.story_scenes?.stories?.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get message characters
    const characters = await getMessageCharacters(messageId);

    return NextResponse.json({
      success: true,
      data: { characters }
    });
  } catch (error) {
    console.error('[GET /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/messages/[id]/characters
 * メッセージにキャラクターを追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { characterId, displayOrder } = body;

    if (!characterId || typeof characterId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'characterId is required and must be a number' },
        { status: 400 }
      );
    }

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Ownership check (same as GET)
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversations:conversation_id (
          id,
          studio_id,
          story_scene_id,
          studios:studio_id (user_id),
          story_scenes:story_scene_id (
            story_id,
            stories:story_id (user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const conversation = message.conversations as any;
    const isOwner =
      (conversation.studios?.user_id === user.id) ||
      (conversation.story_scenes?.stories?.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Add character to message
    await addCharacterToMessage(messageId, characterId, { displayOrder });

    return NextResponse.json({
      success: true,
      data: { message: 'Character added to message' }
    });
  } catch (error) {
    console.error('[POST /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/messages/[id]/characters?characterId=X
 * メッセージからキャラクターを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterIdParam = searchParams.get('characterId');
    const characterId = characterIdParam ? parseInt(characterIdParam, 10) : NaN;

    if (isNaN(characterId)) {
      return NextResponse.json(
        { success: false, error: 'characterId query parameter is required' },
        { status: 400 }
      );
    }

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Ownership check (same as GET)
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversations:conversation_id (
          id,
          studio_id,
          story_scene_id,
          studios:studio_id (user_id),
          story_scenes:story_scene_id (
            story_id,
            stories:story_id (user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const conversation = message.conversations as any;
    const isOwner =
      (conversation.studios?.user_id === user.id) ||
      (conversation.story_scenes?.stories?.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Remove character from message
    await removeCharacterFromMessage(messageId, characterId);

    return NextResponse.json({
      success: true,
      data: { message: 'Character removed from message' }
    });
  } catch (error) {
    console.error('[DELETE /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/messages/[id]/characters
 * メッセージ内のキャラクター表示順序を更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);
    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { characterOrders } = body; // [{ characterId, displayOrder }]

    if (!Array.isArray(characterOrders)) {
      return NextResponse.json(
        { success: false, error: 'characterOrders must be an array' },
        { status: 400 }
      );
    }

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Ownership check (same as GET)
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversations:conversation_id (
          id,
          studio_id,
          story_scene_id,
          studios:studio_id (user_id),
          story_scenes:story_scene_id (
            story_id,
            stories:story_id (user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const conversation = message.conversations as any;
    const isOwner =
      (conversation.studios?.user_id === user.id) ||
      (conversation.story_scenes?.stories?.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update character order
    await updateMessageCharacterOrder(messageId, characterOrders);

    return NextResponse.json({
      success: true,
      data: { message: 'Character order updated' }
    });
  } catch (error) {
    console.error('[PATCH /api/conversations/messages/:id/characters]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
