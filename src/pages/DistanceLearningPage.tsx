import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ClassEntity, LessonPeriod, DistanceLesson, DistanceLessonResource } from '../types';
import { useAuth } from '../context/AuthContext';
import { LiveRegion } from '../components/LiveRegion';
import { ModalPortal } from '../components/ModalPortal';

interface DayScheduleItem {
  period: LessonPeriod;
  lesson: DistanceLesson | null;
}

interface DayData {
  class: ClassEntity;
  date: string;
  weekday: number;
  schedule: DayScheduleItem[];
}

export const DistanceLearningPage: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [selectedClassCode, setSelectedClassCode] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dayData, setDayData] = useState<DayData | null>(null);

  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lesson Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<LessonPeriod | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [resources, setResources] = useState<DistanceLessonResource[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Load staff classes
  useEffect(() => {
    api.get<{ classes: ClassEntity[] }>('/api/distance-learning/classes')
      .then(res => {
        setClasses(res.classes);
        if (res.classes.length > 0) {
          setSelectedClassCode(res.classes[0].code);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load assigned classes');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const loadDaySchedule = useCallback(async () => {
    if (!selectedClassCode || !selectedDate) return;

    setScheduleLoading(true);
    setError(null);
    try {
      const res = await api.get<DayData>(`/api/distance-learning/day?classCode=${encodeURIComponent(selectedClassCode)}&date=${encodeURIComponent(selectedDate)}`);
      setDayData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load day schedule');
    } finally {
      setScheduleLoading(false);
    }
  }, [selectedClassCode, selectedDate]);

  useEffect(() => {
    if (selectedClassCode) {
      loadDaySchedule();
    }
  }, [selectedClassCode, selectedDate, loadDaySchedule]);

  const canEdit = user?.roles?.includes('Admin') || user?.roles?.includes('Staff');

  const openLessonDialog = (period: LessonPeriod, existingLesson: DistanceLesson | null) => {
    setCurrentPeriod(period);
    setLessonTitle(existingLesson ? existingLesson.title : '');
    setLessonDesc(existingLesson ? existingLesson.description || '' : '');
    setResources(existingLesson && existingLesson.resources ? [...existingLesson.resources] : []);
    setModalError(null);
    setModalOpen(true);
  };

  const closeDialog = () => {
    setModalOpen(false);
    setCurrentPeriod(null);
    setModalError(null);
  };

  const handleAddResource = () => {
    if (resources.length >= 10) {
      setModalError('Maximum 10 resources allowed per lesson.');
      return;
    }
    setResources([...resources, { label: '', url: '', fileData: null, fileName: null, mimeType: null }]);
  };

  const handleRemoveResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const handleResourceFileChange = (index: number, file: File | undefined) => {
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setModalError('Attached files cannot exceed 4 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const updated = [...resources];
      updated[index] = {
        ...updated[index],
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileData: reader.result as string,
      };
      setResources(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || !selectedClassCode || !selectedDate) return;

    if (!lessonTitle.trim()) {
      setModalError('Title is required.');
      return;
    }

    // Validate resources
    for (const r of resources) {
      if (!r.label.trim()) {
        setModalError('Every resource must have a label.');
        return;
      }
      if (!r.url && !r.fileData && !r.hasFile) {
        setModalError('Every resource must include either a URL or an attached file.');
        return;
      }
    }

    setModalSaving(true);
    setModalError(null);

    try {
      await api.put('/api/distance-learning/lessons', {
        classCode: selectedClassCode,
        date: selectedDate,
        periodId: currentPeriod.id,
        title: lessonTitle.trim(),
        description: lessonDesc.trim() || null,
        resources,
      });

      setSuccessMessage('Lesson plan saved successfully.');
      closeDialog();
      await loadDaySchedule();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save lesson');
    } finally {
      setModalSaving(false);
    }
  };

  const handleClearLesson = async () => {
    if (!currentPeriod || !selectedClassCode || !selectedDate) return;
    if (!window.confirm('Are you sure you want to completely clear this lesson and all its resources?')) return;

    setModalSaving(true);
    try {
      await api.delete('/api/distance-learning/lessons', {
        classCode: selectedClassCode,
        date: selectedDate,
        periodId: currentPeriod.id,
      });

      setSuccessMessage('Lesson plan cleared.');
      closeDialog();
      await loadDaySchedule();
    } catch (err: any) {
      setModalError(err.message || 'Failed to clear lesson');
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div className="distance-learning-container">
      <header className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-main)' }}>Distance Learning &amp; Lesson Plans</h1>
        <p className="page-subtitle">Access daily class schedules, learning objectives, and shared educational resources.</p>
      </header>

      <LiveRegion loading={loading} error={error} />

      {successMessage && (
        <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
          <span>✓ {successMessage}</span>
        </div>
      )}

      {/* Filter Bar: Class Selector & Date Picker */}
      <section className="card filter-card">
        <div className="filter-row">
          {/* Class selector - hidden when 1 or fewer classes */}
          {classes.length > 1 && (
            <div className="form-group">
              <label htmlFor="classSelect" className="form-label">Select Class</label>
              <select
                id="classSelect"
                className="form-control"
                value={selectedClassCode}
                onChange={e => setSelectedClassCode(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} &mdash; {c.name || 'Unnamed Class'} ({c.campus})
                  </option>
                ))}
              </select>
            </div>
          )}

          {classes.length === 1 && (
            <div className="single-class-display">
              <span className="form-label">Active Class</span>
              <strong className="class-tag">{classes[0].code} &mdash; {classes[0].name}</strong>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="lessonDateSelect" className="form-label">Select Date</label>
            <input
              id="lessonDateSelect"
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Schedule Period Cards */}
      <LiveRegion loading={scheduleLoading} />

      {dayData && dayData.schedule.length > 0 ? (
        <div className="schedule-cards-grid">
          {dayData.schedule.map(({ period, lesson }) => (
            <article key={period.id} className="period-card card">
              <div className="period-card-header">
                <div>
                  <h2 className="period-title">{period.periodName}</h2>
                  <span className="period-time">{period.startTime} &ndash; {period.endTime}</span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => openLessonDialog(period, lesson)}
                  >
                    {lesson ? 'Edit lesson' : 'Add lesson'}
                  </button>
                )}
              </div>

              {lesson ? (
                <div className="lesson-content">
                  <h3 className="lesson-heading" style={{ color: 'var(--color-main)' }}>{lesson.title}</h3>
                  {lesson.description && (
                    <p className="lesson-description">{lesson.description}</p>
                  )}

                  {lesson.resources && lesson.resources.length > 0 && (
                    <div className="lesson-resources-list">
                      <h4 className="resources-heading">Lesson Resources:</h4>
                      <ul>
                        {lesson.resources.map((res, idx) => (
                          <li key={idx} className="resource-item">
                            {res.url ? (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="resource-link"
                              >
                                🔗 {res.label}
                              </a>
                            ) : res.fileUrl ? (
                              <a
                                href={res.fileUrl}
                                download={res.fileName || 'resource-file'}
                                className="resource-link"
                              >
                                📄 {res.label} ({res.fileName})
                              </a>
                            ) : (
                              <span>{res.label}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-lesson-box">
                  <p className="empty-text">No lesson plan scheduled for this period.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        !scheduleLoading && (
          <div className="card">
            <p className="empty-text">No timetabled lesson periods found for this campus on this weekday.</p>
          </div>
        )
      )}

      {/* Lesson Edit Modal */}
      {modalOpen && currentPeriod && (
        <ModalPortal>
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h3 id="lesson-modal-title" className="modal-title">
                {lessonTitle ? 'Edit Lesson Plan' : 'Add Lesson Plan'} &mdash; {currentPeriod.periodName}
              </h3>
              <button type="button" className="modal-close" onClick={closeDialog} aria-label="Close dialog">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="status-box error-box" role="alert" style={{ margin: '16px 0' }}>
                <span>⚠️ {modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLesson}>
              <div className="form-group">
                <label htmlFor="editLessonTitle" className="form-label">
                  Lesson Title (Max 200 characters) *
                </label>
                <input
                  id="editLessonTitle"
                  type="text"
                  required
                  maxLength={200}
                  className="form-control"
                  placeholder="e.g. Introduction to Data Structures and Algorithms"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="editLessonDesc" className="form-label">
                  Description / Instructions (Max 4,000 characters)
                </label>
                <textarea
                  id="editLessonDesc"
                  maxLength={4000}
                  rows={4}
                  className="form-control"
                  placeholder="Provide lesson objectives, readings, homework expectations, or instructions..."
                  value={lessonDesc}
                  onChange={e => setLessonDesc(e.target.value)}
                />
              </div>

              {/* Resources list */}
              <div className="resources-editor-block">
                <div className="resources-editor-header">
                  <h4 className="form-label">Attached Learning Resources (Max 10)</h4>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleAddResource}
                    disabled={resources.length >= 10}
                  >
                    + Add resource
                  </button>
                </div>

                {resources.map((res, index) => (
                  <div key={index} className="resource-edit-row">
                    <input
                      type="text"
                      required
                      placeholder="Resource Label *"
                      className="form-control"
                      value={res.label}
                      onChange={e => {
                        const updated = [...resources];
                        updated[index].label = e.target.value;
                        setResources(updated);
                      }}
                    />

                    <input
                      type="url"
                      placeholder="External URL (Optional)"
                      className="form-control"
                      value={res.url || ''}
                      onChange={e => {
                        const updated = [...resources];
                        updated[index].url = e.target.value;
                        setResources(updated);
                      }}
                    />

                    <div className="file-col">
                      <label className="btn btn-sm btn-outline file-label">
                        {res.fileName ? `File: ${res.fileName}` : 'Upload file'}
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={e => handleResourceFileChange(index, e.target.files?.[0])}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveResource(index)}
                      title="Remove resource"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="btn btn-danger btn-clear-lesson"
                  onClick={handleClearLesson}
                  disabled={modalSaving}
                >
                  Clear lesson
                </button>

                <div className="modal-right-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeDialog}
                    disabled={modalSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalSaving}
                    style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
                  >
                    {modalSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
