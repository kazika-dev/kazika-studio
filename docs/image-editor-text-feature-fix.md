# Canvas画像エディタのテキスト機能修正

## 概要

`/components/outputs/ImageEditor.tsx` のテキスト挿入機能において、以下の問題を修正しました：

1. クリック位置とテキストの描画位置がずれる問題
2. 前回クリックした位置に文字が挿入される問題
3. テキスト確定後に即座に描画されない問題
4. Undoボタンで履歴と描画がずれる問題

## 修正前の問題

### 1. テキスト位置のずれ

**問題**: テキストモードでクリックした位置に対して、確定後のテキストが上側にずれて表示される。

**原因**: Canvas の `fillText()` メソッドは、y座標を**テキストのベースライン**（文字の下側）として扱うため、クリック位置とテキストの見た目の位置がずれていた。

### 2. 前回の位置に挿入される問題

**問題**: テキスト入力中に別の位置をクリックすると、前回クリックした位置にテキストが挿入される。

**原因**: `handleConfirmText()` を呼び出していたが、React の状態更新は非同期のため、`textPosition` の状態が更新される前に古い値が使われていた。

### 3. 即座に描画されない問題

**問題**: テキストを確定しても、他の部分をクリックするまでCanvas上に表示されない。特に最初のテキストで顕著。

**原因**:
```typescript
// 修正前のコード
setHistory([...history, textPath]);
setTimeout(() => redrawCanvas(), 0);
```

`setHistory` は非同期で状態を更新するため、`redrawCanvas()` が実行される時点では `history` に新しいテキストが含まれていなかった。

### 4. Undoで履歴がずれる問題

**問題**: Undoボタンを押すと、最後に書き込んだものが1つだけ残り、他の操作を行うと消える。履歴上は削除されているが、Canvas上に残っている。

**原因**:
```typescript
// 修正前のコード
redrawCanvas();  // 古い history を使って描画
drawPath(ctx, textPath);  // 新しいテキストを追加で描画
```

Canvas上には新しいテキストが描画されているが、`history` 状態には含まれていない（非同期更新のため）。その結果、Undoすると Canvas と履歴が不一致になっていた。

## 修正内容

### 1. テキスト位置の調整（520-521行目）

**修正**: y座標にフォントサイズ分を加算して、ベースラインを調整。

```typescript
points: [{
  x: textPosition.canvasX,
  y: textPosition.canvasY + textConfig.fontSize  // フォントサイズ分だけ下げる（ベースライン調整）
}],
```

これにより、クリックした位置がテキストの**上端**になり、入力フィールドの表示位置と確定後の位置が一致する。

### 2. テキスト位置の即時更新（291-327行目）

**修正**: `handleConfirmText()` を呼ばずに、同じ処理を直接実行することで、現在の `textPosition` を確実に使用。

```typescript
if (isEditingText && textInput.trim() && textPosition) {
  // 古いテキストを確定（現在の textPosition を使用）
  const oldTextPath: DrawingPath = {
    mode: 'text',
    color: color,
    // ... 省略 ...
    points: [{
      x: textPosition.canvasX,
      y: textPosition.canvasY + textConfig.fontSize
    }],
    text: textInput,
    // ... 省略 ...
  };

  // historyを更新
  const newHistory = [...history, oldTextPath];
  setHistory(newHistory);

  // 即座にCanvasに描画（後述）
  // ...

  // 状態をクリア
  setTextInput('');
}

// 新しい位置を設定
setTextPosition({
  x: e.clientX,
  y: e.clientY,
  canvasX: x,
  canvasY: y,
});
```

### 3. 即座の描画処理（312-323行目、533-545行目、731-740行目）

**修正**: 新しい履歴配列（`newHistory`）を作成し、それを使って即座に Canvas に描画することで、状態更新を待たずに反映。

```typescript
// historyを更新
const newHistory = [...history, oldTextPath];
setHistory(newHistory);

// 即座にCanvasに描画（新しい履歴を使って完全に再描画）
const ctx = canvas.getContext('2d');
if (ctx && imageRef.current) {
  // 画像をクリアして再描画
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageRef.current, 0, 0);

  // 新しい履歴を含めてすべてのパスを再描画
  newHistory.forEach(path => {
    drawPath(ctx, path);
  });
}
```

**ポイント**:
- `newHistory` という新しい配列を作成し、それを使って描画
- `redrawCanvas()` と `drawPath()` を分けずに、完全に再描画
- これにより、Canvas の描画内容と `history` 状態が常に一致

### 4. Undo機能の修正（731-740行目）

**修正**: Undo時も同様に、新しい履歴配列を使って即座に再描画。

```typescript
// 描画履歴がある場合は、パスを削除
if (history.length === 0) return;
const newHistory = history.slice(0, -1);
setHistory(newHistory);

// 即座にCanvasに再描画（新しい履歴を使って）
if (imageRef.current) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageRef.current, 0, 0);

  // 新しい履歴を使ってすべてのパスを再描画
  newHistory.forEach(path => {
    drawPath(ctx, path);
  });
}
```

## 技術的詳細

### React の非同期状態更新について

React の `setState` は非同期で実行されるため、以下のコードは期待通りに動作しない：

```typescript
// ❌ 動作しない例
setHistory([...history, newItem]);
redrawCanvas();  // この時点では history はまだ更新されていない
```

**解決方法**: 新しい配列を作成し、それを使って即座に処理する：

```typescript
// ✅ 正しい例
const newHistory = [...history, newItem];
setHistory(newHistory);
// newHistory を使って即座に処理
newHistory.forEach(item => processItem(item));
```

### Canvas の fillText() とベースライン

Canvas の `fillText(text, x, y)` メソッドは、y座標を**テキストのベースライン**として扱います。

```
       ← テキストの上端
  あいう  ← 見た目の位置
-------  ← y座標（ベースライン）
    ↓
```

そのため、クリック位置を基準にテキストを配置するには、フォントサイズ分を加算する必要があります：

```typescript
y: clickY + fontSize  // ベースライン調整
```

## 影響範囲

- テキストモードでクリックした位置に正確にテキストが配置される
- テキスト入力中に別の位置をクリックすると、既存のテキストが確定され、新しい位置に入力フィールドが移動する
- テキストを確定すると、即座に Canvas 上に表示される（他の操作を待つ必要がない）
- Undo ボタンを押すと、正確に1つずつ履歴が戻る（Canvas と履歴の不一致がない）

## 修正ファイル

- `/components/outputs/ImageEditor.tsx` (291-327行目、533-545行目、731-740行目)

## 参考情報

- Canvas API: `fillText()` - https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText
- React State Updates: 非同期更新の仕組み - https://react.dev/learn/state-as-a-snapshot
