/**
 * 単一ノードを実行するための関数
 * executeWorkflow から抽出して、ノード単位実行に対応
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiUrl } from '@/lib/utils/apiUrl';

interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  requestBody?: any;
}

/**
 * 単一のノードを実行する
 */
export async function executeNode(
  node: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const nodeType = node.data.type;
  const config = node.data.config || {};

  console.log(`Executing node: ${node.id} (type: ${nodeType})`);
  console.log('Node config:', JSON.stringify(config, null, 2));
  console.log('Node inputs:', JSON.stringify(inputs, null, 2));

  try {
    switch (nodeType) {
      case 'textInput':
        return executeTextInputNode(node, config);

      case 'imageInput':
        return executeImageInputNode(node, config);

      case 'gemini':
        return await executeGeminiNode(node, config, inputs);

      case 'nanobana':
        return await executeNanobanaNode(node, config, inputs);

      case 'elevenlabs':
        return await executeElevenLabsNode(node, config, inputs);

      case 'higgsfield':
        return await executeHiggsfieldNode(node, config, inputs);

      case 'seedream4':
        return await executeSeedream4Node(node, config, inputs);

      default:
        return {
          success: false,
          error: `Unknown node type: ${nodeType}`,
        };
    }
  } catch (error: any) {
    console.error(`Error executing node ${node.id}:`, error);
    return {
      success: false,
      error: error.message || 'Node execution failed',
    };
  }
}

/**
 * TextInput ノードの実行
 */
function executeTextInputNode(node: any, config: any): NodeExecutionResult {
  const text = config.text || config.prompt || '';

  return {
    success: true,
    output: {
      text,
      prompt: text,
    },
    requestBody: { text },
  };
}

/**
 * ImageInput ノードの実行
 */
function executeImageInputNode(node: any, config: any): NodeExecutionResult {
  const imageData = config.imageData;

  // 画像がない場合も成功として扱う（空の出力）
  if (!imageData) {
    return {
      success: true,
      output: {
        imageData: null,
        storagePath: null,
      },
      requestBody: { imageData: null },
    };
  }

  return {
    success: true,
    output: {
      imageData,
      storagePath: config.storagePath,
    },
    requestBody: { imageData: '(image data)' },
  };
}

/**
 * Gemini ノードの実行
 */
async function executeGeminiNode(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const prompt = inputs.prompt || config.prompt || '';
  const requestedModel = config.model || 'gemini-2.5-flash';

  // 古いモデル名を新しいモデル名に自動変換
  const MODEL_MAPPING: Record<string, string> = {
    'gemini-1.5-flash': 'gemini-2.5-flash',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-pro': 'gemini-2.5-pro',
    'gemini-flash': 'gemini-2.5-flash',
  };

  const model = MODEL_MAPPING[requestedModel] || requestedModel;

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured in environment variables',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const generativeModel = genAI.getGenerativeModel({ model });

    const images = inputs.previousImages?.map((img: any) => img.imageData || img.imageUrl) || [];

    // 画像がある場合はマルチモーダルリクエストを構築
    let result;
    if (images && images.length > 0) {
      console.log(`Sending multimodal request with ${images.length} image(s)`);

      const parts: any[] = [{ text: prompt }];

      // 画像をinline_data形式で追加
      images.forEach((imgData: string) => {
        // Base64データから mimeType を推測
        const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: imgData
          }
        });
      });

      result = await generativeModel.generateContent({ contents: [{ role: 'user', parts }] });
    } else {
      // テキストのみの場合は従来通り
      result = await generativeModel.generateContent(prompt);
    }

    const response = result.response;
    const text = response.text();

    return {
      success: true,
      output: {
        text,
        response: text,
      },
      requestBody: {
        prompt,
        model,
        images: images.length > 0 ? `${images.length} images` : 'no images',
      },
    };
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return {
      success: false,
      error: error.message || 'Gemini API request failed',
      requestBody: {
        prompt,
        model,
      },
    };
  }
}

/**
 * Nanobana ノードの実行（Gemini SDK 直接呼び出し）
 */
async function executeNanobanaNode(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const prompt = inputs.prompt || config.prompt || '';
  const model = config.model || 'gemini-2.5-flash-image';
  const aspectRatio = config.aspectRatio || '16:9';

  if (!prompt) {
    return {
      success: false,
      error: 'Prompt is required for Nanobana',
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured in environment variables',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const generativeModel = genAI.getGenerativeModel({ model });

    // 画像生成設定
    const generationConfig = {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    };

    // コンテンツのpartsを構築（プロンプト + 参照画像）
    const parts: any[] = [{ text: prompt }];

    // 参照画像がある場合は追加（前のノードから渡された画像）
    const referenceImages = inputs.previousImages || [];
    if (referenceImages.length > 0) {
      console.log(`Adding ${referenceImages.length} reference image(s) to Nanobana request`);
      referenceImages.forEach((imgData: string) => {
        const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: imgData
          }
        });
      });
    }

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: generationConfig as any,
    });

    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: 'No candidates in response',
      };
    }

    // 画像データを探す
    let imageData = null;
    for (const candidate of candidates) {
      // finishReasonをチェック
      if (candidate.finishReason && candidate.finishReason.toString() === 'NO_IMAGE') {
        return {
          success: false,
          error: 'The model could not generate an image for this prompt. Try a different prompt.',
        };
      }

      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
            imageData = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data,
            };
            break;
          }
        }
      }
      if (imageData) break;
    }

    if (!imageData) {
      return {
        success: false,
        error: 'No image data found in response. The prompt may have been blocked by safety filters.',
      };
    }

    // GCP Storageに画像をアップロード
    let storagePath: string | undefined;
    if (process.env.GCP_SERVICE_ACCOUNT_KEY && process.env.GCP_STORAGE_BUCKET) {
      try {
        const { uploadImageToStorage } = await import('@/lib/gcp-storage');
        storagePath = await uploadImageToStorage(
          imageData.data,
          imageData.mimeType
        );
        console.log('Image uploaded to GCP Storage:', storagePath);
      } catch (storageError: any) {
        console.error('Failed to upload to GCP Storage:', storageError);
      }
    }

    return {
      success: true,
      output: {
        imageData: imageData.data,
        storagePath,
      },
      requestBody: {
        prompt,
        model,
        aspectRatio,
        referenceImagesCount: referenceImages.length,
      },
    };
  } catch (error: any) {
    console.error('Nanobana API error:', error);
    return {
      success: false,
      error: error.message || 'Nanobana image generation failed',
    };
  }
}

/**
 * ElevenLabs ノードの実行
 */
async function executeElevenLabsNode(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const text = inputs.text || config.text || '';
  const voiceId = config.voiceId || 'JBFqnCBsd6RMkjVDRZzb';
  const modelId = config.modelId || 'eleven_turbo_v2_5';

  const requestBody = {
    text,
    voiceId,
    modelId,
  };

  // ElevenLabs API を呼び出す
  const response = await fetch(getApiUrl('/api/elevenlabs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || 'ElevenLabs API request failed',
      requestBody,
    };
  }

  return {
    success: true,
    output: {
      audioData: data.audioData,
    },
    requestBody,
  };
}

/**
 * Higgsfield ノードの実行
 */
async function executeHiggsfieldNode(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const prompt = inputs.prompt || config.prompt || '';
  const negativePrompt = config.negativePrompt || '';
  const duration = config.duration || 5;
  const cfgScale = config.cfgScale || 1.0;
  const promptEnhancement = config.promptEnhancement !== false;

  // 前のノードからの画像を取得
  const inputImage = inputs.previousImages?.[0];

  const requestBody = {
    prompt,
    negativePrompt,
    duration,
    cfgScale,
    promptEnhancement,
    imageData: inputImage?.imageData || inputImage?.imageUrl,
  };

  // Higgsfield API を呼び出す
  const response = await fetch(getApiUrl('/api/higgsfield'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || 'Higgsfield API request failed',
      requestBody,
    };
  }

  return {
    success: true,
    output: {
      videoUrl: data.videoUrl,
      jobId: data.jobId,
      duration: data.duration,
    },
    requestBody,
  };
}

/**
 * Seedream4 ノードの実行
 */
async function executeSeedream4Node(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const prompt = inputs.prompt || config.prompt || '';
  const aspectRatio = config.aspectRatio || '4:3';
  const quality = config.quality || 'Basic';

  const requestBody = {
    prompt,
    aspectRatio,
    quality,
    characterSheetIds: config.selectedCharacterSheetIds || [],
    referenceImagePaths: config.referenceImagePaths || [],
  };

  // Seedream4 API を呼び出す
  const response = await fetch(getApiUrl('/api/seedream4'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || 'Seedream4 API request failed',
      requestBody,
    };
  }

  return {
    success: true,
    output: {
      videoUrl: data.videoUrl,
      jobId: data.jobId,
    },
    requestBody,
  };
}
