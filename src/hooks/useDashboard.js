import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(null);
  const controller = useRef(null);
  const sequence = useRef(0);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    controller.current = new AbortController();
    const request = ++sequence.current;
    try {
      const result = await api('/api/dashboard', { signal: controller.current.signal });
      if (mounted.current && request === sequence.current) {
        setData(result);
        setConnected(true);
      }
      return result;
    } catch (error) {
      if (error.name !== 'AbortError' && mounted.current && request === sequence.current) setConnected(false);
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const update = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(update, 15000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);

  return { data, connected, refresh };
}
