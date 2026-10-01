import React from 'react';

interface LiveRegionProps {
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  children?: React.ReactNode;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  loading,
  loadingText = 'Loading details...',
  error,
  empty,
  emptyText = 'No records found.',
  children,
}) => {
  return (
    <div className="status-region" aria-live="polite" aria-atomic="true">
      {loading && (
        <div className="status-box loading-box">
          <div className="spinner" aria-hidden="true" />
          <span>{loadingText}</span>
        </div>
      )}

      {error && !loading && (
        <div className="status-box error-box" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {empty && !loading && !error && (
        <div className="status-box empty-box">
          <span>{emptyText}</span>
        </div>
      )}

      {!loading && !error && !empty && children}
    </div>
  );
};
