import { Node } from 'reactflow';
import { FormFieldConfig } from '@/components/form/DynamicFormField';
import { ELEVENLABS_PRESET_VOICES, ELEVENLABS_MODEL_OPTIONS } from '@/lib/elevenlabs/constants';

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
            options: ELEVENLABS_MODEL_OPTIONS,
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

    // Geminiノード - getNodeTypeConfig()から設定を取得して使用
    if (nodeType === 'gemini') {
      const nodeConfig = getNodeTypeConfig('gemini');

      nodeConfig.fields.forEach((field) => {
        const fieldName = `gemini_${field.name}_${node.id}`;

        if (!addedFieldNames.has(fieldName)) {
          fields.push({
            ...field,
            name: fieldName,
            label: `${nodeName} ${field.label}`,
            placeholder: node.data.config?.[field.name] || field.placeholder,
            helperText: field.helperText,
          });
          addedFieldNames.add(fieldName);
        }
      });
    }

    // Nanobanaノード - getNodeTypeConfig()から設定を取得
    if (nodeType === 'nanobana') {
      const nodeConfig = getNodeTypeConfig('nanobana');

      nodeConfig.fields.forEach((field) => {
        const fieldName = `nanobana_${field.name}_${node.id}`;

        if (!addedFieldNames.has(fieldName)) {
          fields.push({
            ...field,
            name: fieldName,
            label: `${nodeName} ${field.label}`,
            placeholder: node.data.config?.[field.name] || field.placeholder,
            helperText: field.helperText,
          });
          addedFieldNames.add(fieldName);
        }
      });

      // 参照画像アップロード（最大4つ） - 特別な処理が必要なため個別に追加
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

    // Higgsfieldノード - getNodeTypeConfig()から設定を取得
    if (nodeType === 'higgsfield') {
      const nodeConfig = getNodeTypeConfig('higgsfield');

      nodeConfig.fields.forEach((field) => {
        const fieldName = `higgsfield_${field.name}_${node.id}`;

        if (!addedFieldNames.has(fieldName)) {
          fields.push({
            ...field,
            name: fieldName,
            label: `${nodeName} ${field.label}`,
            placeholder: node.data.config?.[field.name] || field.placeholder,
            helperText: field.helperText,
          });
          addedFieldNames.add(fieldName);
        }
      });
    }

    // Seedream4ノード - プロンプトのみ（まだgetNodeTypeConfigに定義がない場合）
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

    // ElevenLabsノード - getNodeTypeConfig()から設定を取得して使用
    if (nodeType === 'elevenlabs') {
      const nodeConfig = getNodeTypeConfig('elevenlabs');

      nodeConfig.fields.forEach((field) => {
        const fieldName = `elevenlabs_${field.name}_${node.id}`;

        if (!addedFieldNames.has(fieldName)) {
          fields.push({
            ...field,
            name: fieldName,
            label: `${nodeName} ${field.label}`,
            placeholder: node.data.config?.[field.name] || field.placeholder,
            helperText: field.helperText,
          });
          addedFieldNames.add(fieldName);
        }
      });
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
