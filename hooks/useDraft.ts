import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useDraft<T>(key: string, initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const loaded = useRef(false);
  const timeout = useRef<any>(null);

  // cargar
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try { setDraft({ ...initial, ...JSON.parse(raw) }); }
        catch {}
      }
      loaded.current = true;
    })();
    return () => { if (timeout.current) clearTimeout(timeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // guardar debounced
  const save = useCallback((next: T) => {
    setDraft(next);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    }, 600); // 600ms
  }, [key]);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(key);
  }, [key]);

  return { draft, setDraft: save, clear, loaded: loaded.current };
}
