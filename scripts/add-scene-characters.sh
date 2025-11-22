#!/bin/bash

# シーンID（例：1）
SCENE_ID=1

# キャラクターIDを配列で定義
CHARACTER_IDS=(12 13 14)

# 各キャラクターをシーンに追加
for CHAR_ID in "${CHARACTER_IDS[@]}"; do
  echo "Adding character $CHAR_ID to scene $SCENE_ID..."

  curl -X POST "http://localhost:3000/api/scenes/${SCENE_ID}/characters" \
    -H "Content-Type: application/json" \
    -d "{\"characterId\": $CHAR_ID}"

  echo ""
done

echo "Done! All characters added to scene $SCENE_ID"
