export const MOODS = [
  '开心', '平静', '焦虑', '疲惫', '难过',
  '生气', '迷茫', '有动力', '放松', '想哭',
] as const;

export const TYPES = [
  '心情', '想法', '备忘', '灵感',
  '待办', '复盘', '照片记录', '语音记录',
] as const;

export type MoodType = typeof MOODS[number];
export type RecordType = typeof TYPES[number];

export interface AudioNote {
  id: string;
  dataUrl: string;
  duration: number;
  createdAt: string;
}

export interface MindDropRecord {
  id: string;
  content: string;
  mood: MoodType | '';
  type: RecordType | '';
  images: string[];
  isVoiceNote: boolean;
  audioNotes: AudioNote[];
  createdAt: string;
  updatedAt: string;
}

export type FilterState = {
  mood: MoodType | '';
  type: RecordType | '';
  search: string;
};
