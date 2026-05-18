import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataUrlToBlob, blobToDataUrl, uniqueFileName } from '../lib/media';
import * as db from '../db';

export interface SyncProgress {
  current: number;
  total: number;
  phase: string;
}

function shortId(id: string): string {
  return id ? id.slice(0, 8) : '???';
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

  const uploadToCloud = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    if (!user) return '请先登录';

    setSyncing(true);
    setSyncMsg('');
    setSyncProgress({ current: 0, total: 0, phase: '读取本地记录...' });

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
        const rid = shortId(r.id);
        setSyncProgress({
          current: i + 1,
          total: records.length,
          phase: `[${rid}] 正在处理记录 ${i + 1} / ${records.length}...`,
        });

        const imageRefs: { id: string; storagePath: string; createdAt: string }[] = [];
        const audioRefs: { id: string; storagePath: string; duration: number; createdAt: string }[] = [];

        let recordFailed = false;

        // 1. Upload images to Storage
        const images = (r.images as string[]) || [];
        for (let j = 0; j < images.length; j++) {
          const imgId = uniqueFileName('jpg');
          const path = `users/${user.id}/records/${r.id}/images/${imgId}`;
          setSyncProgress({
            current: i + 1,
            total: records.length,
            phase: `[${rid}] 上传图片 ${j + 1}/${images.length}...`,
          });
          try {
            const blob = dataUrlToBlob(images[j]);
            const { error: uploadErr } = await supabase.storage
              .from('minddrop-media')
              .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
            if (uploadErr) {
              const msg = `[${rid}] 图片上传失败: ${path} — ${uploadErr.message}`;
              console.error('Image upload error:', { recordId: r.id, storagePath: path, error: uploadErr });
              failDetails.push(msg);
              recordFailed = true;
            } else {
              imageRefs.push({ id: imgId.replace('.jpg', ''), storagePath: path, createdAt: new Date().toISOString() });
            }
          } catch (err) {
            const msg = `[${rid}] 图片上传异常: ${path} — ${(err as Error).message}`;
            console.error('Image upload exception:', { recordId: r.id, storagePath: path, error: err });
            failDetails.push(msg);
            recordFailed = true;
          }
        }

        // 2. Upload audio notes to Storage
        const audioNotes = (r.audioNotes as any[]) || [];
        for (let j = 0; j < audioNotes.length; j++) {
          const audioId = uniqueFileName('webm');
          const path = `users/${user.id}/records/${r.id}/audios/${audioId}`;
          setSyncProgress({
            current: i + 1,
            total: records.length,
            phase: `[${rid}] 上传录音 ${j + 1}/${audioNotes.length}...`,
          });
          try {
            const blob = dataUrlToBlob(audioNotes[j].dataUrl);
            const { error: uploadErr } = await supabase.storage
              .from('minddrop-media')
              .upload(path, blob, { contentType: 'audio/webm', upsert: true });
            if (uploadErr) {
              const msg = `[${rid}] 录音上传失败: ${path} — ${uploadErr.message}`;
              console.error('Audio upload error:', { recordId: r.id, storagePath: path, error: uploadErr });
              failDetails.push(msg);
              recordFailed = true;
            } else {
              audioRefs.push({
                id: audioId.replace('.webm', ''),
                storagePath: path,
                duration: audioNotes[j].duration || 0,
                createdAt: audioNotes[j].createdAt || new Date().toISOString(),
              });
            }
          } catch (err) {
            const msg = `[${rid}] 录音上传异常: ${path} — ${(err as Error).message}`;
            console.error('Audio upload exception:', { recordId: r.id, storagePath: path, error: err });
            failDetails.push(msg);
            recordFailed = true;
          }
        }

        // 3. Write lightweight record_data to cloud_records
        setSyncProgress({
          current: i + 1,
          total: records.length,
          phase: `[${rid}] 保存记录数据 ${i + 1}/${records.length}...`,
        });

        try {
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

          if (dbErr) {
            const msg = `[${rid}] 记录写入失败: ${dbErr.message}`;
            console.error('DB upsert error:', { recordId: r.id, error: dbErr });
            failDetails.push(msg);
            recordFailed = true;
          }
        } catch (err) {
          const msg = `[${rid}] 记录写入异常: ${(err as Error).message}`;
          console.error('DB upsert exception:', { recordId: r.id, error: err });
          failDetails.push(msg);
          recordFailed = true;
        }

        if (recordFailed) {
          failCount++;
        } else {
          successCount++;
        }
      }

      setSyncProgress({ current: records.length, total: records.length, phase: '已完成' });
      return `✓ 上传完成：成功 ${successCount} 条${failCount ? `，失败 ${failCount} 条` : ''}` +
        (failDetails.length > 0 ? `\n${failDetails.slice(0, 5).join('\n')}${failDetails.length > 5 ? `\n...及其他 ${failDetails.length - 5} 条错误` : ''}` : '');

    } catch (err) {
      console.error('uploadToCloud outer catch:', err);
      return `同步失败: ${(err as Error).message}`;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const restoreFromCloud = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    if (!user) return '请先登录';

    setSyncing(true);
    setSyncMsg('');
    setSyncProgress({ current: 0, total: 0, phase: '读取云端数据...' });

    try {
      const { data, error } = await supabase
        .from('cloud_records')
        .select('record_data')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) {
        setSyncing(false);
        console.error('fetch cloud_records error:', error);
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

        const rid = shortId(light.id);
        setSyncProgress({
          current: i + 1,
          total: data.length,
          phase: `[${rid}] 正在恢复记录 ${i + 1} / ${data.length}...`,
        });

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

        let recordFailed = false;

        // Download images from Storage
        const imageRefs: { id: string; storagePath: string }[] = light.imageRefs || [];
        for (let j = 0; j < imageRefs.length; j++) {
          setSyncProgress({
            current: i + 1,
            total: data.length,
            phase: `[${rid}] 下载图片 ${j + 1}/${imageRefs.length}...`,
          });
          try {
            const { data: blob, error: dlErr } = await supabase.storage
              .from('minddrop-media')
              .download(imageRefs[j].storagePath);
            if (dlErr || !blob) {
              const msg = `[${rid}] 图片下载失败: ${imageRefs[j].storagePath} — ${dlErr?.message || '空响应'}`;
              console.error('Image download error:', { recordId: light.id, storagePath: imageRefs[j].storagePath, error: dlErr });
              failDetails.push(msg);
              recordFailed = true;
              continue;
            }
            const dataUrl = await blobToDataUrl(blob);
            fullRecord.images.push(dataUrl);
          } catch (err) {
            const msg = `[${rid}] 图片下载异常: ${imageRefs[j].storagePath} — ${(err as Error).message}`;
            console.error('Image download exception:', { recordId: light.id, storagePath: imageRefs[j].storagePath, error: err });
            failDetails.push(msg);
            recordFailed = true;
          }
        }

        // Download audio notes from Storage
        const audioRefs: { id: string; storagePath: string; duration: number; createdAt: string }[] = light.audioRefs || [];
        for (let j = 0; j < audioRefs.length; j++) {
          setSyncProgress({
            current: i + 1,
            total: data.length,
            phase: `[${rid}] 下载录音 ${j + 1}/${audioRefs.length}...`,
          });
          try {
            const { data: blob, error: dlErr } = await supabase.storage
              .from('minddrop-media')
              .download(audioRefs[j].storagePath);
            if (dlErr || !blob) {
              const msg = `[${rid}] 录音下载失败: ${audioRefs[j].storagePath} — ${dlErr?.message || '空响应'}`;
              console.error('Audio download error:', { recordId: light.id, storagePath: audioRefs[j].storagePath, error: dlErr });
              failDetails.push(msg);
              recordFailed = true;
              continue;
            }
            const dataUrl = await blobToDataUrl(blob);
            fullRecord.audioNotes.push({
              id: audioRefs[j].id,
              dataUrl,
              duration: audioRefs[j].duration || 0,
              createdAt: audioRefs[j].createdAt,
            });
          } catch (err) {
            const msg = `[${rid}] 录音下载异常: ${audioRefs[j].storagePath} — ${(err as Error).message}`;
            console.error('Audio download exception:', { recordId: light.id, storagePath: audioRefs[j].storagePath, error: err });
            failDetails.push(msg);
            recordFailed = true;
          }
        }

        // Save to IndexedDB
        try {
          await db.saveRecord(fullRecord);
          successCount++;
        } catch (err) {
          const msg = `[${rid}] 本地保存失败: ${(err as Error).message}`;
          console.error('IndexedDB save error:', { recordId: light.id, error: err });
          failDetails.push(msg);
          recordFailed = true;
        }

        if (recordFailed) failCount++;
      }

      setSyncProgress({ current: data.length, total: data.length, phase: '已完成' });
      return `✓ 恢复完成：成功 ${successCount} 条${failCount ? `，失败 ${failCount} 条` : ''}` +
        (failDetails.length > 0 ? `\n${failDetails.slice(0, 5).join('\n')}${failDetails.length > 5 ? `\n...及其他 ${failDetails.length - 5} 条错误` : ''}` : '');

    } catch (err) {
      console.error('restoreFromCloud outer catch:', err);
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
