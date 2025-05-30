import { Link } from 'react-router-dom';
import { Database, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useConfig, useEntities } from '../hooks/useApi';

export function HomePage() {
  const { config, loading: configLoading, error: configError } = useConfig();
  const { entities, loading: entitiesLoading, error: entitiesError } = useEntities();

  if (configLoading || entitiesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading configuration...</span>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h3 className="ml-2 text-lg font-medium text-red-800">Configuration Error</h3>
        </div>
        <p className="mt-2 text-red-700">{configError}</p>
        <p className="mt-2 text-sm text-red-600">
          Make sure you have an <code>electroviewer.config.json</code> file in your current directory.
        </p>
      </div>
    );
  }

  if (entitiesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h3 className="ml-2 text-lg font-medium text-red-800">Entities Error</h3>
        </div>
        <p className="mt-2 text-red-700">{entitiesError}</p>
        <p className="mt-2 text-sm text-red-600">
          Check that your entities file path is correct and exports an <code>entities</code> object.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">ElectroDB Entities</h2>
        {config && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Table:</span>
              <span className="ml-2 text-gray-900">{config.tableName}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Region:</span>
              <span className="ml-2 text-gray-900">{config.region || 'default'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Service:</span>
              <span className="ml-2 text-gray-900">{config.service || 'unknown'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Entities List */}
      {entities.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <h3 className="ml-2 text-lg font-medium text-yellow-800">No Entities Found</h3>
          </div>
          <p className="mt-2 text-yellow-700">
            No ElectroDB entities were found in your configuration file.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {entities.map((entity) => (
            <div
              key={entity.name}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center mb-4">
                <Database className="h-6 w-6 text-blue-600" />
                <h3 className="ml-2 text-xl font-semibold text-gray-900">
                  {entity.name}
                </h3>
                <span className="ml-auto text-sm text-gray-500">
                  Service: {entity.service}
                </span>
              </div>

              {entity.indexes.length === 0 ? (
                <p className="text-gray-500 italic">No indexes found</p>
              ) : (
                <div className="grid gap-3">
                  {entity.indexes.map((index) => (
                    <Link
                      key={index.name}
                      to={`/query/${entity.name}/${index.name}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center">
                            <Search className="h-4 w-4 text-gray-600" />
                            <span className="ml-2 font-medium text-gray-900">
                              {index.name}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            <span className="font-medium">PK:</span> {index.pk.join(', ')}
                            {index.sk && (
                              <>
                                <span className="ml-4 font-medium">SK:</span> {index.sk.join(', ')}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-blue-600 text-sm">
                          Click to query →
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}