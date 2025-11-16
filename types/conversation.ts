// Conversation types for the character conversation system

export interface Conversation {
  id: number;
  studio_id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  character_id: number | null;
  speaker_name: string;
  message_text: string;
  sequence_order: number;
  timestamp_ms: number | null;
  created_at: string;
  scene_prompt_ja: string | null;
  scene_prompt_en: string | null;
  metadata: {
    emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'excited' | 'confused';
    emotionTag?: 'emotional' | 'calm' | 'energetic' | 'professional' | 'friendly' | 'serious';
    scene?: string;
    voice_preset?: string;
    audio_url?: string;
    regenerated?: boolean;
    prompt_version?: string;
  };
}

export interface ConversationScene {
  id: number;
  conversation_id: number;
  scene_number: number;
  scene_description: string;
  image_generation_prompt: string;
  generated_image_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConversationGenerationLog {
  id: number;
  conversation_id: number;
  prompt_template: string;
  prompt_variables: Record<string, any>;
  ai_model: string;
  ai_response: string;
  generated_messages: number[];
  created_at: string;
}

export interface CharacterSheet {
  id: number;
  name: string;
  image_url: string | null;
  description: string | null;
  personality: string | null;
  speaking_style: string | null;
  sample_dialogues: Array<{
    situation: string;
    line: string;
  }>;
  metadata: Record<string, any>;
  created_at: string;
}

// API Request/Response types

export interface GenerateConversationRequest {
  studioId?: number;
  title: string;
  characterIds: number[];
  situation: string;
  messageCount: number;
  tone?: 'casual' | 'formal' | 'dramatic' | 'humorous';
  previousMessages?: Array<{
    speaker: string;
    message: string;
  }>;
}

export interface GenerateConversationResponse {
  success: boolean;
  data?: {
    conversationId: number;
    messages: ConversationMessageWithCharacter[];
  };
  error?: string;
}

export interface GetConversationResponse {
  success: boolean;
  data?: {
    conversation: Conversation & {
      studio?: {
        id: number;
        name: string;
      };
    };
    messages: ConversationMessageWithCharacter[];
  };
  error?: string;
}

export interface ConversationMessageWithCharacter extends ConversationMessage {
  character?: {
    id: number;
    name: string;
    image_url: string | null;
  } | null;
}

export interface RegenerateMessageRequest {
  messageId: number;
  newText?: string;
}

export interface RegenerateMessageResponse {
  success: boolean;
  data?: {
    message: ConversationMessageWithCharacter;
  };
  error?: string;
}

export interface UpdateMessageRequest {
  messageText?: string;
  characterId?: number;
  metadata?: ConversationMessage['metadata'];
}

export interface UpdateMessageResponse {
  success: boolean;
  data?: {
    message: ConversationMessageWithCharacter;
  };
  error?: string;
}

export interface ListConversationsRequest {
  studioId: number;
  limit?: number;
  offset?: number;
}

export interface ListConversationsResponse {
  success: boolean;
  data?: {
    conversations: Array<Conversation & {
      messageCount?: number;
      sceneCount?: number;
    }>;
    total: number;
  };
  error?: string;
}

// AI Prompt types

export interface ConversationPromptInput {
  characters: Array<{
    id: number;
    name: string;
    description: string;
    personality: string;
    speakingStyle: string;
    sampleDialogues: Array<{
      situation: string;
      line: string;
    }>;
  }>;
  situation: string;
  messageCount: number;
  previousMessages?: Array<{
    speaker: string;
    message: string;
  }>;
  tone?: 'casual' | 'formal' | 'dramatic' | 'humorous';
}

export interface GeneratedMessage {
  speaker: string;
  message: string;
  emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'excited' | 'confused';
  emotionTag?: 'emotional' | 'calm' | 'energetic' | 'professional' | 'friendly' | 'serious';
  scene?: string;
  scenePromptJa?: string;
  scenePromptEn?: string;
}

export interface ConversationGenerationAIResponse {
  messages: GeneratedMessage[];
}
