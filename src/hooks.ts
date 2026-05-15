import { useState, useEffect, useCallback } from 'react';
import type { MindDropRecord, FilterState } from './types';
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

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSupported(false);
    }
  }, []);

  const startListening = useCallback((onResult: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      if (event.results[0].isFinal) {
        onResult(transcript);
        setListening(false);
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  }, []);

  return { listening, supported, startListening };
}
