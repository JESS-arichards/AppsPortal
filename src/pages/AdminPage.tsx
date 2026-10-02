import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { api } from '../services/api';
import { LiveRegion } from '../components/LiveRegion';
import { ModalPortal } from '../components/ModalPortal';
import { CoreValueIcon } from '../components/CoreValueIcon';
import {
  MAX_CORE_VALUES,
  MAX_ICON_TEXT_LENGTH,
  isImageIcon,
  parseCoreValues,
  resizeIconImage,
} from '../utils/coreValues';
import {
  User,
  ClassEntity,
  LessonPeriod,
  PendingParentLink,
  ParkingRelease,
  StreamItem,
  Branding,
  HomeContent,
  LoginContent,
  CoreValue,
} from '../types';

type AdminTab = 'users' | 'classes' | 'periods' | 'parentLinks' | 'parking' | 'streaming' | 'branding';

export const AdminPage: React.FC = () => {
  const { user, impersonation, refreshUser } = useAuth();
  const { branding, refreshBranding } = useBranding();

  const isFullAdmin = user?.roles?.includes('Admin') || false;
  const userSections = user?.adminSections || [];

  // Determine permitted tabs
  const permittedTabs: AdminTab[] = useMemo(() => {
    const allTabs: AdminTab[] = ['users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'];
    if (isFullAdmin) return allTabs;
    return allTabs.filter(t => userSections.includes(t));
  }, [isFullAdmin, userSections]);

  const [activeTab, setActiveTab] = useState<AdminTab>(permittedTabs[0] || 'users');

  // Ensure active tab is allowed
  useEffect(() => {
    if (permittedTabs.length > 0 && !permittedTabs.includes(activeTab)) {
      setActiveTab(permittedTabs[0]);
    }
  }, [permittedTabs, activeTab]);

  if (!user || permittedTabs.length === 0 || impersonation?.active) {
    return (
      <div className="admin-page-container">
        <div className="status-box error-box" role="alert">
          <span>⚠️ Access Denied: Administrator permissions required.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <header className="page-header">
        <div className="page-header-flex">
          <div>
            <h1 className="page-title" style={{ color: 'var(--color-main)' }}>Administration Console</h1>
            <p className="page-subtitle">Centralized maintenance for users, curriculum, links, parking, streaming, and school branding.</p>
          </div>
          {isFullAdmin && (
            <span className="badge badge-primary">Full Administrator</span>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="admin-tab-nav" aria-label="Admin console navigation">
        <div className="tab-buttons-list" role="tablist">
          {permittedTabs.includes('users') && (
            <button
              role="tab"
              aria-selected={activeTab === 'users'}
              className={`tab-btn ${activeTab === 'users' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users
            </button>
          )}

          {permittedTabs.includes('classes') && (
            <button
              role="tab"
              aria-selected={activeTab === 'classes'}
              className={`tab-btn ${activeTab === 'classes' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              🏫 Classes
            </button>
          )}

          {permittedTabs.includes('periods') && (
            <button
              role="tab"
              aria-selected={activeTab === 'periods'}
              className={`tab-btn ${activeTab === 'periods' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('periods')}
            >
              ⏰ Lesson Periods
            </button>
          )}

          {permittedTabs.includes('parentLinks') && (
            <button
              role="tab"
              aria-selected={activeTab === 'parentLinks'}
              className={`tab-btn ${activeTab === 'parentLinks' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('parentLinks')}
            >
              🔗 Parent Links
            </button>
          )}

          {permittedTabs.includes('parking') && (
            <button
              role="tab"
              aria-selected={activeTab === 'parking'}
              className={`tab-btn ${activeTab === 'parking' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('parking')}
            >
              🚗 Parking
            </button>
          )}

          {permittedTabs.includes('streaming') && (
            <button
              role="tab"
              aria-selected={activeTab === 'streaming'}
              className={`tab-btn ${activeTab === 'streaming' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('streaming')}
            >
              📺 Streaming
            </button>
          )}

          {permittedTabs.includes('branding') && (
            <button
              role="tab"
              aria-selected={activeTab === 'branding'}
              className={`tab-btn ${activeTab === 'branding' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('branding')}
            >
              🎨 Branding &amp; Content
            </button>
          )}
        </div>
      </nav>

      {/* Tab Panels */}
      <main className="admin-tab-content">
        {activeTab === 'users' && <AdminUsersSection isFullAdmin={isFullAdmin} />}
        {activeTab === 'classes' && <AdminClassesSection />}
        {activeTab === 'periods' && <AdminPeriodsSection />}
        {activeTab === 'parentLinks' && <AdminParentLinksSection />}
        {activeTab === 'parking' && <AdminParkingSection />}
        {activeTab === 'streaming' && <AdminStreamingSection />}
        {activeTab === 'branding' && <AdminBrandingSection refreshBranding={refreshBranding} />}
      </main>
    </div>
  );
};

// =====================================================================
// USERS SECTION (Users, User Editor, Bulk Upload, Impersonation)
// =====================================================================
const AdminUsersSection: React.FC<{ isFullAdmin: boolean }> = ({ isFullAdmin }) => {
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

// =====================================================================
// CLASSES SECTION
// =====================================================================
const AdminClassesSection: React.FC = () => {
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

// =====================================================================
// PERIODS SECTION
// =====================================================================
const AdminPeriodsSection: React.FC = () => {
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

// =====================================================================
// PARENT LINKS SECTION
// =====================================================================
const AdminParentLinksSection: React.FC = () => {
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

// =====================================================================
// ADMIN PARKING SECTION
// =====================================================================
const AdminParkingSection: React.FC = () => {
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

// =====================================================================
// STREAMING SECTION
// =====================================================================
const AdminStreamingSection: React.FC = () => {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<StreamItem | null>(null);

  // Stream Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryChips, setCategoryChips] = useState<string[]>(['Sports', 'Music', 'Academics', 'Live Broadcast']);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [streamType, setStreamType] = useState<'On Demand' | 'Live'>('On Demand');
  const [accessType, setAccessType] = useState<'Free to Air' | 'Pay Per View'>('Free to Air');
  const [active, setActive] = useState(true);
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadStreams = useCallback(async () => {
    try {
      const res = await api.get<{ streams: StreamItem[] }>('/api/admin/streams');
      setStreams(res.streams || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load video streams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  const openAddDialog = () => {
    setEditingStream(null);
    setTitle('');
    setDescription('');
    setSelectedCats([]);
    setStreamType('On Demand');
    setAccessType('Free to Air');
    setActive(true);
    setVideoUrl('');
    setThumbnailUrl(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (stream: StreamItem) => {
    setEditingStream(stream);
    setTitle(stream.title);
    setDescription(stream.description || '');
    const cats = stream.categories.split(',').map(c => c.trim()).filter(Boolean);
    setSelectedCats(cats);
    setStreamType(stream.streamType);
    setAccessType(stream.accessType);
    setActive(stream.active);
    setVideoUrl(stream.videoUrl);
    setThumbnailUrl(stream.thumbnailUrl || null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleAddNewCategory = () => {
    const clean = newCatInput.trim();
    if (!clean) return;
    if (!categoryChips.includes(clean)) {
      setCategoryChips([...categoryChips, clean]);
    }
    if (!selectedCats.includes(clean)) {
      setSelectedCats([...selectedCats, clean]);
    }
    setNewCatInput('');
  };

  const handleThumbnailFile = (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setDialogError('Thumbnail file exceeds 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setThumbnailUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    try {
      const payload = {
        title,
        description,
        categories: selectedCats.join(', '),
        streamType,
        accessType,
        active,
        videoUrl,
        thumbnailUrl,
      };

      if (editingStream) {
        await api.put(`/api/admin/streams/${editingStream.id}`, payload);
        setSuccess(`Stream "${title}" updated.`);
      } else {
        await api.post('/api/admin/streams', payload);
        setSuccess(`New stream "${title}" added to catalogue.`);
      }
      setDialogOpen(false);
      await loadStreams();
    } catch (err: any) {
      setDialogError(err.message || 'Failed to save stream');
    }
  };

  const handleDeleteStream = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this video entry?')) return;
    try {
      await api.delete(`/api/admin/streams/${id}`);
      setSuccess('Stream deleted.');
      await loadStreams();
    } catch (err: any) {
      setError(err.message || 'Failed to delete stream');
    }
  };

  return (
    <div className="admin-streaming-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="card-header-flex" style={{ marginBottom: '16px' }}>
        <h2 className="card-section-title">Streaming Media Catalogue</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openAddDialog}
          style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
        >
          + Add video
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Access</th>
                <th>Categories</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {streams.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong></td>
                  <td><span className="badge badge-primary">{s.streamType}</span></td>
                  <td>{s.accessType}</td>
                  <td>{s.categories}</td>
                  <td>{s.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-secondary">Inactive</span>}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEditDialog(s)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteStream(s.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stream Add / Edit Dialog */}
      {dialogOpen && (
        <ModalPortal>
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="stream-dialog-title">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h3 id="stream-dialog-title" className="modal-title">
                {editingStream ? 'Edit Video Stream' : 'Add New Video Stream'}
              </h3>
              <button type="button" className="modal-close" onClick={() => setDialogOpen(false)}>✕</button>
            </div>

            {dialogError && (
              <div className="status-box error-box" role="alert" style={{ margin: '16px 0' }}>
                <span>⚠️ {dialogError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStream}>
              <div className="form-group">
                <label className="form-label">Video Title (Max 200) *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  className="form-control"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              {/* Categories */}
              <div className="form-group">
                <label className="form-label">Categories</label>
                <div className="checkboxes-row">
                  {categoryChips.map(cat => (
                    <label key={cat} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedCats.includes(cat)}
                        onChange={e => {
                          if (e.target.checked) setSelectedCats([...selectedCats, cat]);
                          else setSelectedCats(selectedCats.filter(c => c !== cat));
                        }}
                      />
                      <span>{cat}</span>
                    </label>
                  ))}
                </div>

                <div className="form-actions-row" style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="New category..."
                    className="form-control form-control-sm"
                    value={newCatInput}
                    onChange={e => setNewCatInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-sm btn-secondary" onClick={handleAddNewCategory}>
                    Add category
                  </button>
                </div>
              </div>

              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">Stream Type *</label>
                  <select className="form-control" value={streamType} onChange={e => setStreamType(e.target.value as any)}>
                    <option value="On Demand">On Demand</option>
                    <option value="Live">Live</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Access Model *</label>
                  <select className="form-control" value={accessType} onChange={e => setAccessType(e.target.value as any)}>
                    <option value="Free to Air">Free to Air</option>
                    <option value="Pay Per View">Pay Per View</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
                  <span>Active in catalogue</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Video URL or Castr Iframe Embed Code *</label>
                <textarea
                  rows={2}
                  required
                  className="form-control code-font"
                  placeholder="https://...m3u8 or <iframe src='https://...'></iframe>"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <p className="form-hint">Accepts raw HTTPS .m3u8 HLS URLs or Castr iframe embed snippets.</p>
              </div>

              {/* Thumbnail file or URL */}
              <div className="form-group">
                <label className="form-label">Thumbnail Image (Upload File or Enter URL)</label>
                <div className="form-actions-row">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="form-control"
                    onChange={e => handleThumbnailFile(e.target.files?.[0])}
                  />
                  {thumbnailUrl && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setThumbnailUrl(null)}>
                      Remove image
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (Max 2,000)</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  className="form-control"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setDialogOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
                  Save video
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

// =====================================================================
// BRANDING & CONTENT SECTION
// =====================================================================
const AdminBrandingSection: React.FC<{ refreshBranding: () => Promise<void> }> = ({ refreshBranding }) => {
  const [brandingData, setBrandingData] = useState<Branding>({
    id: 1,
    mainColor: '#002B49',
    accentColor: '#BA9B37',
    textColor: '#212529',
    navBgColor: null,
    navTextColor: null,
    heroBgColor: null,
    heroTextColor: null,
    navLogo: null,
    favicon: null,
  });

  const [homeData, setHomeData] = useState<HomeContent | null>(null);
  const [loginData, setLoginData] = useState<LoginContent | null>(null);
  const [valuesArray, setValuesArray] = useState<CoreValue[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [homeContentOpen, setHomeContentOpen] = useState(false);
  const [loginContentOpen, setLoginContentOpen] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      const [brandRes, homeRes, loginRes] = await Promise.all([
        api.get<{ branding: Branding }>('/api/branding'),
        api.get<{ content: HomeContent }>('/api/home-content'),
        api.get<{ content: LoginContent }>('/api/login-content'),
      ]);
      setBrandingData(brandRes.branding);
      setHomeData(homeRes.content);
      setLoginData(loginRes.content);
      setValuesArray(parseCoreValues(loginRes.content.valuesJson));
    } catch (err: any) {
      setError(err.message || 'Failed to load branding and content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Contrast Ratio Calculation helper
  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };

  const getContrast = (fg: string, bg: string) => {
    try {
      const l1 = getLuminance(fg);
      const l2 = getLuminance(bg);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      return (brightest + 0.05) / (darkest + 0.05);
    } catch {
      return 1;
    }
  };

  const effectiveNavBg = brandingData.navBgColor || brandingData.mainColor;
  const effectiveNavText = brandingData.navTextColor || '#FFFFFF';
  const navContrast = getContrast(effectiveNavText, effectiveNavBg);

  const effectiveHeroBg = brandingData.heroBgColor || brandingData.mainColor;
  const effectiveHeroText = brandingData.heroTextColor || '#FFFFFF';
  const heroContrast = getContrast(effectiveHeroText, effectiveHeroBg);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (navContrast < 4.5 || heroContrast < 4.5) {
      setError('Save blocked: Tested contrast ratio is below WCAG AA minimum of 4.5:1');
      return;
    }

    try {
      await api.put('/api/admin/branding', brandingData);
      setSuccess('Portal branding saved.');
      await refreshBranding();
    } catch (err: any) {
      setError(err.message || 'Failed to save branding');
    }
  };

  const handleSaveHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeData) return;
    setError(null);
    setSuccess(null);
    try {
      await api.put('/api/admin/home-content', homeData);
      setSuccess('Home page content saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save home content');
    }
  };

  const handleSaveLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData) return;
    setError(null);
    setSuccess(null);
    try {
      const values = valuesArray
        .map(v => ({ text: v.text.trim(), icon: v.icon || null }))
        .filter(v => v.text.length > 0);
      await api.put('/api/admin/login-content', {
        ...loginData,
        values,
      });
      setSuccess('Sign-in page content saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save sign-in content');
    }
  };

  const updateValue = (index: number, patch: Partial<CoreValue>) => {
    setValuesArray(prev => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const moveValue = (index: number, delta: number) => {
    setValuesArray(prev => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleValueIconUpload = async (index: number, file?: File) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Core value icon must be an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Core value icon exceeds 2 MB limit');
      return;
    }
    try {
      updateValue(index, { icon: await resizeIconImage(file) });
    } catch (err: any) {
      setError(err.message || 'Failed to process icon image');
    }
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Navigation logo exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingData({ ...brandingData, navLogo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Favicon exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingData({ ...brandingData, favicon: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleHeroImageUpload = (file?: File) => {
    if (!file || !homeData) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Hero image exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHomeData({ ...homeData, heroImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="admin-branding-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="admin-stacked-sections">
        {/* 1. Branding Form */}
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={colorPaletteOpen}
            onClick={() => setColorPaletteOpen(o => !o)}
          >
            <h2 className="card-section-title">Color Palette &amp; Logos</h2>
            <span className="collapsible-chevron" aria-hidden="true">{colorPaletteOpen ? '▾' : '▸'}</span>
          </button>
          {colorPaletteOpen && (
        <form onSubmit={handleSaveBranding}>
          <div className="form-row-three">
            <div className="form-group">
              <label className="form-label">Main Brand Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, mainColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, mainColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Accent Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.accentColor}
                  onChange={e => setBrandingData({ ...brandingData, accentColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.accentColor}
                  onChange={e => setBrandingData({ ...brandingData, accentColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Text Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.textColor}
                  onChange={e => setBrandingData({ ...brandingData, textColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.textColor}
                  onChange={e => setBrandingData({ ...brandingData, textColor: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Optional Surface Overrides */}
          <h3 className="subheading" style={{ marginTop: '16px' }}>Surface Color Overrides &amp; Contrast Validation</h3>
          <div className="form-row-two">
            <div className="form-group">
              <label className="form-label">Navigation Background (Optional)</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.navBgColor || brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, navBgColor: e.target.value })}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Auto-derived"
                  value={brandingData.navBgColor || ''}
                  onChange={e => setBrandingData({ ...brandingData, navBgColor: e.target.value || null })}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navBgColor: null })}
                  title="Reset to automatic derivation"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Navigation Text (Optional)</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.navTextColor || '#FFFFFF'}
                  onChange={e => setBrandingData({ ...brandingData, navTextColor: e.target.value })}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="#FFFFFF"
                  value={brandingData.navTextColor || ''}
                  onChange={e => setBrandingData({ ...brandingData, navTextColor: e.target.value || null })}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navTextColor: null })}
                  title="Reset to automatic derivation"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Live Contrast Previews */}
          <div className="contrast-preview-grid">
            <div className="preview-box" style={{ backgroundColor: effectiveNavBg, color: effectiveNavText }}>
              <span>Navigation Preview Text</span>
              <span className={`contrast-badge ${navContrast >= 4.5 ? 'pass' : 'fail'}`}>
                Ratio: {navContrast.toFixed(2)}:1 {navContrast >= 4.5 ? '✓ Pass (AA)' : '✕ Fail (< 4.5)'}
              </span>
            </div>

            <div className="preview-box" style={{ backgroundColor: effectiveHeroBg, color: effectiveHeroText }}>
              <span>Hero Preview Headline</span>
              <span className={`contrast-badge ${heroContrast >= 4.5 ? 'pass' : 'fail'}`}>
                Ratio: {heroContrast.toFixed(2)}:1 {heroContrast >= 4.5 ? '✓ Pass (AA)' : '✕ Fail (< 4.5)'}
              </span>
            </div>
          </div>

          {/* Navigation Logo and Favicon Pickers */}
          <div className="form-row-two" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">Navigation Brand Logo (PNG/JPEG/WebP, Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="form-control"
                  onChange={e => handleLogoUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navLogo: null })}
                >
                  Use default logo
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Browser Favicon (PNG/JPEG/WebP, Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon"
                  className="form-control"
                  onChange={e => handleFaviconUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, favicon: null })}
                >
                  Use default icon
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={navContrast < 4.5 || heroContrast < 4.5}
              style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
            >
              Save branding
            </button>
          </div>
        </form>
          )}
        </section>

        {/* 2. Home Page Editor */}
        {homeData && (
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={homeContentOpen}
            onClick={() => setHomeContentOpen(o => !o)}
          >
            <h2 className="card-section-title">Home Page Content Editor</h2>
            <span className="collapsible-chevron" aria-hidden="true">{homeContentOpen ? '▾' : '▸'}</span>
          </button>
          {homeContentOpen && (
          <form onSubmit={handleSaveHome}>
            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Hero Eyebrow Label (Max 120)</label>
                <input
                  type="text"
                  maxLength={120}
                  className="form-control"
                  value={homeData.heroLabel}
                  onChange={e => setHomeData({ ...homeData, heroLabel: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hero Headline (Max 200) *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  className="form-control"
                  value={homeData.heroHeadline}
                  onChange={e => setHomeData({ ...homeData, heroHeadline: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Hero Introduction (Max 1,000)</label>
              <textarea
                rows={2}
                maxLength={1000}
                className="form-control"
                value={homeData.heroIntro}
                onChange={e => setHomeData({ ...homeData, heroIntro: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hero Image (Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="form-control"
                  onChange={e => handleHeroImageUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setHomeData({ ...homeData, heroImage: null })}
                >
                  Use default image
                </button>
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Caption Attribution Name</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control"
                  value={homeData.captionName}
                  onChange={e => setHomeData({ ...homeData, captionName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Caption Attribution Role</label>
                <input
                  type="text"
                  maxLength={100}
                  className="form-control"
                  value={homeData.captionRole}
                  onChange={e => setHomeData({ ...homeData, captionRole: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Welcome Section Heading (Max 250) *</label>
              <input
                type="text"
                required
                maxLength={250}
                className="form-control"
                value={homeData.welcomeHeading}
                onChange={e => setHomeData({ ...homeData, welcomeHeading: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Welcome Body Message (Max 12,000 characters; blank lines separate paragraphs) *</label>
              <textarea
                rows={6}
                required
                maxLength={12000}
                className="form-control"
                value={homeData.welcomeMessage}
                onChange={e => setHomeData({ ...homeData, welcomeMessage: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Save home page
            </button>
          </form>
          )}
        </section>
        )}

        {/* 3. Sign-In Page Editor */}
        {loginData && (
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={loginContentOpen}
            onClick={() => setLoginContentOpen(o => !o)}
          >
            <h2 className="card-section-title">Sign-In Page Content Editor</h2>
            <span className="collapsible-chevron" aria-hidden="true">{loginContentOpen ? '▾' : '▸'}</span>
          </button>
          {loginContentOpen && (
          <form onSubmit={handleSaveLogin}>
            <div className="form-group">
              <label className="form-label">Welcome Headline (Max 200)</label>
              <input
                type="text"
                maxLength={200}
                className="form-control"
                value={loginData.welcomeHeadline}
                onChange={e => setLoginData({ ...loginData, welcomeHeadline: e.target.value })}
              />
            </div>

            {/* Values are displayed in the order listed */}
            <fieldset className="form-group core-values-editor">
              <legend className="form-label">
                Sign-In Page Core Values (display order; up to {MAX_CORE_VALUES})
              </legend>
              <p className="form-hint">
                Each value shows a small icon. Leave it as the default diamond, type an emoji or symbol, or upload an
                image (PNG/JPEG/WebP/SVG, max 2 MB) — uploads are automatically scaled to fit the icon size.
              </p>
              <ul className="core-values-editor-list">
                {valuesArray.map((val, idx) => {
                  const hasImage = isImageIcon(val.icon);
                  return (
                    <li key={idx} className="core-value-row">
                      <div className="core-value-preview" title="Icon preview">
                        <CoreValueIcon icon={val.icon} />
                      </div>
                      <input
                        type="text"
                        maxLength={50}
                        required
                        className="form-control core-value-text"
                        aria-label={`Core value ${idx + 1} text`}
                        placeholder="Value text"
                        value={val.text}
                        onChange={e => updateValue(idx, { text: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-control core-value-symbol"
                        aria-label={`Core value ${idx + 1} emoji or symbol icon`}
                        placeholder="◆"
                        title="Emoji or symbol (leave blank for the default diamond)"
                        value={hasImage ? '' : val.icon || ''}
                        disabled={hasImage}
                        onChange={e => {
                          const chars = Array.from(e.target.value).slice(0, MAX_ICON_TEXT_LENGTH).join('');
                          updateValue(idx, { icon: chars.trim() ? chars : null });
                        }}
                      />
                      <div className="core-value-actions">
                        <label className="btn btn-sm btn-secondary core-value-upload">
                          {hasImage ? 'Replace image' : 'Upload image'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            aria-label={`Upload icon image for core value ${idx + 1}`}
                            onChange={e => {
                              handleValueIconUpload(idx, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={!val.icon}
                          onClick={() => updateValue(idx, { icon: null })}
                        >
                          Default icon
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          aria-label={`Move core value ${idx + 1} up`}
                          disabled={idx === 0}
                          onClick={() => moveValue(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          aria-label={`Move core value ${idx + 1} down`}
                          disabled={idx === valuesArray.length - 1}
                          onClick={() => moveValue(idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          aria-label={`Remove core value ${idx + 1}`}
                          onClick={() => setValuesArray(prev => prev.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={valuesArray.length >= MAX_CORE_VALUES}
                onClick={() => setValuesArray(prev => [...prev, { text: '', icon: null }])}
              >
                + Add value
              </button>
            </fieldset>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Staff Choice Title</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control"
                  value={loginData.staffChoiceTitle}
                  onChange={e => setLoginData({ ...loginData, staffChoiceTitle: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Choice Title</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control"
                  value={loginData.parentChoiceTitle}
                  onChange={e => setLoginData({ ...loginData, parentChoiceTitle: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Save sign-in page
            </button>
          </form>
          )}
        </section>
        )}
      </div>
    </div>
  );
};
