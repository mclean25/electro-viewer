import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Database, Loader2, AlertCircle } from 'lucide-react';
import { useEntities, useQuery } from '../hooks/useApi';
import { ParsedEntity, EntityIndex, QueryResponse } from '../types';

export function QueryPage() {
  const { entityName, indexName } = useParams<{
    entityName: string;
    indexName: string;
  }>();
  
  const { entities, loading: entitiesLoading } = useEntities();
  const { executeQuery, loading: queryLoading, error: queryError } = useQuery();
  
  const [entity, setEntity] = useState<ParsedEntity | null>(null);
  const [index, setIndex] = useState<EntityIndex | null>(null);
  const [pkValues, setPkValues] = useState<Record<string, string>>({});
  const [skValues, setSkValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QueryResponse | null>(null);

  useEffect(() => {
    if (entities.length > 0 && entityName && indexName) {
      const foundEntity = entities.find(e => e.name === entityName);
      if (foundEntity) {
        setEntity(foundEntity);
        const foundIndex = foundEntity.indexes.find(i => i.name === indexName);
        if (foundIndex) {
          setIndex(foundIndex);
          // Initialize form values
          const initialPkValues: Record<string, string> = {};
          foundIndex.pk.forEach(field => {
            initialPkValues[field] = '';
          });
          setPkValues(initialPkValues);
          
          if (foundIndex.sk) {
            const initialSkValues: Record<string, string> = {};
            foundIndex.sk.forEach(field => {
              initialSkValues[field] = '';
            });
            setSkValues(initialSkValues);
          }
        }
      }
    }
  }, [entities, entityName, indexName]);

  const handlePkChange = (field: string, value: string) => {
    setPkValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSkChange = (field: string, value: string) => {
    setSkValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entityName || !indexName) return;
    
    const response = await executeQuery({
      entityName,
      indexName,
      pkValues,
      skValues: index?.sk ? skValues : undefined,
    });
    
    if (response) {
      setResults(response);
    }
  };

  const canSubmit = index?.pk.every(field => pkValues[field]?.trim());

  if (entitiesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading entities...</span>
      </div>
    );
  }

  if (!entity || !index) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h3 className="ml-2 text-lg font-medium text-red-800">Entity or Index Not Found</h3>
        </div>
        <p className="mt-2 text-red-700">
          Could not find entity "{entityName}" or index "{indexName}".
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to entities
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to entities
        </Link>
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Query {entity.name}.{index.name}
          </h1>
        </div>
      </div>

      {/* Query Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Query Parameters</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Primary Key Fields */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">
              Primary Key Fields (Required)
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {index.pk.map((field) => (
                <div key={field}>
                  <label
                    htmlFor={`pk-${field}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {field}
                  </label>
                  <input
                    type="text"
                    id={`pk-${field}`}
                    value={pkValues[field] || ''}
                    onChange={(e) => handlePkChange(field, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Enter ${field}`}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sort Key Fields */}
          {index.sk && index.sk.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">
                Sort Key Fields (Optional)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {index.sk.map((field) => (
                  <div key={field}>
                    <label
                      htmlFor={`sk-${field}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {field}
                    </label>
                    <input
                      type="text"
                      id={`sk-${field}`}
                      value={skValues[field] || ''}
                      onChange={(e) => handleSkChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter ${field} (optional)`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-start">
            <button
              type="submit"
              disabled={!canSubmit || queryLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {queryLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute Query
            </button>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {queryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="ml-2 text-lg font-medium text-red-800">Query Error</h3>
          </div>
          <p className="mt-2 text-red-700">{queryError}</p>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Query Results</h2>
            <span className="text-sm text-gray-600">
              {results.count} item{results.count !== 1 ? 's' : ''} found
            </span>
          </div>
          
          {results.count === 0 ? (
            <p className="text-gray-500 italic">No items found matching your query.</p>
          ) : (
            <div className="overflow-x-auto">
              <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-auto max-h-96">
                {JSON.stringify(results.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}