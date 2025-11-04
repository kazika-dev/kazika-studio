'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

export default function CharacterSheetsPage() {
  const router = useRouter();
  const [characterSheets, setCharacterSheets] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CharacterSheet | null>(null);

  useEffect(() => {
    loadCharacterSheets();
  }, []);

  const loadCharacterSheets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/character-sheets');
      const data = await response.json();

      if (data.success) {
        setCharacterSheets(data.characterSheets);
      } else {
        toast.error('キャラクターシートの取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to load character sheets:', error);
      toast.error('キャラクターシートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSheet) return;

    try {
      const response = await fetch(`/api/character-sheets/${selectedSheet.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('キャラクターシートを削除しました');
        loadCharacterSheets();
      } else {
        toast.error('キャラクターシートの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete character sheet:', error);
      toast.error('キャラクターシートの削除に失敗しました');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedSheet(null);
    }
  };

  const handleNewSheet = () => {
    router.push('/character-sheets/new');
  };

  const handleEdit = (sheet: CharacterSheet) => {
    router.push(`/character-sheets/${sheet.id}/edit`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">キャラクターシート</h1>
          <p className="text-muted-foreground mt-2">
            キャラクターシート画像を管理します
          </p>
        </div>
        <Button onClick={handleNewSheet}>
          <PlusCircle className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {characterSheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">
              キャラクターシートがまだありません
            </p>
            <Button onClick={handleNewSheet}>
              <PlusCircle className="mr-2 h-4 w-4" />
              最初のキャラクターシートを作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characterSheets.map((sheet) => (
            <Card key={sheet.id} className="overflow-hidden">
              <div className="relative aspect-[3/4] w-full">
                <Image
                  src={sheet.image_url}
                  alt={sheet.name}
                  fill
                  className="object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle>{sheet.name}</CardTitle>
                {sheet.description && (
                  <CardDescription>{sheet.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(sheet)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    編集
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedSheet(sheet);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    削除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>キャラクターシートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。キャラクターシート「{selectedSheet?.name}」を削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
