import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { AbsenceRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { LiveRegion } from '../components/LiveRegion';

interface AbsenceOverviewData {
  assignedSpace: number | null;
  requests: AbsenceRequest[];
}

export const AbsencePage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AbsenceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states defaulting to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [releaseParking, setReleaseParking] = useState(false);

  const loadAbsenceOverview = useCallback(async () => {
    try {
      const res = await api.get<AbsenceOverviewData>('/api/absence/overview');
      setData(res);
      if (res.assignedSpace && res.assignedSpace !== 999) {
        setReleaseParking(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load absence requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAbsenceOverview();
  }, [loadAbsenceOverview]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate < val) {
      setEndDate(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the absence.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActionLoading(true);

    try {
      await api.post('/api/absence/requests', {
        startDate,
        endDate,
        reason: reason.trim(),
        releaseSpace: releaseParking,
      });
      setSuccessMessage('Staff absence report submitted successfully.');
      setReason('');
      await loadAbsenceOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to submit absence report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this absence request?')) return;

    setError(null);
    setSuccessMessage(null);
    setActionLoading(true);

    try {
      await api.delete(`/api/absence/requests/${id}`);
      setSuccessMessage('Absence request cancelled.');
      await loadAbsenceOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel absence request');
    } finally {
      setActionLoading(false);
    }
  };

  const isEntraStaff = user?.userType === 'Staff' && user?.authType === 'Entra';
  const hasAssignedSpace = Boolean(data?.assignedSpace && data.assignedSpace !== 999);

  if (!isEntraStaff) {
    return (
      <div className="absence-page-container">
        <div className="status-box error-box" role="alert">
          <span>⚠️ Access Restricted: Only Microsoft Entra ID authenticated staff may submit staff absence reports.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absence-page-container">
      <header className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-main)' }}>Staff Absence Reporting</h1>
        <p className="page-subtitle">Record anticipated absences and optionally release your parking bay for colleague use.</p>
      </header>

      <LiveRegion loading={loading} error={error} />

      {successMessage && (
        <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
          <span>✓ {successMessage}</span>
        </div>
      )}

      {/* Submit Absence Card */}
      <section className="card absence-form-card">
        <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Submit Absence Request</h2>

        <form onSubmit={handleSubmit} className="absence-form">
          <div className="form-row-dates">
            <div className="form-group">
              <label htmlFor="absStartDate" className="form-label">Start Date</label>
              <input
                id="absStartDate"
                type="date"
                required
                className="form-control"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="absEndDate" className="form-label">End Date</label>
              <input
                id="absEndDate"
                type="date"
                required
                min={startDate}
                className="form-control"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="absReason" className="form-label">
              Reason for Absence (Max 1,000 characters)
            </label>
            <textarea
              id="absReason"
              required
              maxLength={1000}
              rows={3}
              className="form-control"
              placeholder="e.g. Attending professional development seminar / Personal leave"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="char-count">{reason.length} / 1000 characters</div>
          </div>

          {/* Release Parking Space Checkbox - shown and checked only when staff has assigned space */}
          {hasAssignedSpace && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={releaseParking}
                  onChange={e => setReleaseParking(e.target.checked)}
                />
                <span>
                  <strong>Release My Parking Space (Bay #{data?.assignedSpace})</strong> for the duration of this absence
                </span>
              </label>
              <p className="form-hint">
                Future weekdays included in this date range will be automatically made available for other staff members to reserve.
              </p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={actionLoading}
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
            >
              {actionLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </section>

      {/* Existing Absence Table */}
      <section className="card">
        <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Your Absence History</h2>

        {data?.requests && data.requests.length > 0 ? (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                  <th>Parking Released</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map(req => (
                  <tr key={req.id}>
                    <td><strong>{req.startDate}</strong></td>
                    <td><strong>{req.endDate}</strong></td>
                    <td className="reason-cell">{req.reason}</td>
                    <td>
                      {req.releasedSpace ? (
                        <span className="badge badge-success">Bay #{req.releasedSpace}</span>
                      ) : (
                        <span className="badge badge-secondary">No</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={actionLoading}
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancel(req.id)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-text">No absence reports recorded.</p>
        )}
      </section>
    </div>
  );
};
