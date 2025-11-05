import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage, getSignedUrl } from '@/lib/gcp-storage';
import { v4 as uuidv4 } from 'uuid';

// ComfyUI Rapid (Qwen-Image-Edit) API
export async function POST(request: NextRequest) {
  try {
    const { prompt, inputImage } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!inputImage) {
      return NextResponse.json(
        { error: 'Input image is required for Rapid image editing' },
        { status: 400 }
      );
    }

    const comfyuiUrl = process.env.COMFYUI_URL;

    if (!comfyuiUrl) {
      return NextResponse.json(
        { error: 'COMFYUI_URL is not configured in environment variables' },
        { status: 500 }
      );
    }

    console.log('Rapid API request:', {
      prompt: prompt.substring(0, 100),
      inputImagePath: inputImage.storagePath,
      hasImageData: !!inputImage.data,
      comfyuiUrl,
    });

    // 入力画像のデータを取得
    let inputImageBase64 = inputImage.data;
    let inputImageMimeType = inputImage.mimeType;

    // storagePathから画像を取得する必要がある場合
    if (!inputImageBase64 && inputImage.storagePath) {
      const { getFileFromStorage } = await import('@/lib/gcp-storage');
      const { data, contentType } = await getFileFromStorage(inputImage.storagePath);
      inputImageBase64 = Buffer.from(data).toString('base64');
      inputImageMimeType = contentType;
    }

    // 画像データが取得できない場合はエラー
    if (!inputImageBase64 || !inputImageMimeType) {
      return NextResponse.json(
        { error: 'Failed to get input image data. Please provide either inputImage.data or inputImage.storagePath' },
        { status: 400 }
      );
    }

    // ComfyUI ワークフローを構築
    // TODO: rapid.mdの完全なワークフローを実装する
    //
    // rapid.mdには以下のような完全なワークフロー定義が含まれています：
    // - RandomNoise, KSamplerSelect, CFGGuider などの基本ノード
    // - VAEEncodeTiled, VAEDecodeTiled などのVAEノード
    // - TextEncodeQwenImageEditPlus などのQwen-Image-Edit専用ノード
    // - GeminiAPIノード（プロンプトを英語に変換）
    // - ImageScaleByAspectRatio などの画像処理ノード
    //
    // 完全な実装には、rapid.mdのJSONをパースし、
    // 以下の変数を動的に設定する必要があります：
    // - input_image: 入力画像のパス
    // - prompt: 編集指示（日本語 → Gemini経由で英語化）
    // - seed: ランダムシード
    // - steps: サンプリングステップ数
    // - cfg: CFGスケール
    //
    // 現在は簡略版として、基本的なパラメータのみを送信
    const clientId = uuidv4();

    // workflow.jsonからワークフローを読み込む
    let workflowJson: any;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowPath = path.join(process.cwd(), 'API仕様', 'workflow.json');
      const workflowContent = await fs.readFile(workflowPath, 'utf-8');
      workflowJson = JSON.parse(workflowContent);

      console.log('Loaded workflow from workflow.json');

      // ワークフローの "prompt" 部分を取得
      if (workflowJson.prompt) {
        workflowJson = workflowJson.prompt;
      }

      // 動的パラメータを設定
      // node 97: LoadImage - 入力画像を設定
      // node 93: CLIPTextEncode - プロンプトを設定

      // 入力画像をComfyUIにアップロードする必要がある
      // 今回は、画像をbase64として一時ファイル名で設定
      const imageFileName = `input-${Date.now()}.png`;

      if (workflowJson['97']) {
        workflowJson['97'].inputs.image = imageFileName;
        console.log('Set input image:', imageFileName);
      }

      // プロンプトを設定
      if (workflowJson['93']) {
        workflowJson['93'].inputs.text = prompt;
        console.log('Set prompt:', prompt.substring(0, 100));
      }

      // ランダムシードを設定（オプション）
      const randomSeed = Math.floor(Math.random() * 1000000000000);
      if (workflowJson['86']) {
        workflowJson['86'].inputs.noise_seed = randomSeed;
      }
      if (workflowJson['85']) {
        workflowJson['85'].inputs.noise_seed = 0; // low noiseは固定
      }

      console.log('Workflow parameters set:', {
        imageFileName,
        promptLength: prompt.length,
        randomSeed,
      });

    } catch (error: any) {
      console.error('Failed to load workflow.json:', error);
      return NextResponse.json(
        {
          error: 'Failed to load workflow definition from workflow.json',
          details: error.message,
          hint: 'Please ensure API仕様/workflow.json exists and contains valid JSON',
        },
        { status: 500 }
      );
    }

    // 入力画像をComfyUIにアップロードする
    try {
      const uploadUrl = `${comfyuiUrl.replace(/\/$/, '')}/upload/image`;
      const imageBuffer = Buffer.from(inputImageBase64, 'base64');

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: inputImageMimeType });
      formData.append('image', blob, `input-${Date.now()}.png`);
      formData.append('type', 'input');

      console.log('Uploading image to ComfyUI:', uploadUrl);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const uploadedFileName = uploadResult.name;

      console.log('Image uploaded successfully:', uploadedFileName);

      // アップロードしたファイル名でワークフローを更新
      if (workflowJson['97']) {
        workflowJson['97'].inputs.image = uploadedFileName;
      }

    } catch (uploadError: any) {
      console.error('Failed to upload image to ComfyUI:', uploadError);
      return NextResponse.json(
        {
          error: 'Failed to upload image to ComfyUI',
          details: uploadError.message,
          hint: 'Please check if ComfyUI server is running and accessible',
        },
        { status: 500 }
      );
    }

    // ComfyUI API形式のペイロード
    const payload = {
      prompt: workflowJson,
      client_id: clientId,
    };

    // ComfyUI APIにリクエストを送信
    // エンドポイント: /prompt (Pythonスクリプトの queue_prompt 参照)
    const promptUrl = `${comfyuiUrl.replace(/\/$/, '')}/prompt`;
    console.log('Sending request to ComfyUI:', promptUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2).substring(0, 500));

    let promptResponse;
    try {
      promptResponse = await fetch(promptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError: any) {
      console.error('Failed to connect to ComfyUI:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to connect to ComfyUI server',
          details: fetchError.message,
          comfyuiUrl: promptUrl,
          hint: 'Please check if COMFYUI_URL is correct and the ComfyUI server is running',
        },
        { status: 500 }
      );
    }

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error('ComfyUI API error:', {
        status: promptResponse.status,
        statusText: promptResponse.statusText,
        error: errorText,
      });
      return NextResponse.json(
        {
          error: 'ComfyUI API request failed',
          details: errorText,
          status: promptResponse.status,
          statusText: promptResponse.statusText,
          comfyuiUrl: promptUrl,
        },
        { status: 500 }
      );
    }

    const promptResult = await promptResponse.json();
    const promptId = promptResult.prompt_id;

    if (!promptId) {
      return NextResponse.json(
        { error: 'No prompt_id in ComfyUI response', response: promptResult },
        { status: 500 }
      );
    }

    console.log('ComfyUI prompt queued:', promptId);

    // /history/{prompt_id} をポーリングして完了を待つ
    const historyUrl = `${comfyuiUrl.replace(/\/$/, '')}/history/${promptId}`;
    let completed = false;
    let historyData: any = null;
    const maxWait = 5 * 60 * 1000; // 5分
    const pollInterval = 2000; // 2秒
    const startTime = Date.now();

    while (!completed && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const historyResponse = await fetch(historyUrl);
      if (!historyResponse.ok) {
        console.error('Failed to get history:', historyResponse.status);
        continue;
      }

      const history = await historyResponse.json();
      if (history[promptId]) {
        const status = history[promptId].status || {};
        if (status.completed !== undefined) {
          completed = true;
          historyData = history[promptId];
        }
      }
    }

    if (!completed) {
      return NextResponse.json(
        { error: 'Timeout waiting for ComfyUI to complete', promptId },
        { status: 500 }
      );
    }

    console.log('ComfyUI completed:', promptId);

    // outputsから画像を取得
    const outputs = historyData.outputs || {};
    let outputImageData = null;
    let outputImageMimeType = 'image/png';

    // 最初の画像出力を取得
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.images && nodeOutput.images.length > 0) {
        const imageInfo = nodeOutput.images[0];
        const filename = imageInfo.filename;
        const subfolder = imageInfo.subfolder || '';
        const type = imageInfo.type || 'output';

        // /view?filename=...&subfolder=...&type=... から画像をダウンロード
        const viewUrl = new URL(`${comfyuiUrl.replace(/\/$/, '')}/view`);
        viewUrl.searchParams.set('filename', filename);
        if (subfolder) viewUrl.searchParams.set('subfolder', subfolder);
        viewUrl.searchParams.set('type', type);

        console.log('Downloading image from:', viewUrl.toString());

        const imageResponse = await fetch(viewUrl.toString());
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          outputImageData = Buffer.from(imageBuffer).toString('base64');
          outputImageMimeType = imageResponse.headers.get('content-type') || 'image/png';
          break;
        }
      }
    }

    if (!outputImageData) {
      return NextResponse.json(
        { error: 'No image data in ComfyUI outputs', outputs },
        { status: 500 }
      );
    }

    // 画像をGCP Storageに保存
    const storagePath = await uploadImageToStorage(
      outputImageData,
      outputImageMimeType,
      `rapid-${Date.now()}.png`
    );

    console.log('Rapid image generated and saved:', storagePath);

    return NextResponse.json({
      success: true,
      imageData: {
        mimeType: outputImageMimeType,
        data: outputImageData,
      },
      storagePath,
    });
  } catch (error: any) {
    console.error('Rapid API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate image with Rapid',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
