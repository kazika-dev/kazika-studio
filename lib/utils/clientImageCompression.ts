/**
 * クライアントサイド用画像圧縮ユーティリティ
 *
 * ブラウザのCanvas APIを使用して画像を圧縮します。
 * 複数の画像を合計4.5MB以下に収めます。
 */

interface ImageData {
  mimeType: string;
  data: string; // base64 encoded (data: prefix なし)
}

/**
 * base64文字列のバイトサイズを計算
 */
function getBase64Size(base64String: string): number {
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}

/**
 * 画像をCanvasでリサイズして圧縮
 */
async function resizeImage(
  base64Data: string,
  mimeType: string,
  targetSize: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const originalWidth = img.width;
      const originalHeight = img.height;

      // 元のサイズを計算
      const originalSize = getBase64Size(base64Data);

      // リサイズ比率を計算
      let ratio = Math.sqrt(targetSize / originalSize);
      ratio = Math.min(ratio, 1); // 拡大はしない

      // 新しいサイズを計算（最小256px）
      let newWidth = Math.max(256, Math.floor(originalWidth * ratio));
      let newHeight = Math.max(256, Math.floor(originalHeight * ratio));

      // アスペクト比を維持
      if (newWidth / newHeight !== originalWidth / originalHeight) {
        if (originalWidth > originalHeight) {
          newHeight = Math.floor(newWidth * (originalHeight / originalWidth));
        } else {
          newWidth = Math.floor(newHeight * (originalWidth / originalHeight));
        }
      }

      console.log(
        `Resizing: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`
      );

      // Canvasでリサイズ
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Data);
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // 品質を段階的に下げて目標サイズに近づける
      let quality = 0.85;
      let result = canvas.toDataURL('image/jpeg', quality);
      let resultData = result.split(',')[1];
      let currentSize = getBase64Size(resultData);

      while (currentSize > targetSize && quality > 0.2) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
        resultData = result.split(',')[1];
        currentSize = getBase64Size(resultData);
        console.log(
          `  Quality ${(quality * 100).toFixed(0)}%: ${(currentSize / 1024).toFixed(1)}KB`
        );
      }

      // さらにサイズが大きい場合は解像度を下げる
      let scaleDown = 1;
      while (currentSize > targetSize && scaleDown > 0.3) {
        scaleDown -= 0.1;
        const scaledWidth = Math.max(256, Math.floor(newWidth * scaleDown));
        const scaledHeight = Math.max(256, Math.floor(newHeight * scaleDown));

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        result = canvas.toDataURL('image/jpeg', 0.7);
        resultData = result.split(',')[1];
        currentSize = getBase64Size(resultData);
        console.log(
          `  Scale ${(scaleDown * 100).toFixed(0)}%: ${(currentSize / 1024).toFixed(1)}KB`
        );
      }

      resolve(resultData);
    };

    img.onerror = () => {
      console.error('Failed to load image for compression');
      resolve(base64Data);
    };

    // base64をdata URLに変換
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
}

/**
 * 複数の画像を合計サイズ以下に圧縮（クライアントサイド）
 *
 * @param images 画像データの配列
 * @param maxTotalSize 最大合計サイズ（バイト、デフォルト4.5MB）
 * @returns 圧縮された画像データの配列
 */
export async function compressImagesForApiClient(
  images: ImageData[],
  maxTotalSize: number = 4.5 * 1024 * 1024 // 4.5MB
): Promise<ImageData[]> {
  if (images.length === 0) {
    return images;
  }

  console.log('=== Client Image Compression Start ===');
  console.log(`Images count: ${images.length}`);
  console.log(`Max total size: ${(maxTotalSize / 1024 / 1024).toFixed(2)}MB`);

  // 各画像のサイズを計算
  const imageSizes = images.map((img) => ({
    original: img,
    size: getBase64Size(img.data),
  }));

  const currentTotalSize = imageSizes.reduce((sum, img) => sum + img.size, 0);
  console.log(
    `Current total size: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`
  );

  // 既に制限以下なら圧縮不要
  if (currentTotalSize <= maxTotalSize) {
    console.log('✓ No compression needed');
    console.log('=== Client Image Compression End ===');
    return images;
  }

  // 各画像の目標サイズを計算（均等に縮小）
  const targetSizePerImage = Math.floor(maxTotalSize / images.length);
  console.log(
    `Target size per image: ${(targetSizePerImage / 1024).toFixed(1)}KB`
  );

  // 各画像を圧縮
  const compressedImages: ImageData[] = [];

  for (let i = 0; i < imageSizes.length; i++) {
    const { original, size } = imageSizes[i];

    console.log(`\nProcessing image ${i + 1}/${images.length}`);
    console.log(`  Original size: ${(size / 1024).toFixed(1)}KB`);
    console.log(`  Target size: ${(targetSizePerImage / 1024).toFixed(1)}KB`);

    if (size <= targetSizePerImage) {
      console.log(`  ✓ Already within target size`);
      compressedImages.push(original);
    } else {
      console.log(`  ⚙ Compressing...`);
      const resizedData = await resizeImage(
        original.data,
        original.mimeType,
        targetSizePerImage
      );

      const newSize = getBase64Size(resizedData);
      console.log(
        `  ✓ Compressed to ${(newSize / 1024).toFixed(1)}KB (${((1 - newSize / size) * 100).toFixed(1)}% reduction)`
      );

      compressedImages.push({
        mimeType: 'image/jpeg', // 圧縮後はJPEGに統一
        data: resizedData,
      });
    }
  }

  // 最終的な合計サイズを確認
  const finalTotalSize = compressedImages.reduce(
    (sum, img) => sum + getBase64Size(img.data),
    0
  );

  console.log('\n=== Compression Summary ===');
  console.log(`Original total: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Final total: ${(finalTotalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Reduction: ${((1 - finalTotalSize / currentTotalSize) * 100).toFixed(1)}%`);
  console.log(`Within limit: ${finalTotalSize <= maxTotalSize ? '✓ Yes' : '✗ No'}`);
  console.log('=== Client Image Compression End ===\n');

  return compressedImages;
}

/**
 * 画像配列の合計サイズを取得（KB）
 */
export function getTotalImageSizeKB(images: ImageData[]): number {
  return images.reduce((sum, img) => sum + getBase64Size(img.data), 0) / 1024;
}
