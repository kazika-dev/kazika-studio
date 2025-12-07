/**
 * 画像圧縮ユーティリティ
 *
 * 複数の画像をAPI送信時に合計5MB以下に収まるように自動縮小します。
 */

interface ImageData {
  mimeType: string;
  data: string; // base64 encoded
}

/**
 * base64文字列のバイトサイズを計算
 */
function getBase64Size(base64String: string): number {
  // base64は4文字で3バイトを表現するため、正確なサイズを計算
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}

/**
 * 画像のbase64データをリサイズ（Sharp使用）
 */
async function resizeImageBase64(
  base64Data: string,
  mimeType: string,
  targetSize: number
): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;

    // base64をBufferに変換
    const buffer = Buffer.from(base64Data, 'base64');

    // 画像メタデータを取得
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width || 1024;
    const originalHeight = metadata.height || 1024;

    // リサイズ比率を計算（targetSizeは目標バイト数）
    const originalSize = buffer.length;
    const ratio = Math.sqrt(targetSize / originalSize);

    // 最小でも256pxは維持
    const newWidth = Math.max(256, Math.floor(originalWidth * ratio));
    const newHeight = Math.max(256, Math.floor(originalHeight * ratio));

    console.log(`Resizing image: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight} (ratio: ${ratio.toFixed(2)})`);

    // 画像をリサイズ
    let resizedBuffer = await sharp(buffer)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    // JPEG品質を段階的に下げて目標サイズに近づける
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      let quality = 85;
      while (resizedBuffer.length > targetSize && quality > 20) {
        quality -= 5;
        resizedBuffer = await sharp(buffer)
          .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();
        console.log(`  Adjusted JPEG quality to ${quality}, size: ${(resizedBuffer.length / 1024).toFixed(1)}KB`);
      }
    } else if (mimeType === 'image/png') {
      // PNGは圧縮レベルを調整
      let compressionLevel = 6;
      while (resizedBuffer.length > targetSize && compressionLevel < 9) {
        compressionLevel++;
        resizedBuffer = await sharp(buffer)
          .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel })
          .toBuffer();
        console.log(`  Adjusted PNG compression to ${compressionLevel}, size: ${(resizedBuffer.length / 1024).toFixed(1)}KB`);
      }
    }

    // base64に戻す
    return resizedBuffer.toString('base64');
  } catch (error) {
    console.error('Failed to resize image:', error);
    // リサイズ失敗時は元のデータを返す
    return base64Data;
  }
}

/**
 * 複数の画像を合計5MB以下に圧縮
 *
 * @param images 画像データの配列
 * @param maxTotalSize 最大合計サイズ（バイト、デフォルト5MB）
 * @returns 圧縮された画像データの配列
 */
export async function compressImagesForApi(
  images: ImageData[],
  maxTotalSize: number = 5 * 1024 * 1024 // 5MB
): Promise<ImageData[]> {
  if (images.length === 0) {
    return images;
  }

  console.log('=== Image Compression Start ===');
  console.log(`Images count: ${images.length}`);
  console.log(`Max total size: ${(maxTotalSize / 1024 / 1024).toFixed(2)}MB`);

  // 各画像のサイズを計算
  const imageSizes = images.map(img => ({
    original: img,
    size: getBase64Size(img.data),
  }));

  const currentTotalSize = imageSizes.reduce((sum, img) => sum + img.size, 0);
  console.log(`Current total size: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB`);

  // 既に5MB以下なら圧縮不要
  if (currentTotalSize <= maxTotalSize) {
    console.log('✓ No compression needed');
    console.log('=== Image Compression End ===');
    return images;
  }

  // 各画像の目標サイズを計算（均等に縮小）
  const targetSizePerImage = Math.floor(maxTotalSize / images.length);
  console.log(`Target size per image: ${(targetSizePerImage / 1024).toFixed(1)}KB`);

  // 各画像を圧縮
  const compressedImages: ImageData[] = [];

  for (let i = 0; i < imageSizes.length; i++) {
    const { original, size } = imageSizes[i];

    console.log(`\nProcessing image ${i + 1}/${images.length}`);
    console.log(`  Original size: ${(size / 1024).toFixed(1)}KB`);
    console.log(`  Target size: ${(targetSizePerImage / 1024).toFixed(1)}KB`);

    if (size <= targetSizePerImage) {
      // 既に目標サイズ以下なら圧縮不要
      console.log(`  ✓ Already within target size`);
      compressedImages.push(original);
    } else {
      // リサイズが必要
      console.log(`  ⚙ Resizing...`);
      const resizedData = await resizeImageBase64(
        original.data,
        original.mimeType,
        targetSizePerImage
      );

      const newSize = getBase64Size(resizedData);
      console.log(`  ✓ Resized to ${(newSize / 1024).toFixed(1)}KB (${((1 - newSize / size) * 100).toFixed(1)}% reduction)`);

      compressedImages.push({
        mimeType: original.mimeType,
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
  console.log('=== Image Compression End ===\n');

  return compressedImages;
}

/**
 * 画像配列の合計サイズを取得（デバッグ用）
 */
export function getTotalImageSize(images: ImageData[]): number {
  return images.reduce((sum, img) => sum + getBase64Size(img.data), 0);
}
