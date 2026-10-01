import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LiveRegion } from '../components/LiveRegion';

export const ProfilePage: React.FC = () => {
  const { user, updateUserPicture } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!user) {
    return <LiveRegion loading loadingText="Loading profile details..." />;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    // Validate size (max 4 MB)
    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage('The selected picture exceeds the 4 MB maximum file size.');
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        await updateUserPicture(dataUrl);
        setSuccessMessage('Picture saved.');
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to save profile picture.');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error reading selected image file.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const helpdeskEmail = window.PORTAL_CONFIG?.APP_HELPDESK_EMAIL || 'helpdesk@jess.sch.ae';
  const avatarSrc = user.profilePicture || '/avatar-placeholder.png';

  return (
    <div className="profile-page-container">
      <header className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-main)' }}>My Profile</h1>
        <p className="page-subtitle">View your authenticated account credentials and update your profile photo.</p>
      </header>

      {successMessage && (
        <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
          <span>✓ {successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="status-box error-box" role="alert" style={{ marginBottom: '16px' }}>
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      <div className="profile-grid">
        {/* Profile Picture Card */}
        <div className="profile-picture-card card">
          <div className="profile-avatar-large-wrap">
            <img src={avatarSrc} alt={user.displayName} className="profile-avatar-large" />
          </div>

          <div className="picture-upload-section">
            <label htmlFor="profilePictureInput" className="btn btn-secondary upload-picture-btn">
              {uploading ? 'Uploading picture...' : 'Upload picture'}
            </label>
            <input
              id="profilePictureInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <p className="file-hint">Accepted formats: JPEG, PNG, WebP (max 4 MB)</p>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="profile-details-card card">
          <h2 className="card-section-title" style={{ color: 'var(--color-main)' }}>Account Information</h2>

          <dl className="details-list">
            <div className="detail-row">
              <dt>Full Display Name</dt>
              <dd>{user.displayName}</dd>
            </div>

            <div className="detail-row">
              <dt>Email Address</dt>
              <dd>{user.email}</dd>
            </div>

            {user.forename && (
              <div className="detail-row">
                <dt>First Name</dt>
                <dd>{user.forename}</dd>
              </div>
            )}

            {user.surname && (
              <div className="detail-row">
                <dt>Surname</dt>
                <dd>{user.surname}</dd>
              </div>
            )}

            <div className="detail-row">
              <dt>Account Type</dt>
              <dd>
                <span className="badge badge-primary">{user.userType}</span>
              </dd>
            </div>

            <div className="detail-row">
              <dt>Authentication Provider</dt>
              <dd>{user.authType === 'Entra' ? 'Microsoft Entra ID' : 'Local Verification'}</dd>
            </div>

            {user.division && (
              <div className="detail-row">
                <dt>School Division</dt>
                <dd>{user.division}</dd>
              </div>
            )}

            {/* Staff-specific fields */}
            {user.userType === 'Staff' && (
              <>
                <div className="detail-row">
                  <dt>Job Title</dt>
                  <dd>{user.jobTitle || 'Not assigned'}</dd>
                </div>

                <div className="detail-row">
                  <dt>Department</dt>
                  <dd>{user.department || 'Not assigned'}</dd>
                </div>

                <div className="detail-row">
                  <dt>Assigned Parking Space</dt>
                  <dd>{user.parkingSpace && user.parkingSpace !== 999 ? `#${user.parkingSpace}` : 'None assigned'}</dd>
                </div>

                <div className="detail-row">
                  <dt>Telephone Extension</dt>
                  <dd>{user.extension ? `Ext. ${user.extension}` : 'None assigned'}</dd>
                </div>

                <div className="detail-row">
                  <dt>MIS ID</dt>
                  <dd>{user.misId || 'Not assigned'}</dd>
                </div>

                <div className="detail-row">
                  <dt>Staff Roles</dt>
                  <dd>
                    {user.roles && user.roles.length > 0
                      ? user.roles.join(', ')
                      : 'Staff'}
                  </dd>
                </div>
              </>
            )}

            {/* Student-specific fields */}
            {user.userType === 'Student' && (
              <>
                <div className="detail-row">
                  <dt>Student ID</dt>
                  <dd>{user.id}</dd>
                </div>

                <div className="detail-row">
                  <dt>Department / Year</dt>
                  <dd>{user.department || 'Student'}</dd>
                </div>
              </>
            )}

            {/* Parent-specific linked children */}
            {user.userType === 'Parent' && user.linkedStudents && user.linkedStudents.length > 0 && (
              <div className="detail-row">
                <dt>Linked Children</dt>
                <dd>
                  <ul className="linked-children-list">
                    {user.linkedStudents.map(child => (
                      <li key={child.id}>{child.displayName} ({child.email})</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          <div className="profile-helpdesk-note">
            <p>
              Account credentials and directory roles are managed centrally. If any details are incorrect, please{' '}
              <a href={`mailto:${helpdeskEmail}?subject=Profile%20Update%20Request`} className="helpdesk-link">
                contact the JESS Helpdesk
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
