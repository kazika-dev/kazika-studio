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
          required: true,
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
          required: true,
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
      const fieldName = `nanobana_prompt_${node.id}`;
      if (!addedFieldNames.has(fieldName)) {
        fields.push({
          type: 'textarea',
          name: fieldName,
          label: `${nodeName} プロンプト`,
          placeholder: node.data.config?.prompt || '画像生成の指示を入力',
          required: false,
          rows: 4,
          helperText: `${nodeName}で使用するプロンプト`,
        });
        addedFieldNames.add(fieldName);
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
