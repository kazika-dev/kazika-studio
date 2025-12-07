// バックグラウンドスクリプト
// 必要に応じて API 呼び出しをバックグラウンドで実行できます

chrome.runtime.onInstalled.addListener(() => {
  console.log('Kazika Studio API Client installed');
});

// メッセージリスナー（popup.js から呼び出される場合）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchWorkflows') {
    fetchWorkflowsInBackground(request.apiUrl, request.apiKey)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // 非同期応答を有効化
  }
});

// バックグラウンドで API を呼び出す例
async function fetchWorkflowsInBackground(apiUrl, apiKey) {
  try {
    const response = await fetch(`${apiUrl}/api/workflows`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Background API Error:', error);
    throw error;
  }
}
