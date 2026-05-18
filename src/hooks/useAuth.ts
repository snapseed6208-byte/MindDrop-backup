import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataUrlToBlob, blobToDataUrl, uniqueFileName } from '../lib/media';
import * as db from '../db';

export interface SyncProgress {
  current: number;
  total: number;
  phase: string; // e.g. "正在上传记录 3/10...", "正在上传图片...", "已完成"
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0, phase: '' });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    supabase!.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signup = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  // ─── Safe upload: per-record, per-file, with progress ───

  const uploadToCloud = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    if (!user) return '请先登录';

    setSyncing(true);
    setSyncMsg('');

    try {
      const records = await db.getAllRecords();
      if (records.length === 0) {
        setSyncing(false);
        return '本地没有记录可上传';
      }

      let successCount = 0;
      let failCount = 0;
      const failDetails: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        setSyncProgress({
          current: i + 1,
          total: records.length,
          phase: `正在处理记录 ${i + 1} / ${records.length}...`,
        });

        try {
          // 1. Upload images to Storage
          const imageRefs: { id: string; storagePath: string; createdAt: string }[] = [];
          const images = (r.images as string[]) || [];

          for (let j = 0; j < images.length; j++) {
            setSyncProgress({
              current: i + 1,
              total: records.length,
              phase: `上传图片 ${j + 1}/${images.length} (记录 ${i + 1}/${records.length})...`,
            });
            const imgId = uniqueFileName('jpg');
            const path = `users/${user.id}/records/${r.id}/images/${imgId}`;
            const blob = dataUrlToBlob(images[j]);
            const { error: uploadErr } = await supabase.storage
              .from('minddrop-media')
              .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
            if (uploadErr) throw new Error(`图片上传失败: ${uploadErr.message}`);
            imageRefs.push({ id: imgId.replace('.jpg', ''), storagePath: path, createdAt: new Date().toISOString() });
          }

          // 2. Upload audio notes to Storage
          const audioRefs: { id: string; storagePath: string; duration: number; createdAt: string }[] = [];
          const audioNotes = (r.audioNotes as any[]) || [];

          for (let j = 0; j < audioNotes.length; j++) {
            setSyncProgress({
              current: i + 1,
              total: records.length,
              phase: `上传录音 ${j + 1}/${audioNotes.length} (记录 ${i + 1}/${records.length})...`,
            });
            const audioId = uniqueFileName('webm');
            const path = `users/${user.id}/records/${r.id}/audios/${audioId}`;
            const blob = dataUrlToBlob(audioNotes[j].dataUrl);
            const { error: uploadErr } = await supabase.storage
              .from('minddrop-media')
              .upload(path, blob, { contentType: 'audio/webm', upsert: true });
            if (uploadErr) throw new Error(`录音上传失败: ${uploadErr.message}`);
            audioRefs.push({
              id: audioId.replace('.webm', ''),
              storagePath: path,
              duration: audioNotes[j].duration || 0,
              createdAt: audioNotes[j].createdAt || new Date().toISOString(),
            });
          }

          // 3. Write lightweight record_data to cloud_records
          setSyncProgress({
            current: i + 1,
            total: records.length,
            phase: `保存记录数据 ${i + 1}/${records.length}...`,
          });

          const lightRecord = {
            id: r.id,
            content: r.content,
            mood: r.mood,
            type: r.type,
            isVoiceNote: !!r.isVoiceNote,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            imageRefs,
            audioRefs,
          };

          const { error: dbErr } = await supabase
            .from('cloud_records')
            .upsert({
              id: r.id,
              user_id: user.id,
              record_data: lightRecord,
              created_at: r.createdAt,
              updated_at: r.updatedAt,
            }, { onConflict: 'id' });

          if (dbErr) throw new Error(`保存记录失败: ${dbErr.message}`);
          successCount++;

        } catch (err) {
          failCount++;
          const msg = (err as Error).message;
          failDetails.push(`记录 ${r.id?.slice(0, 8) || i + 1}: ${msg}`);
          // Continue to next record — local data unaffected
        }
      }

      setSyncProgress({ current: records.length, total: records.length, phase: '已完成' });
      const result = `✓ 上传完成：成功 ${successCount} 条${failCount ? `，失败 ${failCount} 条` : ''}` +
        (failDetails.length > 0 ? `\n${failDetails.slice(0, 3).join('\n')}${failDetails.length > 3 ? `\n...等 ${failDetails.length} 条失败` : ''}` : '');
      return result;

    } catch (err) {
      return `同步失败: ${(err as Error).message}`;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // ─── Safe restore: per-record, per-file, with progress ───

  const restoreFromCloud = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    if (!user) return '请先登录';

    setSyncing(true);
    setSyncMsg('');

    try {
      const { data, error } = await supabase
        .from('cloud_records')
        .select('record_data')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) {
        setSyncing(false);
        return `获取云端数据失败: ${error.message}`;
      }

      if (!data || data.length === 0) {
        setSyncing(false);
        return '云端没有记录';
      }

      let successCount = 0;
      let failCount = 0;
      const failDetails: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const light = data[i].record_data;
        if (!light || !light.id) { failCount++; continue; }

        setSyncProgress({
          current: i + 1,
          total: data.length,
          phase: `正在恢复记录 ${i + 1} / ${data.length}...`,
        });

        try {
          // Reconstruct the full MindDropRecord
          const fullRecord: any = {
            id: light.id,
            content: light.content || '',
            mood: light.mood || '',
            type: light.type || '',
            isVoiceNote: !!light.isVoiceNote,
            createdAt: light.createdAt,
            updatedAt: light.updatedAt,
            images: [] as string[],
            audioNotes: [] as any[],
          };

          // Download images from Storage
          const imageRefs: { id: string; storagePath: string }[] = light.imageRefs || [];
          for (let j = 0; j < imageRefs.length; j++) {
            setSyncProgress({
              current: i + 1,
              total: data.length,
              phase: `下载图片 ${j + 1}/${imageRefs.length} (记录 ${i + 1}/${data.length})...`,
            });
            try {
              const { data: blob, error: dlErr } = await supabase.storage
                .from('minddrop-media')
                .download(imageRefs[j].storagePath);
              if (dlErr || !blob) {
                failDetails.push(`记录 ${light.id.slice(0, 8)}: 图片 ${j + 1} 下载失败`);
                continue;
              }
              const dataUrl = await blobToDataUrl(blob);
              fullRecord.images.push(dataUrl);
            } catch {
              failDetails.push(`记录 ${light.id.slice(0, 8)}: 图片 ${j + 1} 下载异常`);
            }
          }

          // Download audio notes from Storage
          const audioRefs: { id: string; storagePath: string; duration: number; createdAt: string }[] = light.audioRefs || [];
          for (let j = 0; j < audioRefs.length; j++) {
            setSyncProgress({
              current: i + 1,
              total: data.length,
              phase: `下载录音 ${j + 1}/${audioRefs.length} (记录 ${i + 1}/${data.length})...`,
            });
            try {
              const { data: blob, error: dlErr } = await supabase.storage
                .from('minddrop-media')
                .download(audioRefs[j].storagePath);
              if (dlErr || !blob) {
                failDetails.push(`记录 ${light.id.slice(0, 8)}: 录音 ${j + 1} 下载失败`);
                continue;
              }
              const dataUrl = await blobToDataUrl(blob);
              fullRecord.audioNotes.push({
                id: audioRefs[j].id,
                dataUrl,
                duration: audioRefs[j].duration || 0,
                createdAt: audioRefs[j].createdAt,
              });
            } catch {
              failDetails.push(`记录 ${light.id.slice(0, 8)}: 录音 ${j + 1} 下载异常`);
            }
          }

          // Merge into IndexedDB
          await db.saveRecord(fullRecord);
          successCount++;

        } catch (err) {
          failCount++;
          failDetails.push(`记录 ${light.id?.slice(0, 8) || i + 1}: ${(err as Error).message}`);
        }
      }

      setSyncProgress({ current: data.length, total: data.length, phase: '已完成' });
      const result = `✓ 恢复完成：成功 ${successCount} 条${failCount ? `，失败 ${failCount} 条` : ''}` +
        (failDetails.length > 0 ? `\n${failDetails.slice(0, 3).join('\n')}${failDetails.length > 3 ? `\n...等 ${failDetails.length} 条失败` : ''}` : '');
      return result;

    } catch (err) {
      return `恢复失败: ${(err as Error).message}`;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  return {
    user,
    loading,
    configError,
    syncMsg,
    setSyncMsg,
    syncing,
    syncProgress,
    login,
    signup,
    logout,
    uploadToCloud,
    restoreFromCloud,
  };
}
