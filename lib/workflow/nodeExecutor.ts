/**
 * 単一ノードを実行するための関数
 * executeWorkflow から抽出して、ノード単位実行に対応
 */

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
  const model = config.model || 'gemini-2.0-flash-exp';

  const requestBody = {
    prompt,
    model,
    images: inputs.previousImages?.map((img: any) => img.imageData || img.imageUrl) || [],
  };

  // Gemini API を呼び出す
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || 'Gemini API request failed',
      requestBody,
    };
  }

  return {
    success: true,
    output: {
      text: data.response,
      response: data.response,
    },
    requestBody,
  };
}

/**
 * Nanobana ノードの実行
 */
async function executeNanobanaNode(
  node: any,
  config: any,
  inputs: any
): Promise<NodeExecutionResult> {
  const prompt = inputs.prompt || config.prompt || '';
  const model = config.model || 'gemini-2.5-flash-image';
  const aspectRatio = config.aspectRatio || '16:9';

  const requestBody = {
    prompt,
    model,
    aspectRatio,
    characterSheetIds: config.selectedCharacterSheetIds || [],
    referenceImages: config.referenceImages || [],
  };

  // Nanobana API を呼び出す
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/nanobana`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || 'Nanobana API request failed',
      requestBody,
    };
  }

  return {
    success: true,
    output: {
      imageUrl: data.imageUrl,
      storagePath: data.storagePath,
    },
    requestBody,
  };
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
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/elevenlabs`, {
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
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/higgsfield`, {
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
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seedream4`, {
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
