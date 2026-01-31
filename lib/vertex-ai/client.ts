/**
 * Vertex AI client initialization
 * Uses existing GCP_SERVICE_ACCOUNT_KEY for authentication
 */

import { createVertex, type GoogleVertexProvider } from '@ai-sdk/google-vertex';

// Lazy initialization to avoid loading credentials on import
let vertexClient: GoogleVertexProvider | null = null;

/**
 * Get GCP credentials from environment variable
 */
function getGcpCredentials(): {
  projectId: string;
  credentials: Record<string, unknown>;
} {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY is not configured');
  }

  try {
    const credentials = JSON.parse(keyJson);
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id;

    if (!projectId) {
      throw new Error('Project ID not found in GCP_SERVICE_ACCOUNT_KEY or GOOGLE_CLOUD_PROJECT');
    }

    return { projectId, credentials };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON in GCP_SERVICE_ACCOUNT_KEY');
    }
    throw error;
  }
}

/**
 * Get the location for Vertex AI
 */
function getLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || 'asia-northeast1';
}

/**
 * Get Vertex AI client for Gemini models
 */
export function getVertexClient(): GoogleVertexProvider {
  if (!vertexClient) {
    const { projectId, credentials } = getGcpCredentials();
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
 * Check if Vertex AI is configured
 */
export function isVertexAIConfigured(): boolean {
  try {
    getGcpCredentials();
    return true;
  } catch {
    return false;
  }
}
