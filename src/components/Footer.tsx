import React from 'react';

export const Footer: React.FC = () => {
  const helpdeskEmail = window.PORTAL_CONFIG?.APP_HELPDESK_EMAIL || '';

  return (
    <footer className="portal-footer" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
      <div className="footer-container">
        <div className="footer-left">
          <span>&copy; JESS Dubai</span>
          <span className="footer-separator" aria-hidden="true">&bull;</span>
          <span>Version 1.0.0</span>
        </div>

        {helpdeskEmail && (
          <div className="footer-right">
            <a
              href={`mailto:${helpdeskEmail}?subject=JESS%20Portal%20Assistance`}
              className="footer-help-link"
              title="Get help via email from JESS Helpdesk"
            >
              Get help
            </a>
          </div>
        )}
      </div>
    </footer>
  );
};
