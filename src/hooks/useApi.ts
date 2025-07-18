import { useState, useEffect } from "react";
import {
  ElectroViewerConfig,
  ParsedEntity,
  QueryRequest,
  QueryResponse,
} from "../types";

export function useConfig() {
  const [config, setConfig] = useState<ElectroViewerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real implementation, this would read the config file directly
    // For now, let's use a simple approach that works in the browser
    const loadConfig = async () => {
      try {
        // Try to fetch the config file from the public directory
        const response = await fetch("/electroviewer.config.json");
        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }
        const data = await response.json();
        setConfig(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load configuration");
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  return { config, loading, error };
}

export function useEntities() {
  const [entities, setEntities] = useState<ParsedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEntities = async () => {
      try {
        // Fetch the generated entities.json file
        const response = await fetch("/entities.json");
        if (!response.ok) {
          throw new Error(`Failed to load entities: ${response.status}`);
        }
        const data = await response.json();
        setEntities(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load entities");
        setEntities([]);
      } finally {
        setLoading(false);
      }
    };

    loadEntities();
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
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { executeQuery, loading, error };
}
