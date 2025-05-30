import { useState, useEffect } from 'react';
import { ElectroViewerConfig, ParsedEntity, QueryRequest, QueryResponse } from '../types';

const API_BASE = '/api';

export function useConfig() {
  const [config, setConfig] = useState<ElectroViewerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setConfig(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { config, loading, error };
}

export function useEntities() {
  const [entities, setEntities] = useState<ParsedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/entities`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setEntities(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
        setEntities([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { entities, loading, error };
}

export function useQuery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async (request: QueryRequest): Promise<QueryResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { executeQuery, loading, error };
}