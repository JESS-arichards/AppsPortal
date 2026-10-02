import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { ClassEntity } from '../../types';

// =====================================================================
// CLASSES SECTION
// =====================================================================
export const AdminClassesSection: React.FC = () => {
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [campus, setCampus] = useState<'ARP' | 'JJ' | 'ARS'>('ARP');
  const [name, setName] = useState('');

  // Collapsible section state - both sections start collapsed
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [registeredClassesOpen, setRegisteredClassesOpen] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const res = await api.get<{ classes: ClassEntity[] }>('/api/admin/classes');
      setClasses(res.classes);
    } catch (err: any) {
      setError(err.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post('/api/admin/classes', { code, campus, name: name || undefined });
      setSuccess(`Class ${code.toUpperCase()} successfully saved.`);
      setCode('');
      setName('');
      await loadClasses();
    } catch (err: any) {
      setError(err.message || 'Failed to add class');
    }
  };

  const handleDeleteClass = async (classCode: string) => {
    if (!window.confirm(`Delete class ${classCode}? This will remove class assignments for staff and students.`)) return;
    setError(null);
    try {
      await api.delete(`/api/admin/classes/${classCode}`);
      setSuccess(`Class ${classCode} deleted.`);
      await loadClasses();
    } catch (err: any) {
      setError(err.message || 'Failed to delete class');
    }
  };

  return (
    <div className="admin-classes-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="admin-stacked-sections">
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={addClassOpen}
            onClick={() => setAddClassOpen(o => !o)}
          >
            <h2 className="card-section-title">Add / Update Class</h2>
            <span className="collapsible-chevron" aria-hidden="true">{addClassOpen ? '▾' : '▸'}</span>
          </button>
          {addClassOpen && (
          <form onSubmit={handleAddClass}>
            <div className="form-group">
              <label className="form-label">Class Code (e.g. 10-CSC-1) *</label>
              <input
                type="text"
                required
                pattern="[A-Za-z0-9-]{1,20}"
                maxLength={20}
                className="form-control"
                placeholder="10-CSC-1"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
              <p className="form-hint">Alphanumeric with dashes, max 20 chars.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Campus *</label>
              <select className="form-control" value={campus} onChange={e => setCampus(e.target.value as any)}>
                <option value="ARP">ARP (Arabian Ranches Primary)</option>
                <option value="ARS">ARS (Arabian Ranches Secondary)</option>
                <option value="JJ">JJ (Jumeirah Primary)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Class Name (Optional)</label>
              <input
                type="text"
                maxLength={100}
                className="form-control"
                placeholder="Year 10 Computer Science"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Add / update class
            </button>
          </form>
          )}
        </section>

        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={registeredClassesOpen}
            onClick={() => setRegisteredClassesOpen(o => !o)}
          >
            <h2 className="card-section-title">Registered Classes ({classes.length})</h2>
            <span className="collapsible-chevron" aria-hidden="true">{registeredClassesOpen ? '▾' : '▸'}</span>
          </button>
          {registeredClassesOpen && (
          <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Campus</th>
                  <th>Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.code}>
                    <td><strong>{c.code}</strong></td>
                    <td><span className="badge badge-primary">{c.campus}</span></td>
                    <td>{c.name || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteClass(c.code)}>
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
