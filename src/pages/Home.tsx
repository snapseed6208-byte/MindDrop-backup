import { useState, useRef } from 'react';
import type { FilterState, MindDropRecord } from '../types';
import { MOODS, TYPES } from '../types';
import { useFilteredRecords } from '../hooks';
import * as db from '../db';

const MOOD_COLORS: Record<string, string> = {
  '开心': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '平静': 'bg-blue-100 text-blue-700 border-blue-200',
  '焦虑': 'bg-purple-100 text-purple-700 border-purple-200',
  '疲惫': 'bg-gray-100 text-gray-500 border-gray-200',
  '难过': 'bg-blue-100 text-blue-600 border-blue-200',
  '生气': 'bg-red-100 text-red-600 border-red-200',
  '迷茫': 'bg-indigo-100 text-indigo-600 border-indigo-200',
  '有动力': 'bg-green-100 text-green-600 border-green-200',
  '放松': 'bg-cyan-100 text-cyan-600 border-cyan-200',
  '想哭': 'bg-indigo-100 text-indigo-500 border-indigo-200',
};

const TYPE_COLORS: Record<string, string> = {
  '心情': 'bg-pink-100 text-pink-600',
  '想法': 'bg-violet-100 text-violet-600',
  '备忘': 'bg-amber-100 text-amber-600',
  '灵感': 'bg-emerald-100 text-emerald-600',
  '待办': 'bg-orange-100 text-orange-600',
  '复盘': 'bg-teal-100 text-teal-600',
  '照片记录': 'bg-sky-100 text-sky-600',
  '语音记录': 'bg-rose-100 text-rose-600',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

function getTodayCount(records: MindDropRecord[]) {
  const today = new Date().toDateString();
  return records.filter(r => new Date(r.createdAt).toDateString() === today).length;
}

function getMoodEmoji(mood: string) {
  const map: Record<string, string> = {
    '开心': '😊', '平静': '😌', '焦虑': '😰', '疲惫': '😴',
    '难过': '😢', '生气': '😠', '迷茫': '😶', '有动力': '💪',
    '放松': '🧘', '想哭': '😭',
  };
  return map[mood] || '';
}

export default function Home({
  records,
  onNavigate,
  onEdit,
  onReload,
}: {
  records: MindDropRecord[];
  onNavigate: (page: string, record?: MindDropRecord) => void;
  onEdit: (record: MindDropRecord) => void;
  onReload: () => void;
}) {
  const [filters, setFilters] = useState<FilterState>({ search: '', mood: '', type: '' });
  const filtered = useFilteredRecords(records, filters);
  const todayCount = getTodayCount(records);
  const [backupMsg, setBackupMsg] = useState('');
  const [showBackup, setShowBackup] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const clearFilters = () => setFilters({ search: '', mood: '', type: '' });
  const hasFilters = filters.search || filters.mood || filters.type;

  const handleExport = async () => {
    try {
      const data = await db.exportAllRecords();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `minddrop-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMsg(`✓ 已导出 ${data.length} 条记录`);
    } catch {
      setBackupMsg('✗ 导出失败');
    }
    setTimeout(() => setBackupMsg(''), 3000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('格式错误');
      const result = await db.importRecords(data);
      setBackupMsg(`✓ 已导入 ${result.imported} 条，合并 ${result.merged} 条，跳过 ${result.skipped} 条`);
      onReload();
    } catch {
      setBackupMsg('✗ 导入失败，请检查文件格式');
    }
    e.target.value = '';
    setTimeout(() => setBackupMsg(''), 4000);
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pb-24 animate-fade-in">
      {/* Header */}
      <header className="pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-[#3d3529] tracking-wide">
          MindDrop
        </h1>
        <p className="text-sm text-mind-400 mt-0.5">想法胶囊</p>
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-mind-400">
            今日 <span className="text-mind-600 font-medium">{todayCount}</span> 条记录
          </p>
          <button
            onClick={() => onNavigate('create')}
            className="bg-[#3d3529] text-white px-5 py-2 rounded-full text-sm font-medium
                       hover:bg-[#504530] active:scale-[0.97] transition-all shadow-sm"
          >
            + 记录一下
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="搜索记录..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="w-full px-4 py-2.5 bg-white rounded-xl border border-mind-200
                     text-sm text-[#3d3529] placeholder-mind-400 outline-none
                     focus:border-mind-400 focus:ring-1 focus:ring-mind-300 transition-all"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          {MOODS.map(m => (
            <button
              key={m}
              onClick={() => setFilters(f => ({ ...f, mood: f.mood === m ? '' : m }))}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                filters.mood === m
                  ? 'bg-[#3d3529] text-white border-[#3d3529]'
                  : 'bg-white text-mind-500 border-mind-200 hover:border-mind-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilters(f => ({ ...f, type: f.type === t ? '' : t }))}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                filters.type === t
                  ? 'bg-[#3d3529] text-white border-[#3d3529]'
                  : 'bg-white text-mind-500 border-mind-200 hover:border-mind-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1 rounded-full text-xs text-mind-400 hover:text-mind-600 transition-colors shrink-0"
          >
            清除
          </button>
        )}
      </div>

      {/* Records list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-mind-300">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">
            {hasFilters ? '没有找到匹配的记录' : '还没有记录，点上面的按钮开始吧'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <div
              key={record.id}
              onClick={() => onEdit(record)}
              className="bg-white rounded-2xl p-4 border border-mind-100
                         cursor-pointer hover:border-mind-200 hover:shadow-sm
                         transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-mind-400">{formatDate(record.createdAt)}</span>
                {record.mood && (
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${MOOD_COLORS[record.mood] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {getMoodEmoji(record.mood)} {record.mood}
                  </span>
                )}
                {record.type && (
                  <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLORS[record.type] || 'bg-gray-50 text-gray-500'}`}>
                    {record.type}
                  </span>
                )}
                {record.isVoiceNote && <span className="text-xs text-mind-400">🎤</span>}
                {record.images.length > 0 && <span className="text-xs text-mind-400">🖼️</span>}
              </div>
              <p className="text-sm text-[#3d3529] leading-relaxed line-clamp-3">
                {record.content || <span className="text-mind-300 italic">无文字内容</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Data backup */}
      <div className="mt-8 border-t border-mind-200 pt-4">
        <button
          onClick={() => setShowBackup(!showBackup)}
          className="text-xs text-mind-400 hover:text-mind-600 transition-colors"
        >
          {showBackup ? '▼' : '▶'} 数据备份
        </button>

        {showBackup && (
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-full text-xs border bg-white text-mind-600
                         border-mind-200 hover:border-mind-400 hover:bg-mind-50 transition-all"
            >
              ⬇️ 导出数据
            </button>
            <button
              onClick={() => importRef.current?.click()}
              className="px-4 py-2 rounded-full text-xs border bg-white text-mind-600
                         border-mind-200 hover:border-mind-400 hover:bg-mind-50 transition-all"
            >
              📥 导入数据
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <span className="text-xs text-mind-400 self-center italic">
              导入会合并记录，不会清空现有数据，重复记录以较新者为准。
            </span>
          </div>
        )}

        {backupMsg && (
          <p className="mt-2 text-xs text-mind-500 animate-fade-in">{backupMsg}</p>
        )}
      </div>
    </div>
  );
}
