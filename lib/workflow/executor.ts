import { Node, Edge } from 'reactflow';
import { getApiUrl } from '@/lib/utils/apiUrl';
import { ExecutionResult, WorkflowExecutionResult, topologicalSort } from './types';

// このファイルはサーバー専用です（Node.js組み込みモジュールを使用します）
// クライアントコンポーネントからは API route 経由でのみアクセスしてください

/**
 * ログ出力用に画像データを省略する
 */
function sanitizeForLog(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'imageData' && value) {
      sanitized[key] = '[IMAGE_DATA_OMITTED]';
    } else if (key === 'data' && typeof value === 'string' && value.length > 1000) {
      sanitized[key] = `[LARGE_DATA_OMITTED: ${value.length} bytes]`;
    } else if (typeof value === 'string' && value.length > 1000 && value.startsWith('data:image')) {
      sanitized[key] = '[BASE64_IMAGE_OMITTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * 個別ノードを実行
 */
async function executeNode(
  node: Node,
  previousResults: Map<string, ExecutionResult>,
  edges: Edge[],
  nodes: Node[]
): Promise<ExecutionResult> {
  // 入力データを収集（前ノードの出力）
  const inputData = collectInputData(node.id, edges, previousResults, nodes);
  let requestBody: any = undefined;

  try {
    const nodeType = node.data.type;

    let output: any;

    switch (nodeType) {
      case 'input':
        // 入力ノードは設定されたデータをそのまま出力
        output = {
          value: node.data.config?.value || '',
          nodeId: node.id,
        };
        break;

      case 'characterSheet':
        // キャラクターシートノードは選択されたキャラクターシートの画像を出力
        const characterSheet = node.data.config?.characterSheet;

        if (!characterSheet || !characterSheet.image_url) {
          // キャラクターシートが選択されていない場合はスキップ（エラーにしない）
          console.log('キャラクターシート未選択のためスキップ:', node.id);
          return {
            success: true,
            skipped: true,
            output: null,
            nodeId: node.id,
          };
        }

        // キャラクターシート画像をダウンロードしてbase64に変換
        try {
          let base64Data: string;
          let mimeType: string;

          // サーバーサイドの場合は直接GCP Storageから取得
          if (typeof window === 'undefined') {
            console.log('Loading character sheet image from GCP Storage (server-side):', characterSheet.image_url);
            const { getFileFromStorage } = await import('@/lib/gcp-storage');
            const { data, contentType } = await getFileFromStorage(characterSheet.image_url);
            base64Data = Buffer.from(data).toString('base64');
            mimeType = contentType;
          } else {
            // クライアントサイドの場合はストレージプロキシAPI経由
            const imageUrl = characterSheet.image_url.startsWith('http')
              ? characterSheet.image_url
              : `${getApiUrl('')}/api/storage/${characterSheet.image_url}`;

            console.log('Fetching character sheet image (client-side):', imageUrl);

            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch character sheet image: ${imageResponse.statusText}`);
            }

            const imageBlob = await imageResponse.blob();
            const imageBuffer = await imageBlob.arrayBuffer();
            base64Data = Buffer.from(imageBuffer).toString('base64');
            mimeType = imageBlob.type || 'image/jpeg';
          }

          // 画像データとしてフォーマット
          const characterSheetImageData = {
            mimeType,
            data: base64Data,
          };

          // 必要に応じてGCP Storageにアップロード
          let characterSheetStoragePath: string | undefined;

          if (typeof window !== 'undefined') {
            // クライアントサイドの場合はAPI経由でアップロード
            const uploadResponse = await fetch(getApiUrl('/api/upload-image'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base64Data: base64Data,
                mimeType: mimeType,
                fileName: `character-sheet-${characterSheet.id}.jpg`,
                folder: 'reference', // ワークフロー参照画像は/referenceフォルダに保存
              }),
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              characterSheetStoragePath = uploadData.storagePath;
              console.log('Character sheet image uploaded to storage:', characterSheetStoragePath);
            }
          } else {
            // サーバーサイドの場合は直接uploadImageToStorage関数を呼び出す
            const { uploadImageToStorage } = await import('@/lib/gcp-storage');
            characterSheetStoragePath = await uploadImageToStorage(
              base64Data,
              mimeType,
              `character-sheet-${characterSheet.id}.jpg`,
              'reference' // ワークフロー参照画像は/referenceフォルダに保存
            );
            console.log('Character sheet image uploaded to storage (server-side):', characterSheetStoragePath);
          }

          output = {
            imageData: characterSheetImageData,
            storagePath: characterSheetStoragePath,
            characterSheet: characterSheet,
            nodeId: node.id,
          };
        } catch (error: any) {
          console.error('Failed to load character sheet image:', error);
          return {
            success: false,
            error: `キャラクターシート画像の読み込みに失敗しました: ${error.message}`,
            output: null,
            nodeId: node.id,
          };
        }
        break;

      case 'rapid':
        // Rapid画像編集ノード
        const rapidPrompt = replaceVariables(node.data.config?.prompt || '', inputData);

        if (!rapidPrompt) {
          return {
            success: false,
            error: 'プロンプトが設定されていません',
            output: null,
            nodeId: node.id,
          };
        }

        // 入力画像を取得
        const rapidInputImages = extractImagesFromInput(inputData);

        if (rapidInputImages.length === 0) {
          return {
            success: false,
            error: '入力画像が必要です。画像入力ノードまたは画像生成ノードを接続してください。',
            output: null,
            nodeId: node.id,
          };
        }

        // 最初の画像を編集対象として使用
        const rapidInputImage = rapidInputImages[0];

        try {
          console.log('Calling Rapid API:', {
            prompt: rapidPrompt.substring(0, 100),
            hasInputImage: !!rapidInputImage,
          });

          const rapidResponse = await fetch(getApiUrl('/api/rapid'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: rapidPrompt,
              inputImage: rapidInputImage,
            }),
          });

          const rapidResult = await rapidResponse.json();

          if (!rapidResponse.ok) {
            const errorMessage = rapidResult.error || 'Rapid API request failed';
            const errorDetails = rapidResult.details ? `\n詳細: ${rapidResult.details}` : '';
            const errorHint = rapidResult.hint ? `\n${rapidResult.hint}` : '';
            const errorUrl = rapidResult.comfyuiUrl ? `\nComfyUI URL: ${rapidResult.comfyuiUrl}` : '';

            console.error('Rapid API error details:', {
              error: errorMessage,
              details: rapidResult.details,
              status: rapidResult.status,
              statusText: rapidResult.statusText,
              comfyuiUrl: rapidResult.comfyuiUrl,
              hint: rapidResult.hint,
            });

            throw new Error(`${errorMessage}${errorDetails}${errorHint}${errorUrl}`);
          }

          output = {
            imageData: rapidResult.imageData,
            storagePath: rapidResult.storagePath,
            nodeId: node.id,
          };

          requestBody = {
            prompt: rapidPrompt,
            inputImage: {
              storagePath: rapidInputImage.storagePath,
              mimeType: rapidInputImage.mimeType,
              data: rapidInputImage.data,
            },
          };
        } catch (error: any) {
          console.error('Rapid API error:', error);
          return {
            success: false,
            error: `Rapid画像編集に失敗しました: ${error.message}`,
            output: null,
            nodeId: node.id,
          };
        }
        break;

      case 'imageInput':
        // 画像入力ノードは画像データをGCP Storageから取得
        let imageStoragePath: string | undefined = node.data.config?.storagePath;
        let imageInputData: { mimeType: string; data: string } | null = null;

        if (imageStoragePath) {
          // storagePathがある場合は、GCP Storageから画像を取得してbase64に変換
          try {
            if (typeof window === 'undefined') {
              // サーバーサイドの場合は直接GCP Storageから取得
              console.log('Loading image from GCP Storage (server-side):', imageStoragePath);
              const { getFileFromStorage } = await import('@/lib/gcp-storage');
              const { data, contentType } = await getFileFromStorage(imageStoragePath);
              const base64Data = Buffer.from(data).toString('base64');
              imageInputData = {
                mimeType: contentType,
                data: base64Data,
              };
            } else {
              // クライアントサイドの場合はストレージプロキシAPI経由
              const imageUrl = `${getApiUrl('')}/api/storage/${imageStoragePath}`;
              console.log('Fetching image from storage (client-side):', imageUrl);

              const imageResponse = await fetch(imageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
              }

              const imageBlob = await imageResponse.blob();
              const imageBuffer = await imageBlob.arrayBuffer();
              const base64Data = Buffer.from(imageBuffer).toString('base64');
              imageInputData = {
                mimeType: imageBlob.type || 'image/jpeg',
                data: base64Data,
              };
            }
          } catch (error) {
            console.error('Failed to load image from storage:', error);
            return {
              success: false,
              error: `画像の読み込みに失敗しました: ${(error as Error).message}`,
              output: null,
              nodeId: node.id,
            };
          }
        }

        output = {
          imageData: imageInputData,
          storagePath: imageStoragePath,
          nodeId: node.id,
        };
        break;

      case 'process':
        // 処理ノードは入力データを加工
        output = {
          value: inputData,
          processed: true,
          nodeId: node.id,
        };
        break;

      case 'output':
        // 出力ノードは入力データをそのまま出力
        output = {
          value: inputData,
          nodeId: node.id,
        };
        break;

      case 'gemini':
        // Gemini APIを呼び出し
        const geminiPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 入力データから画像を抽出
        const geminiImages = extractImagesFromInput(inputData);

        console.log('Gemini execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          replacedPrompt: geminiPrompt,
          replacedPromptLength: geminiPrompt.length,
          imageCount: geminiImages.length,
        });

        if (!node.data.config?.prompt || !node.data.config.prompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプトが設定されていません。ノードの設定を開いてプロンプトを入力し、保存してください。`);
        }

        if (!geminiPrompt.trim()) {
          throw new Error(`Geminiノード "${node.data.config?.name || node.id}" のプロンプト変数が置換できませんでした。元のプロンプト: "${node.data.config?.prompt}"`);
        }

        // リクエストボディを保存（画像がある場合は含める）
        requestBody = {
          prompt: geminiPrompt,
          model: node.data.config?.model || 'gemini-2.5-flash',
          images: geminiImages.length > 0 ? geminiImages : undefined,
        };

        const geminiResponse = await fetch(getApiUrl('/api/gemini'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        // レスポンスのテキストを取得してからJSONとしてパース
        const responseText = await geminiResponse.text();
        let geminiData;

        try {
          geminiData = responseText ? JSON.parse(responseText) : { error: 'Empty response from Gemini API' };
        } catch (parseError) {
          console.error('Failed to parse Gemini API response:', responseText);

          // HTMLレスポンスの場合、より詳細なエラーメッセージを表示
          if (responseText.includes('Authentication Required') || responseText.includes('<!doctype')) {
            throw new Error(
              `Gemini API認証エラー: APIキーが無効または期限切れです。\n\n` +
              `環境変数 GEMINI_API_KEY を確認してください。\n` +
              `APIキーは https://aistudio.google.com/apikey から取得できます。`
            );
          }

          throw new Error(`Gemini APIのレスポンスが不正です: ${responseText.substring(0, 200)}`);
        }

        if (!geminiResponse.ok) {
          // エラーレスポンスからより詳細な情報を抽出
          const errorMsg = geminiData.details || geminiData.error || 'Gemini API call failed';
          const error: any = new Error(errorMsg);
          error.apiErrorDetails = geminiData; // API全体のエラーレスポンスを保存

          // 認証エラーの場合は追加情報を提供
          if (geminiResponse.status === 401 || errorMsg.includes('authentication')) {
            error.message = `Gemini API認証エラー: ${errorMsg}\n\n` +
              `環境変数 GEMINI_API_KEY を確認してください。\n` +
              `APIキーは https://aistudio.google.com/apikey から取得できます。`;
          }

          throw error;
        }

        output = {
          response: geminiData.response,
          nodeId: node.id,
        };
        break;

      case 'nanobana':
        // Nanobana APIを呼び出し
        let nanobanaPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const inputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              inputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              inputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (inputTexts.length > 0) {
          const combinedText = inputTexts.join(' ');
          if (nanobanaPrompt.trim()) {
            nanobanaPrompt = (nanobanaPrompt + ' ' + combinedText).trim();
          } else {
            nanobanaPrompt = combinedText;
          }
        }

        // 入力データから画像を抽出（参照画像として使用）
        const nanobanaImages: Array<{ mimeType: string; data: string }> = [];

        // 1. キャラクターシート画像を取得（最大4枚）
        const characterSheetIds = node.data.config?.characterSheetIds || [];
        if (characterSheetIds.length > 0) {
          console.log(`Loading ${characterSheetIds.length} character sheet(s) for Nanobana:`, characterSheetIds);

          for (const csId of characterSheetIds.slice(0, 4)) {
            try {
              // キャラクターシート情報をDBから取得
              const { getCharacterSheetById } = await import('@/lib/db');
              const characterSheet = await getCharacterSheetById(parseInt(csId));

              if (characterSheet && characterSheet.image_url) {
                // GCP Storageから画像を取得
                console.log('Loading character sheet image from GCP Storage:', characterSheet.image_url);
                const { getFileFromStorage } = await import('@/lib/gcp-storage');
                const { data: imageBuffer, contentType } = await getFileFromStorage(characterSheet.image_url);
                const base64Data = Buffer.from(imageBuffer).toString('base64');

                nanobanaImages.push({
                  mimeType: contentType,
                  data: base64Data,
                });

                console.log(`✓ Character sheet ${csId} loaded: ${characterSheet.name}`);
              } else {
                console.warn(`✗ Character sheet ${csId} not found or has no image`);
              }
            } catch (error) {
              console.error(`Failed to load character sheet ${csId}:`, error);
              // エラーがあっても続行（他のキャラクターシートは読み込む）
            }
          }
        }

        // 2. 参照画像を追加（フォームからアップロードされた画像、最大4枚）
        const referenceImagePaths = node.data.config?.referenceImagePaths || [];
        if (referenceImagePaths.length > 0) {
          console.log(`Loading ${referenceImagePaths.length} reference image(s) for Nanobana`);

          const remainingSlots = 4 - nanobanaImages.length;
          for (const imagePath of referenceImagePaths.slice(0, remainingSlots)) {
            try {
              // GCP Storageから画像を取得
              console.log('Loading reference image from GCP Storage:', imagePath);
              const { getFileFromStorage } = await import('@/lib/gcp-storage');
              const { data: imageBuffer, contentType } = await getFileFromStorage(imagePath);
              const base64Data = Buffer.from(imageBuffer).toString('base64');

              nanobanaImages.push({
                mimeType: contentType,
                data: base64Data,
              });

              console.log(`✓ Reference image loaded: ${imagePath}`);
            } catch (error) {
              console.error(`Failed to load reference image ${imagePath}:`, error);
              // エラーがあっても続行（他の画像は読み込む）
            }
          }
        }

        // 3. 前のノードから接続された画像を追加（最大4枚まで）
        const connectedImages = extractImagesFromInput(inputData);
        const remainingSlots = 4 - nanobanaImages.length;
        if (connectedImages.length > 0 && remainingSlots > 0) {
          nanobanaImages.push(...connectedImages.slice(0, remainingSlots));
        }

        console.log('Nanobana execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          inputTexts,
          finalPrompt: nanobanaPrompt,
          finalPromptLength: nanobanaPrompt.length,
          characterSheetCount: characterSheetIds.length,
          referenceImageCount: referenceImagePaths.length,
          connectedImageCount: connectedImages.length,
          totalImageCount: nanobanaImages.length,
        });

        if (!nanobanaPrompt.trim()) {
          throw new Error(`Nanobanaノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存（参照画像がある場合は含める）
        requestBody = {
          prompt: nanobanaPrompt,
          aspectRatio: node.data.config?.aspectRatio || '1:1',
          referenceImages: nanobanaImages.length > 0 ? nanobanaImages : undefined,
        };

        const nanobanaResponse = await fetch(getApiUrl('/api/nanobana'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const nanobanaResponseText = await nanobanaResponse.text();
        let nanobanaData;

        try {
          nanobanaData = nanobanaResponseText ? JSON.parse(nanobanaResponseText) : { error: 'Empty response from Nanobana API' };
        } catch (parseError) {
          console.error('Failed to parse Nanobana API response:', nanobanaResponseText);
          throw new Error(`Nanobana APIのレスポンスが不正です: ${nanobanaResponseText.substring(0, 200)}`);
        }

        if (!nanobanaResponse.ok) {
          // エラーメッセージを詳細に構築
          let errorMessage = nanobanaData.error || 'Nanobana API call failed';

          // APIから返された詳細メッセージも含める
          if (nanobanaData.message) {
            errorMessage = `${errorMessage}: ${nanobanaData.message}`;
          }

          // finishReasonがある場合も含める
          if (nanobanaData.finishReason) {
            errorMessage = `${errorMessage} (Reason: ${nanobanaData.finishReason})`;
          }

          const error: any = new Error(errorMessage);
          error.apiErrorDetails = nanobanaData; // API全体のエラーレスポンスを保存
          throw error;
        }

        output = {
          imageData: nanobanaData.imageData,
          storagePath: nanobanaData.storagePath, // GCP Storage内部パス
          nodeId: node.id,
        };
        break;

      case 'elevenlabs':
        // ElevenLabs Text-to-Speech APIを呼び出し
        let elevenLabsText = replaceVariables(
          node.data.config?.text || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const elevenLabsInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              elevenLabsInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              elevenLabsInputTexts.push(String(input.value));
            }
          }
        });

        // text欄の内容と前のノードの出力を組み合わせ
        if (elevenLabsInputTexts.length > 0) {
          const combinedText = elevenLabsInputTexts.join(' ');
          if (elevenLabsText.trim()) {
            elevenLabsText = (elevenLabsText + ' ' + combinedText).trim();
          } else {
            elevenLabsText = combinedText;
          }
        }

        console.log('ElevenLabs execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalText: node.data.config?.text,
          textLength: (node.data.config?.text || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          elevenLabsInputTexts,
          finalText: elevenLabsText,
          finalTextLength: elevenLabsText.length,
        });

        if (!elevenLabsText.trim()) {
          throw new Error(`ElevenLabsノード "${node.data.config?.name || node.id}" のテキストが空です。テキストを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存
        requestBody = {
          text: elevenLabsText,
          voiceId: node.data.config?.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
          modelId: node.data.config?.modelId || 'eleven_multilingual_v2',
        };

        const elevenLabsResponse = await fetch(getApiUrl('/api/elevenlabs'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const elevenLabsResponseText = await elevenLabsResponse.text();
        let elevenLabsData;

        try {
          elevenLabsData = elevenLabsResponseText ? JSON.parse(elevenLabsResponseText) : { error: 'Empty response from ElevenLabs API' };
        } catch (parseError) {
          console.error('Failed to parse ElevenLabs API response:', elevenLabsResponseText);
          throw new Error(`ElevenLabs APIのレスポンスが不正です: ${elevenLabsResponseText.substring(0, 200)}`);
        }

        if (!elevenLabsResponse.ok) {
          const error: any = new Error(elevenLabsData.error || 'ElevenLabs API call failed');
          error.apiErrorDetails = elevenLabsData; // API全体のエラーレスポンスを保存
          throw error;
        }

        output = {
          audioData: elevenLabsData.audioData,
          nodeId: node.id,
        };
        break;

      case 'higgsfield':
        // Higgsfield Video Generation APIを呼び出し
        let higgsfieldPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const higgsfieldInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              higgsfieldInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              higgsfieldInputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (higgsfieldInputTexts.length > 0) {
          const combinedText = higgsfieldInputTexts.join(' ');
          if (higgsfieldPrompt.trim()) {
            higgsfieldPrompt = (higgsfieldPrompt + ' ' + combinedText).trim();
          } else {
            higgsfieldPrompt = combinedText;
          }
        }

        console.log('Higgsfield execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          higgsfieldInputTexts,
          finalPrompt: higgsfieldPrompt,
          finalPromptLength: higgsfieldPrompt.length,
        });

        if (!higgsfieldPrompt.trim()) {
          throw new Error(`Higgsfieldノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // 前のノードから画像のstoragePathを検索（ノードIDベースのキーのみ）
        let inputImagePath: string | null = null;
        Object.entries(inputData).forEach(([key, input]: [string, any]) => {
          // ノードIDベースのキーのみを処理（node-で始まるキー）
          if (key.startsWith('node-') && input && typeof input === 'object' && input.storagePath) {
            inputImagePath = input.storagePath;
          }
        });

        // Higgsfieldは画像が必須
        if (!inputImagePath) {
          throw new Error(`Higgsfieldノード "${node.data.config?.name || node.id}" には参照画像が必要です。画像生成ノード（Nanobanaなど）または画像入力ノードを接続してください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: higgsfieldPrompt,
          duration: node.data.config?.duration || 5,
          cfgScale: node.data.config?.cfgScale || 0.5,
          enhancePrompt: node.data.config?.enhancePrompt || false,
          negativePrompt: node.data.config?.negativePrompt || '',
          inputImagePath: inputImagePath, // 画像パス（署名付きURL生成用）
        };

        const higgsfieldResponse = await fetch(getApiUrl('/api/higgsfield'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const higgsfieldResponseText = await higgsfieldResponse.text();
        let higgsfieldData;

        try {
          higgsfieldData = higgsfieldResponseText ? JSON.parse(higgsfieldResponseText) : { error: 'Empty response from Higgsfield API' };
        } catch (parseError) {
          console.error('Failed to parse Higgsfield API response:', higgsfieldResponseText);
          throw new Error(`Higgsfield APIのレスポンスが不正です: ${higgsfieldResponseText.substring(0, 200)}`);
        }

        // 202 Accepted（処理中）の場合も成功として扱う
        if (!higgsfieldResponse.ok && higgsfieldResponse.status !== 202) {
          const error: any = new Error(higgsfieldData.error || 'Higgsfield API call failed');
          error.apiErrorDetails = higgsfieldData; // API全体のエラーレスポンスを保存
          throw error;
        }

        // 処理が完了した場合
        if (higgsfieldData.success && higgsfieldData.videoUrl) {
          output = {
            videoUrl: higgsfieldData.videoUrl,
            jobId: higgsfieldData.jobId,
            duration: higgsfieldData.duration,
            nodeId: node.id,
          };
        }
        // 処理中の場合
        else {
          output = {
            status: 'processing',
            message: higgsfieldData.message || '動画生成中です',
            jobSetId: higgsfieldData.jobSetId,
            jobId: higgsfieldData.jobId,
            dashboardUrl: higgsfieldData.dashboardUrl,
            note: higgsfieldData.note,
            nodeId: node.id,
          };
        }
        break;

      case 'seedream4':
        // Seedream4 Image Generation APIを呼び出し
        let seedream4Prompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const seedream4InputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              seedream4InputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              seedream4InputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (seedream4InputTexts.length > 0) {
          const combinedText = seedream4InputTexts.join(' ');
          if (seedream4Prompt.trim()) {
            seedream4Prompt = (seedream4Prompt + ' ' + combinedText).trim();
          } else {
            seedream4Prompt = combinedText;
          }
        }

        // 前のノードから画像のstoragePathをすべて収集（最大8枚）（ノードIDベースのキーのみ）
        const seedream4ImagePaths: string[] = [];
        Object.entries(inputData).forEach(([key, input]: [string, any]) => {
          // ノードIDベースのキーのみを処理（node-で始まるキー）
          if (key.startsWith('node-') && input && typeof input === 'object' && input.storagePath) {
            seedream4ImagePaths.push(input.storagePath);
          }
        });

        // 最大8枚まで
        const limitedImagePaths = seedream4ImagePaths.slice(0, 8);

        console.log('Seedream4 execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          seedream4InputTexts,
          finalPrompt: seedream4Prompt,
          finalPromptLength: seedream4Prompt.length,
          imageCount: limitedImagePaths.length,
        });

        if (!seedream4Prompt.trim()) {
          throw new Error(`Seedream4ノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // Seedream4は画像が必須
        if (limitedImagePaths.length === 0) {
          throw new Error(`Seedream4ノード "${node.data.config?.name || node.id}" には少なくとも1枚の参照画像が必要です。画像生成ノード（Nanobanaなど）または画像入力ノードを接続してください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: seedream4Prompt,
          aspectRatio: node.data.config?.aspectRatio || '4:3',
          quality: node.data.config?.quality || 'basic',
          inputImagePaths: limitedImagePaths,
        };

        const seedream4Response = await fetch(getApiUrl('/api/seedream4'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const seedream4ResponseText = await seedream4Response.text();
        let seedream4Data;

        try {
          seedream4Data = seedream4ResponseText ? JSON.parse(seedream4ResponseText) : { error: 'Empty response from Seedream4 API' };
        } catch (parseError) {
          console.error('Failed to parse Seedream4 API response:', seedream4ResponseText);
          throw new Error(`Seedream4 APIのレスポンスが不正です: ${seedream4ResponseText.substring(0, 200)}`);
        }

        // 202 Accepted（処理中）の場合も成功として扱う
        if (!seedream4Response.ok && seedream4Response.status !== 202) {
          const error: any = new Error(seedream4Data.error || 'Seedream4 API call failed');
          error.apiErrorDetails = seedream4Data; // API全体のエラーレスポンスを保存
          throw error;
        }

        // 処理が完了した場合
        if (seedream4Data.success && seedream4Data.imageUrl) {
          output = {
            imageUrl: seedream4Data.imageUrl,
            jobId: seedream4Data.jobId,
            nodeId: node.id,
          };
        }
        // 処理中の場合
        else {
          output = {
            status: 'processing',
            message: seedream4Data.message || '画像生成中です',
            jobSetId: seedream4Data.jobSetId,
            jobId: seedream4Data.jobId,
            dashboardUrl: seedream4Data.dashboardUrl,
            note: seedream4Data.note,
            nodeId: node.id,
          };
        }
        break;

      case 'comfyui':
        // ComfyUIワークフロー処理ノード（キューに追加）
        const comfyuiWorkflowName = node.data.config?.workflowName;
        const comfyuiWorkflowJson = node.data.config?.workflowJson;
        const comfyuiPrompt = replaceVariables(node.data.config?.prompt || '', inputData);

        if (!comfyuiWorkflowName) {
          return {
            success: false,
            error: 'ComfyUIワークフロー名が設定されていません',
            output: null,
            nodeId: node.id,
          };
        }

        if (!comfyuiWorkflowJson) {
          return {
            success: false,
            error: 'ComfyUIワークフロー定義が設定されていません',
            output: null,
            nodeId: node.id,
          };
        }

        // 入力画像を収集
        const comfyuiInputImages = extractImagesFromInput(inputData);

        try {
          console.log('Creating ComfyUI queue item:', {
            workflowName: comfyuiWorkflowName,
            prompt: comfyuiPrompt.substring(0, 100),
            imageCount: comfyuiInputImages.length,
          });

          const comfyuiResponse = await fetch(getApiUrl('/api/comfyui/queue'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              workflowName: comfyuiWorkflowName,
              workflowJson: comfyuiWorkflowJson,
              prompt: comfyuiPrompt,
              inputImages: comfyuiInputImages,
            }),
          });

          const comfyuiResult = await comfyuiResponse.json();

          if (!comfyuiResponse.ok) {
            throw new Error(comfyuiResult.error || 'Failed to create ComfyUI queue item');
          }

          output = {
            queueItemId: comfyuiResult.queueItemId,
            status: comfyuiResult.status,
            workflowName: comfyuiWorkflowName,
            nodeId: node.id,
          };

          requestBody = {
            workflowName: comfyuiWorkflowName,
            prompt: comfyuiPrompt,
            imageCount: comfyuiInputImages.length,
          };

          console.log('ComfyUI queue item created:', comfyuiResult.queueItemId);
        } catch (error: any) {
          console.error('ComfyUI queue error:', error);
          return {
            success: false,
            error: `ComfyUIキューへの追加に失敗しました: ${error.message}`,
            output: null,
            nodeId: node.id,
          };
        }
        break;

      case 'popcorn':
        // Popcorn Image Generation APIを呼び出し（Higgsfield text2image/keyframes）
        let popcornPrompt = replaceVariables(
          node.data.config?.prompt || '',
          inputData
        );

        // 前のノードからのテキスト出力を自動的に追加
        const popcornInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              popcornInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              popcornInputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (popcornInputTexts.length > 0) {
          const combinedText = popcornInputTexts.join(' ');
          if (popcornPrompt.trim()) {
            popcornPrompt = (popcornPrompt + ' ' + combinedText).trim();
          } else {
            popcornPrompt = combinedText;
          }
        }

        // 前のノードから画像のstoragePathをすべて収集（最大8枚、オプショナル）
        const popcornImagePaths: string[] = [];
        Object.entries(inputData).forEach(([key, input]: [string, any]) => {
          // ノードIDベースのキーのみを処理（node-で始まるキー）
          if (key.startsWith('node-') && input && typeof input === 'object' && input.storagePath) {
            popcornImagePaths.push(input.storagePath);
          }
        });

        // 最大8枚まで
        const limitedPopcornImagePaths = popcornImagePaths.slice(0, 8);

        console.log('Popcorn execution:', {
          nodeId: node.id,
          nodeName: node.data.config?.name,
          originalPrompt: node.data.config?.prompt,
          promptLength: (node.data.config?.prompt || '').length,
          inputData: sanitizeForLog(inputData),
          inputDataKeys: Object.keys(inputData),
          popcornInputTexts,
          finalPrompt: popcornPrompt,
          finalPromptLength: popcornPrompt.length,
          imageCount: limitedPopcornImagePaths.length,
        });

        if (!popcornPrompt.trim()) {
          throw new Error(`Popcornノード "${node.data.config?.name || node.id}" のプロンプトが空です。プロンプトを入力するか、前のノードから値を受け取ってください。`);
        }

        // リクエストボディを保存
        requestBody = {
          prompt: popcornPrompt,
          aspectRatio: node.data.config?.aspectRatio || '3:4',
          count: node.data.config?.count || 1,
          quality: node.data.config?.quality || '720p',
          seed: node.data.config?.seed,
          presetId: node.data.config?.presetId,
          enhancePrompt: node.data.config?.enhancePrompt || false,
          inputImagePaths: limitedPopcornImagePaths.length > 0 ? limitedPopcornImagePaths : undefined,
        };

        const popcornResponse = await fetch(getApiUrl('/api/popcorn'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const popcornResponseText = await popcornResponse.text();
        let popcornData;

        try {
          popcornData = popcornResponseText ? JSON.parse(popcornResponseText) : { error: 'Empty response from Popcorn API' };
        } catch (parseError) {
          console.error('Failed to parse Popcorn API response:', popcornResponseText);
          throw new Error(`Popcorn APIのレスポンスが不正です: ${popcornResponseText.substring(0, 200)}`);
        }

        // 202 Accepted（処理中）の場合も成功として扱う
        if (!popcornResponse.ok && popcornResponse.status !== 202) {
          const error: any = new Error(popcornData.error || 'Popcorn API call failed');
          error.apiErrorDetails = popcornData; // API全体のエラーレスポンスを保存
          throw error;
        }

        // 処理が完了した場合
        if (popcornData.success && popcornData.imageUrls && popcornData.imageUrls.length > 0) {
          output = {
            imageUrls: popcornData.imageUrls,
            jobSetId: popcornData.jobSetId,
            count: popcornData.count,
            nodeId: node.id,
          };
        }
        // 処理中の場合
        else {
          output = {
            status: 'processing',
            message: popcornData.message || '画像生成中です',
            jobSetId: popcornData.jobSetId,
            jobIds: popcornData.jobIds,
            dashboardUrl: popcornData.dashboardUrl,
            note: popcornData.note,
            nodeId: node.id,
          };
        }
        break;

      case 'qwenImage':
        // Qwen Image Generation（キューに追加）
        let qwenPrompt = replaceVariables(node.data.config?.prompt || '', inputData);

        // 前のノードからのテキスト出力を自動的に追加
        const qwenInputTexts: string[] = [];
        Object.values(inputData).forEach((input: any) => {
          if (input && typeof input === 'object') {
            // geminiノードからのresponseフィールドを追加
            if (input.response && typeof input.response === 'string') {
              qwenInputTexts.push(input.response);
            }
            // その他のvalueフィールドを追加
            else if (input.value !== undefined && input.value !== null) {
              qwenInputTexts.push(String(input.value));
            }
          }
        });

        // prompt欄の内容と前のノードの出力を組み合わせ
        if (qwenInputTexts.length > 0) {
          const combinedText = qwenInputTexts.join('\n\n');
          if (qwenPrompt.trim()) {
            qwenPrompt = `${qwenPrompt}\n\n${combinedText}`;
          } else {
            qwenPrompt = combinedText;
          }
        }

        if (!qwenPrompt || !qwenPrompt.trim()) {
          return {
            success: false,
            error: 'プロンプトが設定されていません',
            output: null,
            nodeId: node.id,
          };
        }

        // 入力データから参照画像を抽出
        const qwenInputImages = extractImagesFromInput(inputData);
        const qwenImagePaths: string[] = [];

        // 参照画像がある場合はGCP Storageにアップロード
        if (qwenInputImages.length > 0) {
          for (const image of qwenInputImages) {
            try {
              // 既にstoragePathがある場合はそれを使用
              if (image.storagePath) {
                qwenImagePaths.push(image.storagePath);
              } else {
                // クライアントサイドかサーバーサイドかを判定
                const isServer = typeof window === 'undefined';

                if (!isServer) {
                  // クライアントサイドの場合はAPIエンドポイント経由でアップロード
                  const uploadResponse = await fetch(getApiUrl('/api/upload-image'), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      base64Data: image.data,
                      mimeType: image.mimeType,
                      folder: 'kazika/reference',
                    }),
                  });

                  if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image via API');
                  }

                  const uploadData = await uploadResponse.json();
                  qwenImagePaths.push(uploadData.storagePath);
                  console.log('Reference image uploaded via API:', uploadData.storagePath);
                } else {
                  // サーバーサイドの場合は直接uploadImageToStorage関数を呼び出す
                  const { uploadImageToStorage } = await import('@/lib/gcp-storage');
                  const imagePath = await uploadImageToStorage(
                    image.data,
                    image.mimeType,
                    undefined,
                    'kazika/reference'
                  );
                  qwenImagePaths.push(imagePath);
                  console.log('Reference image uploaded directly:', imagePath);
                }
              }
            } catch (uploadError: any) {
              console.error('Failed to upload reference image:', uploadError);
              // 画像アップロード失敗は警告のみ（処理は続行）
            }
          }

          console.log('Qwen reference images uploaded:', qwenImagePaths);
        }

        try {
          console.log('Creating Qwen Image queue item:', {
            originalPrompt: node.data.config?.prompt,
            combinedPrompt: qwenPrompt.substring(0, 200),
            promptLength: qwenPrompt.length,
            referenceImageCount: qwenImagePaths.length,
          });

          const qwenResponse = await fetch(getApiUrl('/api/qwen-image'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: qwenPrompt,
              referenceImages: qwenImagePaths, // 参照画像のパスを送信
            }),
          });

          const qwenResult = await qwenResponse.json();

          if (!qwenResponse.ok) {
            throw new Error(qwenResult.error || 'Failed to create Qwen Image queue item');
          }

          output = {
            queueItemId: qwenResult.queueItemId,
            status: 'queued',
            nodeId: node.id,
          };

          requestBody = {
            prompt: qwenPrompt,
            referenceImageCount: qwenImagePaths.length,
          };

          console.log('Qwen Image queue item created:', qwenResult.queueItemId);
        } catch (error: any) {
          console.error('Qwen Image queue error:', error);
          return {
            success: false,
            error: `Qwen Image キューへの追加に失敗しました: ${error.message}`,
            output: null,
            nodeId: node.id,
          };
        }
        break;

      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }

    return {
      success: true,
      nodeId: node.id,
      input: inputData,
      requestBody,
      output,
    };
  } catch (error: any) {
    // 詳細なエラー情報をログ出力
    console.error('========================================');
    console.error('Node execution error');
    console.error('========================================');
    console.error('Node ID:', node.id);
    console.error('Node type:', node.data.type);
    console.error('Node name:', node.data.config?.name);
    console.error('Error type:', error.constructor?.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error cause:', error.cause);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(requestBody, null, 2));

    // fetchエラーの場合、causeに詳細情報があることが多い
    if (error.cause) {
      console.error('Error cause details:');
      console.error('  Type:', error.cause.constructor?.name);
      console.error('  Message:', error.cause.message);
      console.error('  Code:', error.cause.code);
      console.error('  Stack:', error.cause.stack);
    }

    // 全てのエラープロパティを出力
    console.error('All error properties:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('========================================');

    return {
      success: false,
      nodeId: node.id,
      input: inputData,
      requestBody,
      output: null,
      error: error.message,
      errorDetails: error.apiErrorDetails, // APIからの詳細なエラー情報
    };
  }
}

/**
 * 前ノードの出力データを収集
 */
function collectInputData(
  nodeId: string,
  edges: Edge[],
  previousResults: Map<string, ExecutionResult>,
  nodes: Node[]
): any {
  const inputEdges = edges.filter((edge) => edge.target === nodeId);

  if (inputEdges.length === 0) {
    return {};
  }

  const inputs: any = {};
  inputEdges.forEach((edge) => {
    const sourceResult = previousResults.get(edge.source);
    if (sourceResult?.success) {
      // nodeIdでの参照
      inputs[edge.source] = sourceResult.output;

      // ノード名での参照も可能にする
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode?.data?.config?.name) {
        inputs[sourceNode.data.config.name] = sourceResult.output;
      }
    }
  });

  return inputs;
}

/**
 * 入力データから画像データを抽出
 * 重複を防ぐため、同じ画像データは1回のみ追加する
 */
function extractImagesFromInput(inputData: any): Array<{ mimeType: string; data: string; storagePath?: string }> {
  const images: Array<{ mimeType: string; data: string; storagePath?: string }> = [];
  const seenImageData = new Set<string>();

  // ノードIDベースのキーのみを処理（ノード名での重複を避けるため）
  // ノードIDは "node-" で始まる形式
  Object.entries(inputData).forEach(([key, input]: [string, any]) => {
    // ノードIDベースのキーのみを処理（node-で始まるキー）
    if (!key.startsWith('node-')) {
      return;
    }

    if (input && typeof input === 'object') {
      let imageData: { mimeType: string; data: string; storagePath?: string } | null = null;

      // imageInputノードからの画像データ
      if (input.imageData && input.imageData.mimeType && input.imageData.data) {
        imageData = {
          mimeType: input.imageData.mimeType,
          data: input.imageData.data,
          storagePath: input.storagePath, // storagePathも含める
        };
      }
      // nanobananaノードからの生成画像
      else if (input.imageData && typeof input.imageData === 'object') {
        if (input.imageData.mimeType && input.imageData.data) {
          imageData = {
            mimeType: input.imageData.mimeType,
            data: input.imageData.data,
            storagePath: input.storagePath, // storagePathも含める
          };
        }
      }

      // 画像データが見つかり、かつまだ追加されていない場合のみ追加
      if (imageData && !seenImageData.has(imageData.data)) {
        seenImageData.add(imageData.data);
        images.push(imageData);
      }
    }
  });

  return images;
}

/**
 * プロンプト内の変数を置換
 * サポートする形式:
 * - {{nodeId.property}} - ノードIDで参照
 * - {{nodeName.property}} - ノード名で参照
 * - {{prev.property}} - 直前のノードの出力を参照（単一の入力の場合）
 * - {{prev}} - 直前のノードの出力全体を参照
 */
function replaceVariables(template: string, inputs: any): string {
  // {{...}} 形式の変数を置換
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let value: any;

    // 'prev' ショートカット処理
    if (parts[0] === 'prev') {
      const inputKeys = Object.keys(inputs);
      if (inputKeys.length === 1) {
        // 単一の入力の場合
        value = inputs[inputKeys[0]];
        // prevの後にプロパティ指定がある場合
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            if (value && typeof value === 'object' && parts[i] in value) {
              value = value[parts[i]];
            } else {
              return `{{${path}}}`; // 見つからない場合は元の変数を残す
            }
          }
        }
      } else {
        // 複数の入力がある場合はprevは使えない
        return `{{${path}}}`;
      }
    } else {
      // 通常のパス参照
      value = inputs;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return `{{${path}}}`; // 見つからない場合は元の変数を残す
        }
      }
    }

    return value !== undefined && value !== null ? String(value) : `{{${path}}}`;
  });
}

/**
 * ワークフロー全体を実行
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  onProgress?: (nodeId: string, status: 'running' | 'completed' | 'failed', result?: ExecutionResult) => void
): Promise<WorkflowExecutionResult> {
  try {
    // 実行順序を決定
    const executionOrder = topologicalSort(nodes, edges);

    const results = new Map<string, ExecutionResult>();

    // ノードを順次実行
    for (const nodeId of executionOrder) {
      const node = nodes.find((n) => n.id === nodeId);

      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      // 実行中を通知
      onProgress?.(nodeId, 'running');

      // ノードを実行
      const result = await executeNode(node, results, edges, nodes);
      results.set(nodeId, result);

      // 完了/失敗を通知（結果も一緒に渡す）
      onProgress?.(nodeId, result.success ? 'completed' : 'failed', result);

      // エラー時は中断
      if (!result.success) {
        throw new Error(`Node ${nodeId} failed: ${result.error}`);
      }
    }

    return {
      success: true,
      results,
    };
  } catch (error: any) {
    return {
      success: false,
      results: new Map(),
      error: error.message,
    };
  }
}
