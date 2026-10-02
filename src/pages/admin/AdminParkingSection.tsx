import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { User, ParkingRelease } from '../../types';

// =====================================================================
// ADMIN PARKING SECTION
// =====================================================================
export const AdminParkingSection: React.FC = () => {
  const [releases, setReleases] = useState<ParkingRelease[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [releaseSpaceOpen, setReleaseSpaceOpen] = useState(false);
  const [allReleasesOpen, setAllReleasesOpen] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const loadParking = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/admin/parking/releases');
      setReleases(res.releases || []);
      setEligibleStaff(res.eligibleStaff || []);
      if (res.eligibleStaff?.length > 0 && !selectedStaffId) {
        setSelectedStaffId(res.eligibleStaff[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load parking releases');
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId]);

  useEffect(() => {
    loadParking();
  }, [loadParking]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setEndDate(val); // Start-date changes default end date to same day per Section 4.8
  };

  const handleAdminRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    setError(null);
    setSuccess(null);
    try {
      await api.post('/api/admin/parking/releases', {
        ownerUserId: selectedStaffId,
        startDate,
        endDate,
      });
      setSuccess('Parking space released on behalf of staff member.');
      await loadParking();
    } catch (err: any) {
      setError(err.message || 'Failed to release parking space');
    }
  };

  const handleDeleteRelease = async (rel: ParkingRelease) => {
    const warningNotice = rel.reserverUserId
      ? ` Warning: Space is currently reserved by ${rel.reserverName || 'a colleague'}. They will receive a Teams cancellation notice.`
      : '';

    if (!window.confirm(`Delete release for Bay #${rel.space} on ${rel.date}?${warningNotice}`)) return;

    setError(null);
    setWarning(null);
    try {
      const res = await api.delete<any>(`/api/admin/parking/releases/${rel.id}`);
      setSuccess(`Parking release for Bay #${rel.space} on ${rel.date} deleted.`);
      if (res.notificationWarning) {
        setWarning(res.notificationWarning);
      }
      await loadParking();
    } catch (err: any) {
      setError(err.message || 'Failed to delete release');
    }
  };

  return (
    <div className="admin-parking-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}
      {warning && <div className="status-box warning-box">{warning}</div>}

      <div className="admin-stacked-sections">
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={releaseSpaceOpen}
            onClick={() => setReleaseSpaceOpen(o => !o)}
          >
            <h2 className="card-section-title">Release Space on Behalf of Staff</h2>
            <span className="collapsible-chevron" aria-hidden="true">{releaseSpaceOpen ? '▾' : '▸'}</span>
          </button>
          {releaseSpaceOpen && (
          <form onSubmit={handleAdminRelease}>
            <div className="form-group">
              <label className="form-label">Staff Space Owner *</label>
              <select
                className="form-control"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
              >
                {eligibleStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} (Bay #{s.parkingSpace}) &mdash; {s.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  className="form-control"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  required
                  min={startDate}
                  className="form-control"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Release space
            </button>
          </form>
          )}
        </section>

        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={allReleasesOpen}
            onClick={() => setAllReleasesOpen(o => !o)}
          >
            <h2 className="card-section-title">All Parking Space Releases ({releases.length})</h2>
            <span className="collapsible-chevron" aria-hidden="true">{allReleasesOpen ? '▾' : '▸'}</span>
          </button>
          {allReleasesOpen && (
          <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bay #</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Reserver</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {releases.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.date}</strong></td>
                    <td>Bay #{r.space}</td>
                    <td>{r.ownerName}</td>
                    <td>
                      {r.reserverUserId ? (
                        <span className="badge badge-warning">Reserved</span>
                      ) : (
                        <span className="badge badge-success">Available</span>
                      )}
                    </td>
                    <td>{r.reserverName || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteRelease(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      </div>
    </div>
  );
};
