// 設定を読み込み
chrome.storage.local.get(['apiUrl', 'apiKey'], (result) => {
  if (result.apiUrl) {
    document.getElementById('apiUrl').value = result.apiUrl;
  }
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
});

// 設定を保存
document.getElementById('saveSettings').addEventListener('click', () => {
  const apiUrl = document.getElementById('apiUrl').value;
  const apiKey = document.getElementById('apiKey').value;

  if (!apiUrl || !apiKey) {
    showMessage('API URL と API Key を入力してください', 'error');
    return;
  }

  chrome.storage.local.set({ apiUrl, apiKey }, () => {
    showMessage('設定を保存しました', 'success');
  });
});

// ワークフロー一覧を取得
document.getElementById('fetchWorkflows').addEventListener('click', async () => {
  const apiUrl = document.getElementById('apiUrl').value;
  const apiKey = document.getElementById('apiKey').value;

  if (!apiUrl || !apiKey) {
    showMessage('API URL と API Key を設定してください', 'error');
    return;
  }

  try {
    showMessage('取得中...', 'info');
    document.getElementById('result').style.display = 'none';

    const response = await fetch(`${apiUrl}/api/workflows`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    // 結果を表示
    document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    document.getElementById('result').style.display = 'block';
    showMessage(`✓ ${data.workflows?.length || 0} 件のワークフローを取得しました`, 'success');
  } catch (error) {
    showMessage(`エラー: ${error.message}`, 'error');
    console.error('API Error:', error);
  }
});

// メッセージを表示
function showMessage(message, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = message;
  messageEl.className = type;
}
