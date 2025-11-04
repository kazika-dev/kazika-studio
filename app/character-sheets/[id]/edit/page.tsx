'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface CharacterSheet {
  id: number;
  user_id: string;
  name: string;
  image_url: string;
  description: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export default function EditCharacterSheetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [characterSheet, setCharacterSheet] = useState<CharacterSheet | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    loadCharacterSheet();
  }, [id]);

  const loadCharacterSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/character-sheets/${id}`);
      const data = await response.json();

      if (data.success) {
        setCharacterSheet(data.characterSheet);
        setName(data.characterSheet.name);
        setDescription(data.characterSheet.description || '');
        setImagePreview(data.characterSheet.image_url);
      } else {
        toast.error('キャラクターシートの取得に失敗しました');
        router.push('/character-sheets');
      }
    } catch (error) {
      console.error('Failed to load character sheet:', error);
      toast.error('キャラクターシートの取得に失敗しました');
      router.push('/character-sheets');
    } finally {
      setLoading(false);
    }
  };

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

    try {
      setSaving(true);

      let imageUrl = characterSheet?.image_url;

      // 画像が変更された場合はアップロード
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
        setUploading(false);
      }

      // キャラクターシートを更新
      const response = await fetch(`/api/character-sheets/${id}`, {
        method: 'PATCH',
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
        toast.success('キャラクターシートを更新しました');
        router.push('/character-sheets');
      } else {
        toast.error(data.error || 'キャラクターシートの更新に失敗しました');
      }
    } catch (error: any) {
      console.error('Failed to update character sheet:', error);
      toast.error(error.message || 'キャラクターシートの更新に失敗しました');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      </div>
    );
  }

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
          <CardTitle>キャラクターシート編集</CardTitle>
          <CardDescription>
            キャラクターシート情報を編集します
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
                disabled={saving}
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
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">画像</Label>
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
                        const input = document.getElementById('image') as HTMLInputElement;
                        input?.click();
                      }}
                      disabled={saving}
                      className="w-full"
                    >
                      画像を変更
                    </Button>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={saving}
                      className="sr-only"
                    />
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
                        disabled={saving}
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
                disabled={saving}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    画像をアップロード中...
                  </>
                ) : saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '更新'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
