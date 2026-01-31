// Conversation types for the character conversation system

// Story types
export interface Story {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface StoryScene {
  id: number;
  story_id: number;
  title: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface Conversation {
  id: number;
  studio_id: number | null;
  story_scene_id: number | null;
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
  // Audio fields
  audio_storage_path: string | null;
  audio_voice_id: string | null;
  audio_model_id: string | null;
  audio_duration_seconds: number | null;
  audio_file_size_bytes: number | null;
  audio_created_at: string | null;
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
  is_favorite: boolean;
}

// API Request/Response types

export interface GenerateConversationRequest {
  studioId?: number;
  storySceneId?: number;
  title: string;
  characterIds: number[];
  situation: string;
  messageCount: number;
  tone?: 'casual' | 'formal' | 'dramatic' | 'humorous';
  promptTemplateId?: number;
  previousMessages?: Array<{
    speaker: string;
    message: string;
  }>;
  /** AI model to use for generation (e.g., 'gemini-2.5-flash-preview-05-20', 'claude-sonnet-4@20250514') */
  model?: string;
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
  scenePromptJa?: string;
  scenePromptEn?: string;
  metadata?: ConversationMessage['metadata'];
}

export interface UpdateMessageResponse {
  success: boolean;
  data?: {
    message: ConversationMessageWithCharacter;
  };
  error?: string;
}

export interface CreateMessageRequest {
  conversationId: number;
  characterId: number;
  messageText: string;
  insertAfterMessageId?: number; // Optional: insert after this message ID
  emotionTag?: string;
}

export interface CreateMessageResponse {
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

// Create conversation types
export interface CreateConversationRequest {
  title: string;
  description?: string;
  storySceneId: number;
}

export interface CreateConversationResponse {
  success: boolean;
  data?: {
    conversation: Conversation;
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
  speakerId?: number;
  speaker?: string;
  message: string;
  emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'excited' | 'confused';
  emotionTag?: 'emotional' | 'calm' | 'energetic' | 'professional' | 'friendly' | 'serious';
  scene?: string;
  scenePromptJa?: string;
  scenePromptEn?: string;
  sceneCharacterIds?: number[];  // このメッセージのシーンに登場するキャラクターID（AIが返す）
}

export interface ConversationGenerationAIResponse {
  characterIds?: number[];  // シーンに登場するキャラクターID（AIが返す）
  messages: GeneratedMessage[];
}

// Conversation Message Characters types
export interface ConversationMessageCharacter {
  id: number;
  conversation_message_id: number;
  character_sheet_id: number;
  display_order: number;
  created_at: string;
  metadata: Record<string, any>;
}

export interface ConversationMessageCharacterWithDetails extends ConversationMessageCharacter {
  character_sheets: {
    id: number;
    name: string;
    image_url: string | null;
    description: string | null;
    personality: string | null;
    speaking_style: string | null;
  };
}

// Story API types
export interface CreateStoryRequest {
  title: string;
  description?: string;
  thumbnail_url?: string;
}

export interface CreateStoryResponse {
  success: boolean;
  data?: {
    story: Story;
  };
  error?: string;
}

export interface ListStoriesResponse {
  success: boolean;
  data?: {
    stories: Array<Story & {
      sceneCount?: number;
      conversationCount?: number;
    }>;
  };
  error?: string;
}

export interface CreateStorySceneRequest {
  title: string;
  description?: string;
  sequence_order?: number;
}

export interface CreateStorySceneResponse {
  success: boolean;
  data?: {
    scene: StoryScene;
  };
  error?: string;
}

export interface ListStoryScenesResponse {
  success: boolean;
  data?: {
    scenes: Array<StoryScene & {
      conversationCount?: number;
    }>;
  };
  error?: string;
}

export interface StoryTreeNode {
  story: Story;
  scenes: Array<{
    scene: StoryScene;
    conversations: Conversation[];
  }>;
}

// Conversation Prompt Template types
export interface ConversationPromptTemplate {
  id: number;
  name: string;
  description: string | null;
  template_text: string;
  is_default: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface CreatePromptTemplateRequest {
  name: string;
  description?: string;
  templateText: string;
  isDefault?: boolean;
}

export interface UpdatePromptTemplateRequest {
  name?: string;
  description?: string;
  templateText?: string;
  isDefault?: boolean;
}

export interface ListPromptTemplatesResponse {
  success: boolean;
  data?: {
    templates: ConversationPromptTemplate[];
  };
  error?: string;
}

export interface GetPromptTemplateResponse {
  success: boolean;
  data?: {
    template: ConversationPromptTemplate;
  };
  error?: string;
}

