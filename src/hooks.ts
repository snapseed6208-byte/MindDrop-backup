import { useState, useEffect, useCallback, useRef } from 'react';
import type { MindDropRecord, FilterState, AudioNote } from './types';
import * as db from './db';

export function useRecords() {
  const [records, setRecords] = useState<MindDropRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await db.getAllRecords();
    setRecords(data as MindDropRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (record: MindDropRecord) => {
    await db.saveRecord(record);
    setRecords(prev => [record, ...prev]);
  }, []);

  const update = useCallback(async (record: MindDropRecord) => {
    await db.saveRecord(record);
    setRecords(prev => prev.map(r => r.id === record.id ? record : r));
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.deleteRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  return { records, loading, add, update, remove, reload: load };
}

export function useFilteredRecords(records: MindDropRecord[], filters: FilterState) {
  return records.filter(r => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!r.content.toLowerCase().includes(q) &&
          !r.mood.toLowerCase().includes(q) &&
          !r.type.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filters.mood && r.mood !== filters.mood) return false;
    if (filters.type && r.type !== filters.type) return false;
    return true;
  });
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [supported, setSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setSupported(false);
    }
  }, []);

  const startRecording = useCallback(async (): Promise<AudioNote | null> => {
    if (!supported) return null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionDenied(false);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();

      const startTime = Date.now();
      setRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 200);

      return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          clearInterval(timerRef.current);
          setRecording(false);
          stream.getTracks().forEach(t => t.stop());

          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            const audioNote: AudioNote = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              dataUrl: reader.result as string,
              duration: Math.floor((Date.now() - startTime) / 1000),
              createdAt: new Date().toISOString(),
            };
            resolve(audioNote);
          };
          reader.readAsDataURL(blob);
        };
      });
    } catch (err) {
      if ((err as DOMException).name === 'NotAllowedError') {
        setPermissionDenied(true);
      }
      return null;
    }
  }, [supported]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { recording, duration, supported, permissionDenied, startRecording, stopRecording };
}
