import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { api, ApiError } from '../services/api';
import { LoginContent } from '../types';

export const SignInPage: React.FC = () => {
  const { user, loginWithEntra, verifyParentCode, devLoginAs } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [content, setContent] = useState<LoginContent>({
    id: 1,
    welcomeLabel: 'JESS Dubai',
    welcomeHeadline: 'Welcome to the School Community Portal',
    valuesJson: JSON.stringify(['Commitment', 'Respect', 'Excellence', 'Care', 'Integrity', 'Curiosity']),
    signInHeading: 'Sign in to JESS Portal',
    signInIntro: 'Choose your login method below to access school services.',
    staffChoiceTitle: 'Staff & Students',
    staffChoiceDescription: 'Sign in with your official school Microsoft account.',
    parentChoiceTitle: 'Parents & Guardians',
    parentChoiceDescription: 'Access your parent account using a secure one-time verification code.',
    parentEmailLabel: 'Registered Parent Email Address',
    parentCodeLabel: '6-Digit One-Time Verification Code',
    sendCodeLabel: 'Send Verification Code',
    verifyCodeLabel: 'Verify and Continue',
    resendCodeLabel: 'Resend Code',
    helpPrompt: 'Need assistance accessing your account?',
    helpLinkText: 'Contact JESS IT Helpdesk',
  });

  const [parentFormExpanded, setParentFormExpanded] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [parentCode, setParentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNotFoundDialog, setShowNotFoundDialog] = useState(false);

  useEffect(() => {
    api.get<{ content: LoginContent }>('/api/login-content')
      .then(res => {
        if (res.content) setContent(res.content);
      })
      .catch(() => {});
  }, []);

  let valuesList: string[] = [];
  try {
    valuesList = JSON.parse(content.valuesJson);
  } catch {
    valuesList = ['Commitment', 'Respect', 'Excellence', 'Care', 'Integrity', 'Curiosity'];
  }

  const handleStaffLogin = async () => {
    setErrorMessage(null);
    try {
      await loginWithEntra();
    } catch (err: any) {
      setErrorMessage(err.message || 'Microsoft login failed. Please contact IT Helpdesk.');
    }
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!parentEmail || !parentEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await api.post('/api/auth/parent/request-code', { email: parentEmail });
      setCodeSent(true);
      setStatusMessage('Verification code sent! Please check your email.');
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.error === 'EMAIL_NOT_FOUND') {
        setShowNotFoundDialog(true);
      } else {
        setErrorMessage(err.message || 'Could not send verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentCode || parentCode.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit numeric code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await verifyParentCode(parentEmail, parentCode.trim());
      navigate('/portal');
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to="/portal" replace />;
  }

  const helpdeskEmail = window.PORTAL_CONFIG?.APP_HELPDESK_EMAIL || 'helpdesk@jess.sch.ae';
  const logoSrc = branding.navLogo || '/Site_Logo.png';

  return (
    <div className="signin-page-layout">
      {/* Dynamic Ambient Glass Glow Spheres */}
      <div className="glass-ambient-sphere sphere-1" aria-hidden="true" />
      <div className="glass-ambient-sphere sphere-2" aria-hidden="true" />
      <div className="glass-ambient-sphere sphere-3" aria-hidden="true" />

      {/* Top Glass Bar */}
      <header className="signin-top-bar">
        <div className="signin-top-bar-inner">
          <a
            href="https://www.jess.sch.ae"
            target="_blank"
            rel="noopener noreferrer"
            className="school-logo-link"
            title="Visit JESS Dubai Official Website"
          >
            <img
              src={logoSrc}
              alt="JESS Dubai Official Website"
              className="signin-school-logo"
            />
            <div className="school-brand-text">
              <span className="school-brand-name">JESS DUBAI</span>
              <span className="school-brand-sub">Community Portal</span>
            </div>
          </a>
        </div>
      </header>

      <main className="signin-main-container">
        {/* Left Column: Glass Welcome & Values */}
        <section className="signin-welcome-section glass-panel">
          <h1 className="welcome-headline">{content.welcomeHeadline}</h1>

          <div className="values-list-wrapper">
            <h2 className="values-heading">Our Core Values</h2>
            <ul className="values-list">
              {valuesList.map((val, idx) => (
                <li key={idx} className="value-item">
                  <span className="value-bullet" aria-hidden="true">◆</span>
                  <span className="value-label">{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Column: Sign In Glass Card */}
        <section className="signin-actions-section" aria-labelledby="signin-heading">
          <div className="signin-card glass-panel">
            <div className="signin-card-header">
              <h2 id="signin-heading" className="card-heading">
                {content.signInHeading}
              </h2>
              <p className="card-intro">{content.signInIntro}</p>
            </div>

            {errorMessage && (
              <div className="status-box error-box" role="alert">
                <span className="status-icon" aria-hidden="true">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="status-box success-box" role="status">
                <span className="status-icon" aria-hidden="true">✓</span>
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Option 1: Staff & Students (Microsoft Entra ID) */}
            <div className="auth-choice-box staff-choice-box">
              <div className="choice-text">
                <h3 className="choice-title">{content.staffChoiceTitle}</h3>
                <p className="choice-description">{content.staffChoiceDescription}</p>
              </div>

              <button
                type="button"
                className="btn-entra-login"
                onClick={handleStaffLogin}
                title="Sign in with your Microsoft school account"
              >
                {/* Official 4-color Microsoft Logo */}
                <svg className="ms-logo-svg" width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                </svg>
                <span className="btn-text">Sign in with Microsoft</span>
              </button>
            </div>

            <div className="choice-divider">
              <span className="divider-line" />
              <span className="divider-text">OR</span>
              <span className="divider-line" />
            </div>

            {/* Option 2: Parents & Guardians (One-time code) */}
            <div className="auth-choice-box parent-choice-box">
              <div className="choice-text">
                <h3 className="choice-title">{content.parentChoiceTitle}</h3>
                <p className="choice-description">{content.parentChoiceDescription}</p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-toggle-parent"
                aria-expanded={parentFormExpanded}
                aria-controls="parent-login-form-area"
                onClick={() => setParentFormExpanded(!parentFormExpanded)}
              >
                <span>{parentFormExpanded ? 'Hide Parent Login' : 'Parent Login (One-Time Code)'}</span>
                <span className="toggle-chevron" aria-hidden="true">{parentFormExpanded ? '▲' : '▼'}</span>
              </button>

              {parentFormExpanded && (
                <div id="parent-login-form-area" className="parent-form-collapse">
                  {!codeSent ? (
                    <form onSubmit={handleSendCode} className="parent-form">
                      <div className="form-group">
                        <label htmlFor="parentEmail" className="form-label">
                          {content.parentEmailLabel}
                        </label>
                        <input
                          id="parentEmail"
                          type="email"
                          required
                          autoComplete="email"
                          className="form-control"
                          placeholder="e.g. parent@example.com"
                          value={parentEmail}
                          onChange={e => setParentEmail(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary btn-full-width btn-send-code"
                      >
                        {loading ? 'Sending code...' : content.sendCodeLabel}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyCode} className="parent-form">
                      <div className="form-group">
                        <label htmlFor="parentCode" className="form-label">
                          {content.parentCodeLabel}
                        </label>
                        <p className="form-hint">Enter the 6-digit code sent to <strong>{parentEmail}</strong></p>
                        <input
                          id="parentCode"
                          type="text"
                          pattern="\d{6}"
                          maxLength={6}
                          required
                          autoComplete="one-time-code"
                          className="form-control code-input"
                          placeholder="123456"
                          value={parentCode}
                          onChange={e => setParentCode(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>

                      <div className="form-actions-row">
                        <button
                          type="submit"
                          disabled={loading || parentCode.length !== 6}
                          className="btn btn-primary btn-verify-code"
                        >
                          {loading ? 'Verifying...' : content.verifyCodeLabel}
                        </button>

                        <button
                          type="button"
                          disabled={loading}
                          className="btn btn-secondary"
                          onClick={() => handleSendCode()}
                        >
                          {content.resendCodeLabel}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Helpdesk Notice */}
            <div className="card-helpdesk-footer">
              <span className="help-icon" aria-hidden="true">💬</span>
              <span>{content.helpPrompt}</span>{' '}
              <a href={`mailto:${helpdeskEmail}`} className="helpdesk-link">
                {content.helpLinkText}
              </a>
            </div>

            {/* Dev / Test Role Switcher (Convenience for testing without external Entra) */}
            <div className="dev-test-bar">
              <div className="dev-test-title">Local Testing Shortcuts:</div>
              <div className="dev-buttons">
                <button
                  type="button"
                  className="btn-dev"
                  onClick={() => devLoginAs({ displayName: 'System Administrator', email: 'admin@jess.sch.ae', userType: 'Staff' })}
                >
                  Admin Staff
                </button>
                <button
                  type="button"
                  className="btn-dev"
                  onClick={() => devLoginAs({ displayName: 'Sarah Jenkins', email: 'teacher@jess.sch.ae', userType: 'Staff' })}
                >
                  Teacher Staff
                </button>
                <button
                  type="button"
                  className="btn-dev"
                  onClick={() => devLoginAs({ displayName: 'Alex Smith', email: 'alex.smith@student.jess.sch.ae', userType: 'Student' })}
                >
                  Student
                </button>
                <button
                  type="button"
                  className="btn-dev"
                  onClick={() => {
                    setParentFormExpanded(true);
                    setParentEmail('parent@example.com');
                  }}
                >
                  Set Parent Email
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Email Not Found Modal Dialog */}
      {showNotFoundDialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="notfound-title">
          <div className="modal-content glass-panel">
            <h3 id="notfound-title" className="modal-title">Parent Record Not Found</h3>
            <p className="modal-body-text">
              The email address <strong>{parentEmail}</strong> could not be found in our registered parent database.
            </p>
            <p className="modal-body-text">
              If you are a parent or guardian of a JESS Dubai student, please contact our IT Helpdesk to register your email address on the student information system.
            </p>
            <div className="modal-actions">
              <a href={`mailto:${helpdeskEmail}?subject=Parent%20Portal%20Registration%20Request`} className="btn btn-primary">
                Email Helpdesk
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNotFoundDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
