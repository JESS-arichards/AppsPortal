import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ParkingRelease } from '../types';
import { useAuth } from '../context/AuthContext';
import { LiveRegion } from '../components/LiveRegion';

interface ParkingOverviewData {
  assignedSpace: number | null;
  authType: string;
  yourReleases: ParkingRelease[];
  availableReleases: ParkingRelease[];
  yourReservations: ParkingRelease[];
}

export const ParkingPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ParkingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Form dates default to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Available spaces date filter
  const [filterDate, setFilterDate] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get<ParkingOverviewData>('/api/parking/overview');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load parking overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate < val) {
      setEndDate(val);
    }
  };

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setActionLoading(true);

    try {
      await api.post('/api/parking/releases', { startDate, endDate });
      setSuccessMessage('Parking space successfully released for the selected weekday(s).');
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to release parking space');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRelease = async (releaseId: number) => {
    if (!window.confirm('Are you sure you want to cancel this parking release?')) return;
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setActionLoading(true);

    try {
      const res = await api.delete<{ success: boolean; notificationWarning?: string }>(`/api/parking/releases/${releaseId}`);
      setSuccessMessage('Parking release successfully cancelled.');
      if (res.notificationWarning) {
        setWarningMessage(res.notificationWarning);
      }
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel release');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReserve = async (releaseId: number) => {
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setActionLoading(true);

    try {
      await api.post('/api/parking/reservations', { releaseId });
      setSuccessMessage('Parking space reserved successfully.');
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to reserve space');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReservation = async (releaseId: number) => {
    if (!window.confirm('Are you sure you want to cancel your reservation for this space?')) return;
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setActionLoading(true);

    try {
      await api.delete(`/api/parking/reservations/${releaseId}`);
      setSuccessMessage('Reservation cancelled.');
      await loadOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel reservation');
    } finally {
      setActionLoading(false);
    }
  };

  const isEntraStaff = user?.userType === 'Staff' && user?.authType === 'Entra';
  const hasAssignedSpace = Boolean(data?.assignedSpace && data.assignedSpace !== 999);

  // Filter available releases
  const availableList = data?.availableReleases || [];
  const filteredAvailable = filterDate
    ? availableList.filter(r => r.date === filterDate)
    : availableList;

  return (
    <div className="parking-page-container">
      <header className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-main)' }}>Staff Parking Management</h1>
        <p className="page-subtitle">Release your assigned bay when out of school or reserve available spaces for visiting campuses.</p>
      </header>

      <LiveRegion loading={loading} error={error} />

      {successMessage && (
        <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
          <span>✓ {successMessage}</span>
        </div>
      )}

      {warningMessage && (
        <div className="status-box warning-box" role="alert" style={{ marginBottom: '16px' }}>
          <span>⚠️ {warningMessage}</span>
        </div>
      )}

      {/* 1. Assigned Space & Release Form */}
      {isEntraStaff && hasAssignedSpace && (
        <section className="card parking-release-card">
          <div className="card-header-bar">
            <div>
              <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>
                Your Assigned Space: <strong>Bay #{data?.assignedSpace}</strong>
              </h2>
              <p className="card-hint">
                Release your space for other staff members while you are off-campus or on leave. Weekdays only.
              </p>
            </div>
          </div>

          <form onSubmit={handleReleaseSubmit} className="parking-form">
            <div className="form-row-dates">
              <div className="form-group">
                <label htmlFor="startDateInput" className="form-label">From Date</label>
                <input
                  id="startDateInput"
                  type="date"
                  required
                  min={todayStr}
                  className="form-control"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDateInput" className="form-label">To Date</label>
                <input
                  id="endDateInput"
                  type="date"
                  required
                  min={startDate}
                  className="form-control"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>

              <div className="form-group btn-align-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
                >
                  {actionLoading ? 'Releasing...' : 'Release my space'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* 2. Your Releases List */}
      <section className="card">
        <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Your Active Releases</h2>
        {data?.yourReleases && data.yourReleases.length > 0 ? (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bay #</th>
                  <th>Status</th>
                  <th>Reserved By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.yourReleases.map(rel => (
                  <tr key={rel.id}>
                    <td><strong>{rel.date}</strong></td>
                    <td>Bay #{rel.space}</td>
                    <td>
                      {rel.reserverUserId ? (
                        <span className="badge badge-warning">Reserved</span>
                      ) : (
                        <span className="badge badge-success">Available</span>
                      )}
                    </td>
                    <td>{rel.reserverName || '—'}</td>
                    <td>
                      <button
                        type="button"
                        disabled={actionLoading}
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancelRelease(rel.id)}
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
          <p className="empty-text">You have no active space releases.</p>
        )}
      </section>

      {/* 3. Available Spaces List */}
      <section className="card">
        <div className="card-header-flex">
          <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Available Spaces to Reserve</h2>

          {/* Client-side Date Filter */}
          <div className="date-filter-box">
            <label htmlFor="filterDateInput" className="filter-label">Filter by date:</label>
            <input
              id="filterDateInput"
              type="date"
              className="form-control form-control-sm"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setFilterDate('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredAvailable.length > 0 ? (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bay #</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.map(rel => (
                  <tr key={rel.id}>
                    <td><strong>{rel.date}</strong></td>
                    <td>Bay #{rel.space}</td>
                    <td>{rel.ownerName || 'Staff Member'}</td>
                    <td>
                      <button
                        type="button"
                        disabled={actionLoading}
                        className="btn btn-sm btn-accent"
                        style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
                        onClick={() => handleReserve(rel.id)}
                      >
                        Reserve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-text">No available parking spaces found for the selected date.</p>
        )}
      </section>

      {/* 4. Your Reservations List */}
      <section className="card">
        <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Your Reservations</h2>
        {data?.yourReservations && data.yourReservations.length > 0 ? (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bay #</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.yourReservations.map(rel => (
                  <tr key={rel.id}>
                    <td><strong>{rel.date}</strong></td>
                    <td>Bay #{rel.space}</td>
                    <td>{rel.ownerName || 'Staff Member'}</td>
                    <td>
                      <button
                        type="button"
                        disabled={actionLoading}
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleCancelReservation(rel.id)}
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
          <p className="empty-text">You have no upcoming parking reservations.</p>
        )}
      </section>
    </div>
  );
};
