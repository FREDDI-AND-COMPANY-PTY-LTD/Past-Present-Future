import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Loads the unified review queue from the getReviewQueue backend function.
 * Counts come back with every call and describe the whole scoped set, so the
 * chips and tabs stay accurate whatever filter is applied.
 */
export function useReviewQueue({ scope, type, status, enabled }) {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ by_type: {}, by_state: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getReviewQueue', {
        scope,
        type: type === 'all' ? null : type,
        status,
      });
      const data = res.data || {};
      setItems(data.items || []);
      setCounts(data.counts || { by_type: {}, by_state: {} });
    } catch (e) {
      setError(e?.response?.data?.error || 'The review queue could not be loaded just now.');
      setItems([]);
    }
    setLoading(false);
  }, [scope, type, status, enabled]);

  useEffect(() => { load(); }, [load]);

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  return { items, counts, loading, error, reload: load, removeItem };
}