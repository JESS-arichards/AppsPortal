import React from 'react';
import { useAuth } from '../context/AuthContext';

export const ImpersonationBanner: React.FC = () => {
  const { impersonation, user, exitImpersonation } = useAuth();

  if (!impersonation || !impersonation.active) {
    return null;
  }

  const isViewMode = impersonation.mode === 'view';

  return (
    <div
      className="impersonation-banner"
      role="region"
      aria-label="User impersonation session"
      style={{
        backgroundColor: isViewMode ? '#FFFBEB' : '#FEF2F2',
        borderBottom: `2px solid ${isViewMode ? '#F59E0B' : '#EF4444'}`,
        color: isViewMode ? '#92400E' : '#991B1B',
        padding: '8px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', minWidth: 0 }}>
        <span style={{ fontSize: '18px' }} aria-hidden="true">
          {isViewMode ? '👁️' : '⚡'}
        </span>
        <span>
          <strong>Impersonation Session:</strong> Viewing as{' '}
          <strong>{user?.displayName}</strong> ({impersonation.targetType}) &mdash;{' '}
          <em>{isViewMode ? 'View Only (modifications blocked)' : 'Test Actions (real actions allowed & audited)'}</em>.
          Started by <strong>{impersonation.actorName}</strong>.
        </span>
      </div>

      <button
        onClick={exitImpersonation}
        className="btn-exit-view"
        style={{
          backgroundColor: isViewMode ? '#D97706' : '#DC2626',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 14px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '13px',
        }}
      >
        Exit view
      </button>
    </div>
  );
};
