import { useAudioRecorder } from '../hooks';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AudioRecorder({ onSave }: { onSave: (note: any) => void }) {
  const { recording, duration, supported, permissionDenied, startRecording, stopRecording } = useAudioRecorder();

  if (!supported) {
    return (
      <div className="text-xs text-mind-400 italic">
        当前浏览器暂不支持录音功能，可以先使用文字记录。
      </div>
    );
  }

  const handleStart = async () => {
    const note = await startRecording();
    if (note) onSave(note);
  };

  return (
    <div className="flex items-center gap-3">
      {recording ? (
        <>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-medium">{fmt(duration)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="px-4 py-2 rounded-full text-xs border bg-white text-red-500
                       border-red-200 hover:bg-red-50 transition-all"
          >
            ⏹ 停止
          </button>
        </>
      ) : (
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs border
                     bg-white text-mind-500 border-mind-200 hover:border-mind-400 transition-all"
        >
          🎤 开始录音
        </button>
      )}
      {permissionDenied && (
        <span className="text-xs text-mind-400 italic">
          需要允许麦克风权限后才能录音。
        </span>
      )}
    </div>
  );
}
