/**
 * Vertex AI client initialization
 * Supports both API Key (VERTEX_API_KEY) and Service Account (GCP_SERVICE_ACCOUNT_KEY) authentication
 */

import { createVertex, type GoogleVertexProvider } from '@ai-sdk/google-vertex';

// Lazy initialization to avoid loading credentials on import
let vertexClient: GoogleVertexProvider | null = null;

/**
 * Get Vertex AI API Key from environment variable
 */
export function getVertexApiKey(): string | null {
  return process.env.VERTEX_API_KEY || null;
}

/**
 * Get GCP credentials from environment variable (for service account auth)
 */
function getGcpCredentials(): {
  projectId: string;
  credentials: Record<string, unknown>;
} | null {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    return null;
  }

  try {
    const credentials = JSON.parse(keyJson);
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id;

    if (!projectId) {
      return null;
    }

    return { projectId, credentials };
  } catch {
    return null;
  }
}

/**
 * Get the location for Vertex AI
 */
function getLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
}

/**
 * Get Vertex AI client for Gemini models (service account auth)
 */
export function getVertexClient(): GoogleVertexProvider | null {
  if (!vertexClient) {
    const gcpCreds = getGcpCredentials();
    if (!gcpCreds) {
      return null;
    }

    const { projectId, credentials } = gcpCreds;
    const location = getLocation();

    console.log(`[Vertex AI] Initializing Gemini client for project: ${projectId}, location: ${location}`);

    vertexClient = createVertex({
      project: projectId,
      location,
      googleAuthOptions: {
        credentials: credentials as Record<string, string>,
      },
    });
  }
  return vertexClient;
}

/**
 * Check if Vertex AI is configured (either API Key or Service Account)
 */
export function isVertexAIConfigured(): boolean {
  return !!getVertexApiKey() || !!getGcpCredentials();
}

/**
 * Check authentication method
 */
export function getVertexAuthMethod(): 'api-key' | 'service-account' | null {
  if (getVertexApiKey()) {
    return 'api-key';
  }
  if (getGcpCredentials()) {
    return 'service-account';
  }
  return null;
}

/**
 * Call Vertex AI REST API with API Key authentication
 */
export async function callVertexAIWithApiKey(
  model: string,
  prompt: string,
  images?: { mimeType: string; data: string }[]
): Promise<string> {
  const apiKey = getVertexApiKey();
  if (!apiKey) {
    throw new Error('VERTEX_API_KEY is not configured');
  }

  // Build request body
  const parts: any[] = [{ text: prompt }];

  // Add images if provided
  if (images && images.length > 0) {
    for (const img of images.slice(0, 4)) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data,
        },
      });
    }
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
  };

  // Vertex AI REST API endpoint
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`;

  console.log(`[Vertex AI] Calling REST API with model: ${model}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Vertex AI] API error: ${response.status} - ${errorText}`);
    throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Extract text from response
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from Vertex AI');
  }

  const content = candidates[0].content;
  if (!content || !content.parts || content.parts.length === 0) {
    throw new Error('Empty response from Vertex AI');
  }

  const text = content.parts
    .filter((part: any) => part.text)
    .map((part: any) => part.text)
    .join('');

  return text;
}
