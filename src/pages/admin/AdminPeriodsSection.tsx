import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { LessonPeriod } from '../../types';

// =====================================================================
// PERIODS SECTION
// =====================================================================
export const AdminPeriodsSection: React.FC = () => {
  const [periods, setPeriods] = useState<LessonPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addPeriodOpen, setAddPeriodOpen] = useState(false);
  const [configuredPeriodsOpen, setConfiguredPeriodsOpen] = useState(false);

  const [campus, setCampus] = useState<'ARP' | 'JJ' | 'ARS'>('ARP');
  const [weekday, setWeekday] = useState('1');
  const [periodName, setPeriodName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:50');
  const [sortOrder, setSortOrder] = useState('1');

  const loadPeriods = useCallback(async () => {
    try {
      const res = await api.get<{ periods: LessonPeriod[] }>('/api/admin/periods');
      setPeriods(res.periods);
    } catch (err: any) {
      setError(err.message || 'Failed to load lesson periods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post('/api/admin/periods', {
        campus,
        weekday: parseInt(weekday, 10),
        periodName,
        startTime,
        endTime,
        sortOrder: parseInt(sortOrder, 10),
      });
      setSuccess(`Period "${periodName}" added.`);
      setPeriodName('');
      await loadPeriods();
    } catch (err: any) {
      setError(err.message || 'Failed to add lesson period');
    }
  };

  const handleDeletePeriod = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this period? Distance learning lessons tied to it will be cleared.')) return;
    try {
      await api.delete(`/api/admin/periods/${id}`);
      setSuccess('Period deleted.');
      await loadPeriods();
    } catch (err: any) {
      setError(err.message || 'Failed to delete period');
    }
  };

  const weekdayLabels: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
  };

  return (
    <div className="admin-periods-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="admin-stacked-sections">
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={addPeriodOpen}
            onClick={() => setAddPeriodOpen(o => !o)}
          >
            <h2 className="card-section-title">Add Lesson Period</h2>
            <span className="collapsible-chevron" aria-hidden="true">{addPeriodOpen ? '▾' : '▸'}</span>
          </button>
          {addPeriodOpen && (
          <form onSubmit={handleAddPeriod}>
            <div className="form-group">
              <label className="form-label">Campus *</label>
              <select className="form-control" value={campus} onChange={e => setCampus(e.target.value as any)}>
                <option value="ARP">ARP (Primary)</option>
                <option value="ARS">ARS (Secondary)</option>
                <option value="JJ">JJ (Jumeirah)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Weekday *</label>
              <select className="form-control" value={weekday} onChange={e => setWeekday(e.target.value)}>
                <option value="1">Monday (1)</option>
                <option value="2">Tuesday (2)</option>
                <option value="3">Wednesday (3)</option>
                <option value="4">Thursday (4)</option>
                <option value="5">Friday (5)</option>
                <option value="6">Saturday (6)</option>
                <option value="7">Sunday (7)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Period Name (Max 50) *</label>
              <input
                type="text"
                required
                maxLength={50}
                className="form-control"
                placeholder="Period 1: Mathematics"
                value={periodName}
                onChange={e => setPeriodName(e.target.value)}
              />
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Start Time (HH:MM) *</label>
                <input
                  type="text"
                  required
                  pattern="\d{2}:\d{2}"
                  className="form-control"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Time (HH:MM) *</label>
                <input
                  type="text"
                  required
                  pattern="\d{2}:\d{2}"
                  className="form-control"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sort Order (0-999)</label>
              <input
                type="number"
                min={0}
                max={999}
                className="form-control"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Add period
            </button>
          </form>
          )}
        </section>

        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={configuredPeriodsOpen}
            onClick={() => setConfiguredPeriodsOpen(o => !o)}
          >
            <h2 className="card-section-title">Configured Timetable Periods</h2>
            <span className="collapsible-chevron" aria-hidden="true">{configuredPeriodsOpen ? '▾' : '▸'}</span>
          </button>
          {configuredPeriodsOpen && (
          <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Campus</th>
                  <th>Day</th>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Order</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id}>
                    <td><span className="badge badge-primary">{p.campus}</span></td>
                    <td>{weekdayLabels[p.weekday] || p.weekday}</td>
                    <td><strong>{p.periodName}</strong></td>
                    <td>{p.startTime} - {p.endTime}</td>
                    <td>{p.sortOrder}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeletePeriod(p.id)}>
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
