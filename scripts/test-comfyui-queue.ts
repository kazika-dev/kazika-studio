import { config } from 'dotenv';
import { createComfyUIQueueItem, getComfyUIQueueItemById } from '../lib/db';

// Load environment variables
config({ path: '.env.local' });

async function test() {
  try {
    console.log('Creating test ComfyUI queue item...');

    const testWorkflowJson = {
      "1": {
        "inputs": {
          "text": "test prompt"
        },
        "class_type": "CLIPTextEncode"
      }
    };

    const queueItem = await createComfyUIQueueItem({
      user_id: 'test-user-123',
      comfyui_workflow_name: 'test-workflow',
      workflow_json: testWorkflowJson,
      prompt: 'Test prompt',
      img_gcp_storage_paths: ['test/path/image1.png', 'test/path/image2.png'],
      priority: 5,
      metadata: { test: true, source: 'test-script' }
    });

    console.log('✓ Queue item created successfully!');
    console.log('Queue item ID:', queueItem.id);
    console.log('Status:', queueItem.status);
    console.log('Workflow name:', queueItem.comfyui_workflow_name);
    console.log('Priority:', queueItem.priority);

    // Retrieve it back
    console.log('\nRetrieving queue item...');
    const retrieved = await getComfyUIQueueItemById(queueItem.id);

    if (retrieved) {
      console.log('✓ Queue item retrieved successfully!');
      console.log('Workflow JSON:', JSON.stringify(retrieved.workflow_json, null, 2));
      console.log('Image paths:', retrieved.img_gcp_storage_paths);
      console.log('Metadata:', retrieved.metadata);
    } else {
      console.error('✗ Failed to retrieve queue item');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Test failed:', error);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

test();
