import { Node } from 'reactflow';
import { FormFieldConfig } from '@/components/form/DynamicFormField';
import { ELEVENLABS_PRESET_VOICES, ELEVENLABS_MODELS_FOR_FORM } from '@/lib/elevenlabs/constants';

/**
 * ノードタイプごとの設定フィールド定義
 */
export interface NodeTypeConfig {
  fields: FormFieldConfig[];
  icon?: string;
  color?: string;
  displayName?: string;
}

/**
 * 各ノードタイプの設定を取得
 */
export function getNodeTypeConfig(nodeType: string): NodeTypeConfig {
  switch (nodeType) {
    case 'gemini':
      return {
        displayName: 'Gemini AI',
        color: '#ea80fc',
        fields: [
          {
            type: 'select',
            name: 'model',
            label: 'モデル',
            required: false,
            options: [
              { label: 'Gemini 2.5 Flash (推奨)', value: 'gemini-2.5-flash' },
              { label: 'Gemini 2.5 Pro (高性能)', value: 'gemini-2.5-pro' },
              { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
            ],
            helperText: 'APIキーは環境変数から自動的に読み込まれます',
          },
          {
            type: 'textarea',
            name: 'prompt',
            label: 'プロンプト',
            placeholder: 'ここにプロンプトを入力してください...',
            required: false,
            rows: 6,
            helperText: '前のノードの結果を {{prev.response}} または {{ノード名.response}} で参照できます',
          },
        ],
      };

    case 'nanobana':
      return {
        displayName: 'Nanobana 画像生成',
        color: '#ff6b9d',
        fields: [
          {
            type: 'select',
            name: 'aspectRatio',
            label: 'アスペクト比',
            required: false,
            options: [
              { label: '1:1 (正方形)', value: '1:1' },
              { label: '16:9 (横長・ワイド)', value: '16:9' },
              { label: '9:16 (縦長・ポートレート)', value: '9:16' },
              { label: '4:3 (横長・標準)', value: '4:3' },
              { label: '3:4 (縦長・標準)', value: '3:4' },
              { label: '3:2 (横長・写真)', value: '3:2' },
              { label: '2:3 (縦長・写真)', value: '2:3' },
            ],
            helperText: '生成する画像のアスペクト比を選択',
          },
          {
            type: 'textarea',
            name: 'prompt',
            label: '画像生成プロンプト（必須）',
            placeholder: '生成したい画像の説明を入力してください...',
            required: true,
            rows: 6,
            helperText: 'プロンプトは英語で記述することを推奨します。前のノードの結果を参照可能です。',
          },
          {
            type: 'characterSheets',
            name: 'selectedCharacterSheetIds',
            label: 'キャラクターシート',
            required: false,
            maxSelections: 4,
            helperText: '画像生成に使用するキャラクターシート（最大4つ）',
          },
          // referenceImagesは現時点では保存時にstoragePathに変換せず、
          // {mimeType, data}形式のまま保持します（既存の実装に合わせる）
          // 将来的にはstoragePathベースに統一することを検討
        ],
      };

    case 'elevenlabs':
      return {
        displayName: 'ElevenLabs TTS',
        color: '#4fc3f7',
        fields: [
          {
            type: 'select',
            name: 'voiceId',
            label: '音声ID',
            required: false,
            options: [
              { label: 'George (英語)', value: 'JBFqnCBsd6RMkjVDRZzb' },
              { label: 'Rachel (英語)', value: '21m00Tcm4TlvDq8ikWAM' },
              { label: 'Domi (英語)', value: 'AZnzlk1XvdvUeBnXmlld' },
              { label: 'Bella (英語)', value: 'EXAVITQu4vr4xnSDxMaL' },
              { label: 'Antoni (英語)', value: 'ErXwobaYiN019PkySvjV' },
              { label: 'Elli (英語)', value: 'MF3mGyEYCl7XYWbV9V6O' },
              { label: 'Josh (英語)', value: 'TxGEqnHWrfWFTfGW9XjX' },
              { label: 'Arnold (英語)', value: 'VR6AewLTigWG4xSOukaG' },
              { label: 'Adam (英語)', value: 'pNInz6obpgDQGcFmaJgB' },
              { label: 'Sam (英語)', value: 'yoZ06aMxZJJ28mfd3POQ' },
            ],
            helperText: 'ElevenLabsの音声を選択（プリセット音声 + キャラクターのカスタム音声）',
          },
          {
            type: 'select',
            name: 'modelId',
            label: 'モデル',
            required: false,
            options: [
              { label: 'Turbo v2.5 (推奨・バランス型) ⭐', value: 'eleven_turbo_v2_5' },
              { label: 'Flash v2.5 (超高速・低コスト)', value: 'eleven_flash_v2_5' },
              { label: 'Multilingual v2 (安定)', value: 'eleven_multilingual_v2' },
              { label: 'Turbo v2 (高速)', value: 'eleven_turbo_v2' },
              { label: 'Monolingual v1 (英語のみ)', value: 'eleven_monolingual_v1' },
              { label: 'Eleven v3 (最高品質・Alpha・要アクセス権)', value: 'eleven_v3' },
            ],
            helperText: 'Turbo v2.5推奨（バランス型）、v3は最高品質だが要アクセス権',
          },
          {
            type: 'textarea',
            name: 'text',
            label: 'テキスト',
            placeholder: '音声に変換するテキストを入力してください...',
            required: false,
            rows: 6,
            helperText: '前のノードの結果を参照可能です',
          },
        ],
      };

    case 'higgsfield':
      return {
        displayName: 'Higgsfield 動画生成',
        color: '#9c27b0',
        fields: [
          {
            type: 'textarea',
            name: 'prompt',
            label: 'プロンプト',
            placeholder: '動画生成用のプロンプトを入力してください...',
            required: false,
            rows: 6,
            helperText: '前のノードの結果を参照可能です',
          },
          {
            type: 'textarea',
            name: 'negativePrompt',
            label: 'ネガティブプロンプト',
            placeholder: '除外したい要素を記述...',
            required: false,
            rows: 3,
          },
          {
            type: 'select',
            name: 'duration',
            label: '動画の長さ',
            required: false,
            options: [
              { label: '5秒', value: '5' },
              { label: '10秒', value: '10' },
            ],
          },
          {
            type: 'slider',
            name: 'cfgScale',
            label: 'CFG Scale',
            required: false,
            min: 0,
            max: 1,
            step: 0.1,
            helperText: 'プロンプトに対する忠実度を調整します',
          },
          {
            type: 'switch',
            name: 'enhancePrompt',
            label: 'プロンプト自動強化',
            required: false,
            helperText: 'AIがプロンプトを自動的に改善します',
          },
        ],
      };

    case 'imageInput':
      return {
        displayName: '画像入力',
        color: '#9c27b0',
        fields: [
          {
            type: 'image',
            name: 'storagePath',
            label: '参照画像',
            required: false,
            helperText: 'この画像を他のノード（GeminiやNanobana）で参照できます。画像サイズは5MB以下にしてください。',
          },
        ],
      };

    default:
      return {
        displayName: nodeType,
        fields: [],
      };
  }
}

/**
 * ワークフローのノードから必要なフォームフィールドを自動抽出
 */
export function extractFormFieldsFromNodes(nodes: Node[]): FormFieldConfig[] {
  const fields: FormFieldConfig[] = [];
  const addedFieldNames = new Set<string>();

  nodes.forEach((node) => {
    const nodeType = node.data.type || node.type;
    const nodeName = node.data.config?.name || node.id;

    // 入力ノード（プロンプト入力）
    if (nodeType === 'input') {
      const fieldName = `input_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'prompt',
          name: fieldName,
          label: nodeName || '入力テキスト',
          placeholder: 'テキストを入力してください',
          required: false,
          rows: 4,
          helperText: `${nodeName}への入力`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // 画像入力ノード
    if (nodeType === 'imageInput') {
      const fieldName = `image_${node.id}`;
      const multiple = node.data.config?.multiple || false;

      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: multiple ? 'images' : 'image',
          name: fieldName,
          label: nodeName || '画像アップロード',
          required: false,
          maxImages: multiple ? (node.data.config?.maxImages || 8) : undefined,
          helperText: `${nodeName}に使用する画像`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // Geminiノード
    if (nodeType === 'gemini') {
      const fieldName = `gemini_prompt_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'textarea',
          name: fieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || 'Geminiへの指示を入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // Nanobanaノード
    if (nodeType === 'nanobana') {
      // プロンプト入力
      const promptFieldName = `nanobana_prompt_${node.id}`;
      if (!addedFieldNames.has(promptFieldName)) {
        fields.push({
          type: 'textarea',
          name: promptFieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || '画像生成の指示を入力',
          required: true,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト（必須）`,
        });
        addedFieldNames.add(promptFieldName);
      }

      // キャラクターシート選択（最大4つ）
      const characterSheetFieldName = `nanobana_characterSheets_${node.id}`;
      if (!addedFieldNames.has(characterSheetFieldName)) {
        fields.push({
          type: 'characterSheets',
          name: characterSheetFieldName,
          label: `${nodeName} キャラクターシート`,
          required: false,
          maxSelections: 4,
          helperText: `${nodeName}で使用するキャラクターシート（最大4つ）`,
        });
        addedFieldNames.add(characterSheetFieldName);
      }

      // 参照画像アップロード（最大4つ）
      const referenceImagesFieldName = `nanobana_referenceImages_${node.id}`;
      if (!addedFieldNames.has(referenceImagesFieldName)) {
        fields.push({
          type: 'images',
          name: referenceImagesFieldName,
          label: `${nodeName} 参照画像`,
          required: false,
          maxImages: 4,
          helperText: `${nodeName}で使用する参照画像（最大4つ）`,
        });
        addedFieldNames.add(referenceImagesFieldName);
      }
    }

    // Higgsfieldノード
    if (nodeType === 'higgsfield') {
      const fieldName = `higgsfield_prompt_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'textarea',
          name: fieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || '動画生成の指示を入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // Seedream4ノード
    if (nodeType === 'seedream4') {
      const fieldName = `seedream4_prompt_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'textarea',
          name: fieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || '動画生成の指示を入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // キャラクターシートノード
    if (nodeType === 'characterSheet') {
      const fieldName = `characterSheet_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'characterSheet',
          name: fieldName,
          label: nodeName || 'キャラクターシート選択',
          required: false,
          helperText: `${nodeName}で使用するキャラクターシート`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // QwenImageノード
    if (nodeType === 'qwenImage') {
      const fieldName = `qwenImage_prompt_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'textarea',
          name: fieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || 'Qwen画像生成の指示を入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト`,
        });
        addedFieldNames.add(fieldName);
      }
    }

    // ElevenLabsノード
    if (nodeType === 'elevenlabs') {
      // テキスト入力フィールド
      const textFieldName = `elevenlabs_text_${node.id}`;
      if (!addedFieldNames.has(textFieldName)) {
        fields.push({
          type: 'textarea',
          name: textFieldName,
          label: `${nodeName} テキスト`,
          placeholder: node.data.config?.text || '音声に変換するテキストを入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で音声に変換するテキスト`,
        });
        addedFieldNames.add(textFieldName);
      }

      // 音声ID選択フィールド
      const voiceIdFieldName = `elevenlabs_voiceId_${node.id}`;
      if (!addedFieldNames.has(voiceIdFieldName)) {
        fields.push({
          type: 'select',
          name: voiceIdFieldName,
          label: `${nodeName} 音声ID`,
          required: false,
          helperText: 'ElevenLabsの音声を選択（プリセット音声）',
          options: ELEVENLABS_PRESET_VOICES.map(voice => ({
            label: voice.label,
            value: voice.value,
          })),
        });
        addedFieldNames.add(voiceIdFieldName);
      }

      // モデルID選択フィールド
      const modelIdFieldName = `elevenlabs_modelId_${node.id}`;
      if (!addedFieldNames.has(modelIdFieldName)) {
        fields.push({
          type: 'select',
          name: modelIdFieldName,
          label: `${nodeName} モデル`,
          required: false,
          helperText: 'ElevenLabsの音声生成モデルを選択',
          options: ELEVENLABS_MODELS_FOR_FORM.map(model => ({
            label: model.label,
            value: model.value,
          })),
        });
        addedFieldNames.add(modelIdFieldName);
      }
    }
  });

  return fields;
}

/**
 * 手動設定されたフィールドと自動抽出されたフィールドをマージ
 * 手動設定が優先される
 */
export function mergeFormFields(
  manualFields: FormFieldConfig[],
  autoFields: FormFieldConfig[]
): FormFieldConfig[] {
  const manualFieldNames = new Set(manualFields.map(f => f.name));

  // 手動設定のフィールドを優先
  const result = [...manualFields];

  // 自動抽出されたフィールドで、手動設定にないものを追加
  autoFields.forEach(autoField => {
    if (!manualFieldNames.has(autoField.name)) {
      result.push(autoField);
    }
  });

  return result;
}

/**
 * form_configを自動生成（手動設定とマージ）
 */
export function generateFormConfig(
  nodes: Node[],
  existingFormConfig: { fields: FormFieldConfig[] } | null
): { fields: FormFieldConfig[] } | null {
  const autoFields = extractFormFieldsFromNodes(nodes);

  if (autoFields.length === 0 && !existingFormConfig) {
    return null;
  }

  const manualFields = existingFormConfig?.fields || [];
  const mergedFields = mergeFormFields(manualFields, autoFields);

  return mergedFields.length > 0 ? { fields: mergedFields } : null;
}
