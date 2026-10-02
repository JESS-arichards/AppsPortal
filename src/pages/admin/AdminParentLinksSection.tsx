import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { User, PendingParentLink } from '../../types';

// =====================================================================
// PARENT LINKS SECTION
// =====================================================================
export const AdminParentLinksSection: React.FC = () => {
  const [data, setData] = useState<{
    activeLinks: Array<{ parent: User; student: User }>;
    parents: User[];
    students: User[];
  } | null>(null);
  const [pending, setPending] = useState<PendingParentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [pendingLinksOpen, setPendingLinksOpen] = useState(false);

  const [selectedParentId, setSelectedParentId] = useState('');
  const [linkType, setLinkType] = useState<'selector' | 'email'>('selector');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      const [linksRes, pendingRes] = await Promise.all([
        api.get<any>('/api/admin/parent-links'),
        api.get<any>('/api/admin/parent-links/pending'),
      ]);
      setData(linksRes);
      setPending(pendingRes.pending || []);
      if (linksRes.parents?.length > 0 && !selectedParentId) {
        setSelectedParentId(linksRes.parents[0].id);
      }
      if (linksRes.students?.length > 0 && !selectedStudentId) {
        setSelectedStudentId(linksRes.students[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load parent links');
    } finally {
      setLoading(false);
    }
  }, [selectedParentId, selectedStudentId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) return;
    setError(null);
    setSuccess(null);

    try {
      const payload: any = { parentId: selectedParentId };
      if (linkType === 'selector') {
        payload.studentId = selectedStudentId;
      } else {
        payload.studentEmail = studentEmail.trim();
      }

      const res = await api.post<any>('/api/admin/parent-links', payload);
      if (res.type === 'active') {
        setSuccess('Active parent-student link created.');
      } else {
        setSuccess('Student not yet logged in: link stored as pending and will resolve on student sync.');
      }
      setStudentEmail('');
      await loadLinks();
    } catch (err: any) {
      setError(err.message || 'Failed to link accounts');
    }
  };

  const handleUnlink = async (parentId: string, studentId: string) => {
    if (!window.confirm('Are you sure you want to unlink this parent and student?')) return;
    try {
      await api.delete(`/api/admin/parent-links/${parentId}/${studentId}`);
      setSuccess('Parent and student unlinked.');
      await loadLinks();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink');
    }
  };

  const handleCancelPending = async (id: number) => {
    if (!window.confirm('Cancel this pending link?')) return;
    try {
      await api.delete(`/api/admin/parent-links/pending/${id}`);
      setSuccess('Pending link cancelled.');
      await loadLinks();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel pending link');
    }
  };

  return (
    <div className="admin-parent-links-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="admin-stacked-sections">
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={createLinkOpen}
            onClick={() => setCreateLinkOpen(o => !o)}
          >
            <h2 className="card-section-title">Create Parent-Student Link</h2>
            <span className="collapsible-chevron" aria-hidden="true">{createLinkOpen ? '▾' : '▸'}</span>
          </button>
          {createLinkOpen && (
          <form onSubmit={handleCreateLink}>
            <div className="form-group">
              <label className="form-label">Select Parent *</label>
              <select
                className="form-control"
                value={selectedParentId}
                onChange={e => setSelectedParentId(e.target.value)}
              >
                {data?.parents.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Link via:</label>
              <div className="radio-group-horizontal">
                <label className="radio-label-inline">
                  <input
                    type="radio"
                    name="linkType"
                    checked={linkType === 'selector'}
                    onChange={() => setLinkType('selector')}
                  />
                  <span>Select existing student</span>
                </label>
                <label className="radio-label-inline">
                  <input
                    type="radio"
                    name="linkType"
                    checked={linkType === 'email'}
                    onChange={() => setLinkType('email')}
                  />
                  <span>Enter student school email</span>
                </label>
              </div>
            </div>

            {linkType === 'selector' ? (
              <div className="form-group">
                <label className="form-label">Select Student *</label>
                <select
                  className="form-control"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  {data?.students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Student School Email *</label>
                <input
                  type="email"
                  required
                  className="form-control"
                  placeholder="student@student.jess.sch.ae"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Link accounts
            </button>
          </form>
          )}
        </section>

        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={pendingLinksOpen}
            onClick={() => setPendingLinksOpen(o => !o)}
          >
            <h2 className="card-section-title">Pending Links (Order-Independent)</h2>
            <span className="collapsible-chevron" aria-hidden="true">{pendingLinksOpen ? '▾' : '▸'}</span>
          </button>
          {pendingLinksOpen && (
          <>
          <p className="card-hint">
            These links were created before the student first signed in with Microsoft Entra ID. They automatically activate upon the student's first sign-in.
          </p>
          {pending.length > 0 ? (
            <div className="table-responsive">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Parent</th>
                    <th>Pending Student Email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.id}>
                      <td>{p.parentName || p.parentId}</td>
                      <td><strong>{p.studentEmail}</strong></td>
                      <td>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleCancelPending(p.id)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-text">No pending parent links in queue.</p>
          )}
          </>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <h2 className="card-section-title">Active Parent-Student Links</h2>
        {data?.activeLinks && data.activeLinks.length > 0 ? (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Parent Name</th>
                  <th>Parent Email</th>
                  <th>Student Name</th>
                  <th>Student Email</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.activeLinks.map(({ parent, student }) => (
                  <tr key={`${parent.id}_${student.id}`}>
                    <td><strong>{parent.displayName}</strong></td>
                    <td>{parent.email}</td>
                    <td><strong>{student.displayName}</strong></td>
                    <td>{student.email}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleUnlink(parent.id, student.id)}
                      >
                        Unlink
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-text">No active parent-student links configured.</p>
        )}
      </section>
    </div>
  );
};
