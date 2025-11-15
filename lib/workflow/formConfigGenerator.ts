import { Node } from 'reactflow';
import { FormFieldConfig } from '@/components/form/DynamicFormField';

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
        });
        addedFieldNames.add(voiceIdFieldName);
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
