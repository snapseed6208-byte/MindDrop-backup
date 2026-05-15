import { useState, useRef } from 'react';
import type { MindDropRecord, MoodType, RecordType } from '../types';
import { MOODS, TYPES } from '../types';

interface Props {
  record: MindDropRecord;
  onSave: (record: MindDropRecord) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

function getMoodEmoji(mood: string) {
  const map: Record<string, string> = {
    '开心': '😊', '平静': '😌', '焦虑': '😰', '疲惫': '😴',
    '难过': '😢', '生气': '😠', '迷茫': '😶', '有动力': '💪',
    '放松': '🧘', '想哭': '😭',
  };
  return map[mood] || '';
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${month}/${day} ${hour}:${min}`;
}

export default function RecordDetail({ record, onSave, onDelete, onBack }: Props) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(record.content);
  const [mood, setMood] = useState<MoodType | ''>(record.mood);
  const [type, setType] = useState<RecordType | ''>(record.type);
  const [images, setImages] = useState<string[]>(record.images);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (images.length >= 6) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      ...record,
      content: content.trim(),
      mood,
      type,
      images,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  const handleDelete = () => {
    onDelete(record.id);
    onBack();
  };

  if (editing) {
    return (
      <div className="min-h-screen max-w-lg mx-auto px-4 pt-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEditing(false)} className="text-sm text-mind-400 hover:text-mind-600 transition-colors">
            取消
          </button>
          <h2 className="text-base font-medium text-[#3d3529]">编辑记录</h2>
          <button
            onClick={handleSave}
            className="text-sm font-medium text-[#3d3529] hover:text-[#504530] transition-colors"
          >
            保存
          </button>
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full min-h-[140px] bg-white rounded-2xl p-4 text-sm text-[#3d3529]
                     border border-mind-200 outline-none resize-none
                     focus:border-mind-400 focus:ring-1 focus:ring-mind-300 transition-all"
        />

        {/* Images */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 mb-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative">
                <img src={img} alt="" className="w-20 h-20 object-cover rounded-xl" />
                <button
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full border border-mind-200
                             text-xs text-mind-500 flex items-center justify-center shadow-sm hover:shadow"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs border bg-white text-mind-500
                     border-mind-200 hover:border-mind-400 transition-all mb-5"
        >
          🖼️ 添加图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageAdd}
        />

        <div className="mb-5">
          <p className="text-xs text-mind-400 mb-2">心情</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? '' : m)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  mood === m
                    ? 'bg-[#3d3529] text-white border-[#3d3529]'
                    : 'bg-white text-mind-500 border-mind-200 hover:border-mind-400'
                }`}
              >
                {getMoodEmoji(m)} {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-mind-400 mb-2">类型</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(type === t ? '' : t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  type === t
                    ? 'bg-[#3d3529] text-white border-[#3d3529]'
                    : 'bg-white text-mind-500 border-mind-200 hover:border-mind-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm text-mind-400 hover:text-mind-600 transition-colors">
          ← 返回
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-mind-400 hover:text-mind-600 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-400 hover:text-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl p-5 border border-mind-100 mb-4">
        <p className="text-sm text-[#3d3529] leading-relaxed whitespace-pre-wrap">
          {record.content || <span className="text-mind-300 italic">无文字内容</span>}
        </p>
      </div>

      {/* Images */}
      {record.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {record.images.map((img, idx) => (
            <img key={idx} src={img} alt="" className="w-24 h-24 object-cover rounded-xl" />
          ))}
        </div>
      )}

      {/* Meta info */}
      <div className="bg-white rounded-2xl p-4 border border-mind-100 space-y-3">
        {record.mood && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-mind-400 w-12">心情</span>
            <span className="px-3 py-1 rounded-full text-xs border bg-mind-50 text-mind-600 border-mind-200">
              {getMoodEmoji(record.mood)} {record.mood}
            </span>
          </div>
        )}
        {record.type && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-mind-400 w-12">类型</span>
            <span className="px-3 py-1 rounded text-xs bg-mind-50 text-mind-600">
              {record.type}
            </span>
          </div>
        )}
        {record.isVoiceNote && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-mind-400 w-12">来源</span>
            <span className="text-xs text-mind-500">🎤 语音记录</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-mind-400 w-12">创建</span>
          <span className="text-xs text-mind-500">{formatDateTime(record.createdAt)}</span>
        </div>
        {record.updatedAt !== record.createdAt && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-mind-400 w-12">更新</span>
            <span className="text-xs text-mind-500">{formatDateTime(record.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-lg">
            <p className="text-sm text-[#3d3529] text-center mb-5">确定要删除这条记录吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-full text-sm border border-mind-200 text-mind-500 hover:bg-mind-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
