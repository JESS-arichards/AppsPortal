import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { ModalPortal } from '../../components/ModalPortal';
import { User, ClassEntity } from '../../types';

// =====================================================================
// USERS SECTION (Users, User Editor, Bulk Upload, Impersonation)
// =====================================================================
export const AdminUsersSection: React.FC<{ isFullAdmin: boolean }> = ({ isFullAdmin }) => {
  const [data, setData] = useState<{
    staff: User[];
    students: User[];
    parents: User[];
    classes: ClassEntity[];
    availableRoles: string[];
    availableSections: string[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Parent Form state
  const [parentDisplayName, setParentDisplayName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentForename, setParentForename] = useState('');
  const [parentSurname, setParentSurname] = useState('');
  const [parentStudentEmail, setParentStudentEmail] = useState('');

  // Bulk Upload state
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkResults, setBulkResults] = useState<any | null>(null);

  // Collapsible section state - both sections start collapsed
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // User Editor Dialog state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editError, setEditError] = useState<string | null>(null);

  // Impersonation Dialog state
  const [impersonateUser, setImpersonateUser] = useState<User | null>(null);
  const [impersonateMode, setImpersonateMode] = useState<'view' | 'test'>('view');
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/admin/users');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load user directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      await api.post('/api/admin/parents', {
        displayName: parentDisplayName,
        email: parentEmail,
        forename: parentForename || undefined,
        surname: parentSurname || undefined,
        studentEmail: parentStudentEmail || undefined,
      });
      setSuccessMessage(`Parent account created for ${parentDisplayName}.`);
      setParentDisplayName('');
      setParentEmail('');
      setParentForename('');
      setParentSurname('');
      setParentStudentEmail('');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create parent');
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkCsv.trim()) return;
    setError(null);
    try {
      const res = await api.post<any>('/api/admin/parents/bulk', { csvData: bulkCsv });
      setBulkResults(res);
      setSuccessMessage(`Bulk upload completed: ${res.successful} parents added, ${res.failed} failed.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Bulk upload failed');
    }
  };

  const openEditor = (user: User) => {
    setEditingUser(user);
    setEditForm({
      ...user,
      classes: user.classes || [],
      roles: user.roles || [],
      adminSections: user.adminSections || [],
    });
    setEditError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    try {
      if (editingUser.userType === 'Staff') {
        await api.put(`/api/admin/staff/${editingUser.id}`, editForm);
      } else if (editingUser.userType === 'Student') {
        await api.put(`/api/admin/students/${editingUser.id}`, editForm);
      } else if (editingUser.userType === 'Parent') {
        await api.put(`/api/admin/parents/${editingUser.id}`, editForm);
      }
      setSuccessMessage(`User record updated for ${editForm.displayName}.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user');
    }
  };

  const handleStartImpersonation = async () => {
    if (!impersonateUser) return;
    setImpersonateError(null);

    try {
      await api.post('/api/admin/impersonation/start', {
        targetType: impersonateUser.userType,
        targetUserId: impersonateUser.id,
        mode: impersonateMode,
      });
      window.location.href = '/portal';
    } catch (err: any) {
      setImpersonateError(err.message || 'Failed to start impersonation');
    }
  };

  return (
    <div className="admin-users-tab">
      <LiveRegion loading={loading} error={error} />

      {successMessage && (
        <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
          <span>✓ {successMessage}</span>
        </div>
      )}

      {/* Add Parent and Bulk Upload Section - stacked, equal width, collapsible */}
      <div className="admin-stacked-sections">
        {/* Add Single Parent Form */}
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={addParentOpen}
            onClick={() => setAddParentOpen(o => !o)}
          >
            <h2 className="card-section-title">Add Parent Account</h2>
            <span className="collapsible-chevron" aria-hidden="true">{addParentOpen ? '▾' : '▸'}</span>
          </button>
          {addParentOpen && (
          <form onSubmit={handleAddParent}>
            <div className="form-group">
              <label className="form-label">Full Display Name *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. John Doe"
                value={parentDisplayName}
                onChange={e => setParentDisplayName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Parent Email Address *</label>
              <input
                type="email"
                required
                className="form-control"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={e => setParentEmail(e.target.value)}
              />
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Forename (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={parentForename}
                  onChange={e => setParentForename(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Surname (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={parentSurname}
                  onChange={e => setParentSurname(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Link Student School Email (Optional)</label>
              <input
                type="email"
                className="form-control"
                placeholder="student@student.jess.sch.ae"
                value={parentStudentEmail}
                onChange={e => setParentStudentEmail(e.target.value)}
              />
              <p className="form-hint">Links immediately if student exists, or queues pending link automatically.</p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Add parent
            </button>
          </form>
          )}
        </section>

        {/* Bulk Upload Parents */}
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={bulkUploadOpen}
            onClick={() => setBulkUploadOpen(o => !o)}
          >
            <h2 className="card-section-title">Bulk Upload Parents</h2>
            <span className="collapsible-chevron" aria-hidden="true">{bulkUploadOpen ? '▾' : '▸'}</span>
          </button>
          {bulkUploadOpen && (
          <>
          <p className="card-hint">
            Upload CSV/TXT (max 500 lines). Format: <code>displayName, email, forename, surname, studentEmail</code>
          </p>

          <div className="form-group">
            <input
              type="file"
              accept=".csv,.txt"
              className="form-control"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setBulkCsv(reader.result as string);
                  reader.readAsText(file);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">CSV Preview / Input</label>
            <textarea
              rows={4}
              className="form-control code-font"
              value={bulkCsv}
              onChange={e => setBulkCsv(e.target.value)}
              placeholder="Robert Smith, robert@example.com, Robert, Smith, alex@student.jess.sch.ae"
            />
          </div>

          <div className="form-actions-row">
            <button
              type="button"
              disabled={!bulkCsv.trim()}
              className="btn btn-primary"
              onClick={handleBulkUpload}
              style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
            >
              Upload parents
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setBulkCsv('');
                setBulkResults(null);
              }}
            >
              Clear
            </button>
          </div>

          {bulkResults && (
            <div className="bulk-summary-box" style={{ marginTop: '12px' }}>
              <strong>Results:</strong> {bulkResults.successful} succeeded, {bulkResults.failed} failed.
            </div>
          )}
          </>
          )}
        </section>
      </div>

      {/* Users Directory Table */}
      <section className="card" style={{ marginTop: '24px' }}>
        <h2 className="card-section-title">Directory User Accounts</h2>

        {data && (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Roles / Sections</th>
                  <th>Department / Class</th>
                  <th>Parking Space</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Staff */}
                {data.staff.map(s => {
                  const canImpersonate = isFullAdmin && !s.roles?.includes('Admin');
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.displayName}</strong></td>
                      <td><span className="badge badge-primary">Staff</span></td>
                      <td>{s.email}</td>
                      <td>
                        {s.roles?.join(', ')}
                        {s.adminSections && s.adminSections.length > 0 && (
                          <div className="sub-text">Sections: {s.adminSections.join(', ')}</div>
                        )}
                      </td>
                      <td>{s.department || s.jobTitle || '—'}</td>
                      <td>{s.parkingSpace && s.parkingSpace !== 999 ? `#${s.parkingSpace}` : '—'}</td>
                      <td className="actions-cell">
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditor(s)}>
                          View / edit
                        </button>
                        {canImpersonate && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setImpersonateUser(s);
                              setImpersonateMode('view');
                            }}
                          >
                            View as
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Students */}
                {data.students.map(st => (
                  <tr key={st.id}>
                    <td><strong>{st.displayName}</strong></td>
                    <td><span className="badge badge-secondary">Student</span></td>
                    <td>{st.email}</td>
                    <td>Student</td>
                    <td>{st.department || 'Student'} ({st.classes?.length || 0} classes)</td>
                    <td>—</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditor(st)}>
                        View / edit
                      </button>
                      {isFullAdmin && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setImpersonateUser(st);
                            setImpersonateMode('view');
                          }}
                        >
                          View as
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Parents */}
                {data.parents.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.displayName}</strong></td>
                    <td><span className="badge badge-warning">Parent</span></td>
                    <td>{p.email}</td>
                    <td>Parent</td>
                    <td>{p.division || 'Parent Community'}</td>
                    <td>—</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditor(p)}>
                        View / edit
                      </button>
                      {isFullAdmin && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setImpersonateUser(p);
                            setImpersonateMode('view');
                          }}
                        >
                          View as
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* User Editor Modal */}
      {editingUser && (
        <ModalPortal>
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="editor-modal-title">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h3 id="editor-modal-title" className="modal-title">
                Edit User &mdash; {editingUser.displayName} ({editingUser.userType})
              </h3>
              <button type="button" className="modal-close" onClick={() => setEditingUser(null)}>✕</button>
            </div>

            {editError && (
              <div className="status-box error-box" role="alert" style={{ margin: '16px 0' }}>
                <span>⚠️ {editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser}>
              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">Display Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={editForm.displayName || ''}
                    onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    value={editForm.email || ''}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">Forename</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.forename || ''}
                    onChange={e => setEditForm({ ...editForm, forename: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Surname</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.surname || ''}
                    onChange={e => setEditForm({ ...editForm, surname: e.target.value })}
                  />
                </div>
              </div>

              {/* Staff specific fields */}
              {editingUser.userType === 'Staff' && (
                <>
                  <div className="form-row-two">
                    <div className="form-group">
                      <label className="form-label">Job Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.jobTitle || ''}
                        onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.department || ''}
                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-two">
                    <div className="form-group">
                      <label className="form-label">Parking Space (0-999, synced from Entra postal code)</label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        className="form-control"
                        value={editForm.parkingSpace ?? ''}
                        onChange={e => setEditForm({ ...editForm, parkingSpace: e.target.value ? parseInt(e.target.value, 10) : null })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Extension (0-999)</label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        className="form-control"
                        value={editForm.extension ?? ''}
                        onChange={e => setEditForm({ ...editForm, extension: e.target.value ? parseInt(e.target.value, 10) : null })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">MIS ID (synced from Entra employee ID)</label>
                    <input type="text" className="form-control" value={editForm.misId ?? ''} readOnly disabled />
                  </div>

                  {/* Staff Roles (Full Admin only) */}
                  {isFullAdmin && (
                    <div className="form-group">
                      <label className="form-label">Staff Roles (Full Admin Only)</label>
                      <div className="checkboxes-row">
                        {['Admin', 'Staff', 'Onboarding', 'Oasis'].map(role => (
                          <label key={role} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={editForm.roles?.includes(role) || false}
                              onChange={e => {
                                const current = editForm.roles || [];
                                const updated = e.target.checked
                                  ? [...current, role]
                                  : current.filter((r: string) => r !== role);
                                setEditForm({ ...editForm, roles: updated });
                              }}
                            />
                            <span>{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delegated Admin Sections (Full Admin only) */}
                  {isFullAdmin && (
                    <div className="form-group">
                      <label className="form-label">Delegated Admin Section Grants (Full Admin Only)</label>
                      <div className="checkboxes-row">
                        {[
                          { key: 'users', label: 'Users' },
                          { key: 'classes', label: 'Classes' },
                          { key: 'periods', label: 'Lesson Periods' },
                          { key: 'parentLinks', label: 'Parent Links' },
                          { key: 'parking', label: 'Parking' },
                          { key: 'streaming', label: 'Streaming' },
                          { key: 'branding', label: 'Branding' },
                        ].map(sec => (
                          <label key={sec.key} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={editForm.adminSections?.includes(sec.key) || false}
                              onChange={e => {
                                const current = editForm.adminSections || [];
                                const updated = e.target.checked
                                  ? [...current, sec.key]
                                  : current.filter((s: string) => s !== sec.key);
                                setEditForm({ ...editForm, adminSections: updated });
                              }}
                            />
                            <span>{sec.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Class picker for Staff and Students */}
              {(editingUser.userType === 'Staff' || editingUser.userType === 'Student') && data && (
                <div className="form-group">
                  <label className="form-label">Assigned Classes</label>
                  <div className="class-chips-box">
                    {data.classes.map(c => {
                      const isAssigned = editForm.classes?.includes(c.code) || false;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          className={`chip-class ${isAssigned ? 'chip-assigned' : ''}`}
                          onClick={() => {
                            const cur = editForm.classes || [];
                            const updated = isAssigned
                              ? cur.filter((code: string) => code !== c.code)
                              : [...cur, c.code];
                            setEditForm({ ...editForm, classes: updated });
                          }}
                        >
                          {c.code} ({c.campus}) {isAssigned ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Impersonation Dialog ("View as") */}
      {impersonateUser && (
        <ModalPortal>
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="imp-dialog-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="imp-dialog-title" className="modal-title">
                Impersonate User &mdash; {impersonateUser.displayName}
              </h3>
              <button type="button" className="modal-close" onClick={() => setImpersonateUser(null)}>✕</button>
            </div>

            {impersonateError && (
              <div className="status-box error-box" role="alert" style={{ margin: '16px 0' }}>
                <span>⚠️ {impersonateError}</span>
              </div>
            )}

            <p className="card-hint">
              Start an authenticated 30-minute session viewing the portal as{' '}
              <strong>{impersonateUser.displayName}</strong> ({impersonateUser.email}).
            </p>

            <div className="impersonate-modes-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="impMode"
                  value="view"
                  checked={impersonateMode === 'view'}
                  onChange={() => setImpersonateMode('view')}
                />
                <div>
                  <strong>View only</strong>
                  <p className="form-hint">Inspect screens, read schedules, and check permissions. All state changes are strictly blocked.</p>
                </div>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="impMode"
                  value="test"
                  checked={impersonateMode === 'test'}
                  onChange={() => setImpersonateMode('test')}
                />
                <div>
                  <strong>Test actions</strong>
                  <p className="form-hint">Allows real modifications for troubleshooting. Real notifications may be sent; all actions are audited.</p>
                </div>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setImpersonateUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartImpersonation}
                style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
              >
                Start view
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
