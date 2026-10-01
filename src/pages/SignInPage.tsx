import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    valuesJson: JSON.stringify(['Empowering Students', 'Excellence in Teaching', 'Community Partnership', 'Integrity & Care']),
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
    if (user) {
      navigate('/portal');
    }
  }, [user, navigate]);

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
    valuesList = ['Empowering Students', 'Excellence in Teaching'];
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

  const helpdeskEmail = window.PORTAL_CONFIG?.APP_HELPDESK_EMAIL || 'helpdesk@jess.sch.ae';

  return (
    <div className="signin-page-layout">
      {/* Top Bar with School Website Logo Link */}
      <div className="signin-top-bar" style={{ backgroundColor: 'var(--color-main)' }}>
        <a
          href="https://www.jess.sch.ae"
          target="_blank"
          rel="noopener noreferrer"
          className="school-logo-link"
          title="Visit JESS Dubai Website"
        >
          <img src={branding.navLogo || '/Site_Logo.png'} alt="JESS Dubai Official Website" className="signin-school-logo" />
        </a>
      </div>

      <main className="signin-main-container">
        {/* Left Column: Welcome & Values */}
        <section className="signin-welcome-section" style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <span className="eyebrow" style={{ color: 'var(--color-accent)' }}>{content.welcomeLabel}</span>
          <h1 className="welcome-headline" style={{ color: 'var(--color-main)' }}>{content.welcomeHeadline}</h1>

          <div className="values-list-wrapper">
            <h2 className="sr-only">Our Core Values</h2>
            <ul className="values-list">
              {valuesList.map((val, idx) => (
                <li key={idx} className="value-item">
                  <span className="value-bullet" aria-hidden="true" style={{ color: 'var(--color-accent)' }}>◆</span>
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Column: Sign In Choices */}
        <section className="signin-actions-section" aria-labelledby="signin-heading">
          <div className="signin-card">
            <h2 id="signin-heading" className="card-heading" style={{ color: 'var(--color-main)' }}>
              {content.signInHeading}
            </h2>
            <p className="card-intro">{content.signInIntro}</p>

            {errorMessage && (
              <div className="status-box error-box" role="alert" style={{ marginBottom: '16px' }}>
                <span aria-hidden="true">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="status-box success-box" role="status" style={{ marginBottom: '16px' }}>
                <span aria-hidden="true">✓</span>
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Option 1: Staff & Students (Microsoft Entra ID) */}
            <div className="auth-choice-box">
              <div className="choice-text">
                <h3 className="choice-title">{content.staffChoiceTitle}</h3>
                <p className="choice-description">{content.staffChoiceDescription}</p>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-entra-login"
                onClick={handleStaffLogin}
                style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
              >
                <span className="ms-logo-icon" aria-hidden="true">⊞</span>
                <span>Staff &amp; Student Login</span>
              </button>
            </div>

            <div className="choice-divider">
              <span>OR</span>
            </div>

            {/* Option 2: Parents & Guardians (One-time code) */}
            <div className="auth-choice-box">
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
                <span>{parentFormExpanded ? '▲ Hide Parent Login' : '▼ Parent Login (One-Time Code)'}</span>
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
                        className="btn btn-accent btn-full-width"
                        style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
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
                          className="btn btn-accent"
                          style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
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
              <span>{content.helpPrompt}</span>{' '}
              <a href={`mailto:${helpdeskEmail}`} className="helpdesk-link">
                {content.helpLinkText}
              </a>
            </div>

            {/* Dev / Test Role Switcher (Convenience for testing without external Entra) */}
            <div className="dev-test-bar">
              <span className="dev-label">Local Testing Shortcuts:</span>
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
          <div className="modal-content">
            <h3 id="notfound-title" className="modal-title">Parent Record Not Found</h3>
            <p className="modal-body">
              The email address <strong>{parentEmail}</strong> could not be found in our registered parent database.
            </p>
            <p className="modal-body">
              If you are a parent or guardian of a JESS Dubai student, please contact our IT Helpdesk to register your email address on the student information system.
            </p>
            <div className="modal-actions">
              <a href={`mailto:${helpdeskEmail}?subject=Parent%20Portal%20Registration%20Request`} className="btn btn-accent">
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
