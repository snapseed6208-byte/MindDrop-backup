import { useState, useRef } from 'react';
import type { MindDropRecord, MoodType, RecordType, AudioNote } from '../types';
import { MOODS, TYPES } from '../types';
import AudioRecorder from '../components/AudioRecorder';
import AudioPlayer from '../components/AudioPlayer';

interface Props {
  onSave: (record: MindDropRecord) => void;
  onCancel: () => void;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getMoodEmoji(mood: string) {
  const map: Record<string, string> = {
    '开心': '😊', '平静': '😌', '焦虑': '😰', '疲惫': '😴',
    '难过': '😢', '生气': '😠', '迷茫': '😶', '有动力': '💪',
    '放松': '🧘', '想哭': '😭',
  };
  return map[mood] || '';
}

export default function CreateRecord({ onSave, onCancel }: Props) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType | ''>('');
  const [type, setType] = useState<RecordType | ''>('');
  const [images, setImages] = useState<string[]>([]);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>([]);
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

  const handleAddAudio = (note: AudioNote) => {
    setAudioNotes(prev => prev.length < 3 ? [...prev, note] : prev);
  };

  const handleRemoveAudio = (idx: number) => {
    setAudioNotes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!content.trim() && images.length === 0 && audioNotes.length === 0) return;
    const now = new Date().toISOString();
    const record: MindDropRecord = {
      id: generateId(),
      content: content.trim(),
      mood,
      type,
      images,
      isVoiceNote: false,
      audioNotes,
      createdAt: now,
      updatedAt: now,
    };
    onSave(record);
  };

  const canSave = content.trim().length > 0 || images.length > 0 || audioNotes.length > 0;

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 pt-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onCancel} className="text-sm text-mind-400 hover:text-mind-600 transition-colors">
          取消
        </button>
        <h2 className="text-base font-medium text-[#3d3529]">新记录</h2>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`text-sm font-medium transition-all ${
            canSave ? 'text-[#3d3529] hover:text-[#504530]' : 'text-mind-300 cursor-not-allowed'
          }`}
        >
          保存
        </button>
      </div>

      {/* Content textarea */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="此刻在想什么？"
        className="w-full min-h-[140px] bg-white rounded-2xl p-4 text-sm text-[#3d3529]
                   placeholder-mind-300 border border-mind-200 outline-none resize-none
                   focus:border-mind-400 focus:ring-1 focus:ring-mind-300 transition-all"
        autoFocus
      />

      {/* Audio recording */}
      <div className="mt-3 mb-5 space-y-2">
        <AudioRecorder onSave={handleAddAudio} />
        {audioNotes.length >= 3 && (
          <p className="text-xs text-mind-400">最多可添加 3 条录音</p>
        )}
        {audioNotes.length > 0 && (
          <div className="space-y-1.5">
            {audioNotes.map((note, idx) => (
              <AudioPlayer
                key={note.id}
                note={note}
                onDelete={() => handleRemoveAudio(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
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

      {/* Mood selection */}
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

      {/* Type selection */}
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
