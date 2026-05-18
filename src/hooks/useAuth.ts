import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as db from '../db';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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

    try {
      const records = await db.getAllRecords();
      if (records.length === 0) return '本地没有记录可上传';

      const rows = records.map(r => ({
        id: r.id,
        user_id: user.id,
        record_data: r,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }));

      // Use upsert to avoid duplicates
      const { error } = await supabase
        .from('cloud_records')
        .upsert(rows, { onConflict: 'id' });

      if (error) return `上传失败: ${error.message}`;
      return `✓ 已上传 ${records.length} 条记录到云端`;
    } catch (err) {
      return `同步失败: ${(err as Error).message}`;
    }
  }, [user]);

  const restoreFromCloud = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase 未配置';
    if (!user) return '请先登录';

    try {
      const { data, error } = await supabase
        .from('cloud_records')
        .select('record_data')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) return `获取云端数据失败: ${error.message}`;

      if (!data || data.length === 0) return '云端没有记录';

      const cloudRecords = data.map(r => r.record_data);
      const result = await db.importRecords(cloudRecords);

      return `✓ 从云端合并了 ${result.imported + result.merged} 条记录（新增 ${result.imported} 条，更新 ${result.merged} 条，跳过 ${result.skipped} 条）`;
    } catch (err) {
      return `恢复失败: ${(err as Error).message}`;
    }
  }, [user]);

  return {
    user,
    loading,
    configError,
    syncMsg,
    setSyncMsg,
    login,
    signup,
    logout,
    uploadToCloud,
    restoreFromCloud,
  };
}
