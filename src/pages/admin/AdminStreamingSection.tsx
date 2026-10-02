import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { ModalPortal } from '../../components/ModalPortal';
import { StreamItem } from '../../types';

// =====================================================================
// STREAMING SECTION
// =====================================================================
export const AdminStreamingSection: React.FC = () => {
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
