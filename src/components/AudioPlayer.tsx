import { useState, useRef, useCallback } from 'react';
import type { AudioNote } from '../types';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  note: AudioNote;
  onDelete?: () => void;
}

export default function AudioPlayer({ note, onDelete }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current) {
        const audio = new Audio(note.dataUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlaying(false); setCurrentTime(0); };
        audio.ontimeupdate = () => setCurrentTime(Math.floor(audio.currentTime));
      }
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing, note.dataUrl]);

  const progress = note.duration > 0 ? (currentTime / note.duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 bg-mind-50 rounded-xl px-3 py-2 border border-mind-100 group">
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-white border border-mind-200 flex items-center justify-center
                   text-sm text-mind-600 hover:border-mind-400 transition-all shrink-0"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-mind-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-mind-500 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-mind-400 w-10 text-right shrink-0">
        {playing ? fmt(currentTime) : fmt(note.duration)}
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-xs text-mind-400 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
