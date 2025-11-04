'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function NewCharacterSheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '画像のアップロードに失敗しました');
    }

    return data.storagePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('キャラクター名を入力してください');
      return;
    }

    if (!imageFile) {
      toast.error('画像を選択してください');
      return;
    }

    try {
      setLoading(true);
      setUploading(true);

      // 画像をアップロード
      const imageUrl = await uploadImage(imageFile);
      setUploading(false);

      // キャラクターシートを作成
      const response = await fetch('/api/character-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          image_url: imageUrl,
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('キャラクターシートを作成しました');
        router.push('/character-sheets');
      } else {
        toast.error(data.error || 'キャラクターシートの作成に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to create character sheet:', error);
      toast.error(error.message || 'キャラクターシートの作成に失敗しました');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        戻る
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>キャラクターシート新規作成</CardTitle>
          <CardDescription>
            キャラクターシート画像を登録します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">キャラクター名 *</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="キャラクター名を入力"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明（任意）</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="キャラクターの説明を入力"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">画像 *</Label>
              <div className="border-2 border-dashed rounded-lg p-6">
                {imagePreview ? (
                  <div className="space-y-4">
                    <div className="relative aspect-[3/4] w-full max-w-md mx-auto">
                      <Image
                        src={imagePreview}
                        alt="プレビュー"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      disabled={loading}
                      className="w-full"
                    >
                      画像を変更
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4">
                      <Label
                        htmlFor="image"
                        className="cursor-pointer text-primary hover:underline"
                      >
                        画像を選択
                      </Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={loading}
                        className="sr-only"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      PNG, JPG, GIF (最大10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    画像をアップロード中...
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    作成中...
                  </>
                ) : (
                  '作成'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
