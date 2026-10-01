import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

export const Header: React.FC = () => {
  const { user, impersonation, logout } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) {
    return null;
  }

  const isEntraStaff = user.userType === 'Staff' && user.authType === 'Entra';
  const isEntraUser = user.authType === 'Entra';
  const hasStaffRole = user.roles?.includes('Staff') || false;
  const isFullAdmin = user.roles?.includes('Admin') || false;
  const hasDelegatedSections = (user.adminSections && user.adminSections.length > 0) || false;
  const showAdmin = (isFullAdmin || hasDelegatedSections) && !impersonation?.active;
  const isImpersonating = impersonation?.active;

  const closeMenu = () => setMobileMenuOpen(false);

  const navLogoSrc = branding.navLogo || '/Site_Logo.png';
  const avatarSrc = user.profilePicture || '/avatar-placeholder.png';

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="portal-header" style={{ backgroundColor: 'var(--nav-bg)', color: 'var(--nav-text)' }}>
      <div className="header-container">
        {/* Logo / Home Link */}
        <Link to="/portal" className="brand-link" onClick={closeMenu}>
          <img
            src={navLogoSrc}
            alt="JESS Dubai Portal"
            className="brand-logo"
          />
        </Link>

        {/* Mobile menu toggle button */}
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          title={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="hamburger-icon" aria-hidden="true">
            {mobileMenuOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* Navigation Links */}
        <nav className={`portal-nav ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Main portal navigation">
          <ul className="nav-list">
            {/* 1. Home - always present */}
            <li className="nav-item">
              <Link
                to="/portal"
                className={`nav-link ${isActive('/portal') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Home
              </Link>
            </li>

            {/* 2. Streaming - visible to all authenticated users */}
            <li className="nav-item">
              <Link
                to="/portal/streaming"
                className={`nav-link ${isActive('/portal/streaming') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                Streaming
              </Link>
            </li>

            {/* 3. Parking - shown to Entra-authenticated staff */}
            {isEntraStaff && (
              <li className="nav-item">
                <Link
                  to="/portal/parking"
                  className={`nav-link ${isActive('/portal/parking') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Parking
                </Link>
              </li>
            )}

            {/* 4. Absence - shown to Entra-authenticated users */}
            {isEntraUser && (
              <li className="nav-item">
                <Link
                  to="/portal/absence"
                  className={`nav-link ${isActive('/portal/absence') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Absence
                </Link>
              </li>
            )}

            {/* 5. Distance Learning - dynamically inserted before Profile for Staff */}
            {hasStaffRole && (
              <li className="nav-item">
                <Link
                  to="/portal/distance-learning"
                  className={`nav-link ${isActive('/portal/distance-learning') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Distance Learning
                </Link>
              </li>
            )}

            {/* 6. My Profile */}
            <li className="nav-item">
              <Link
                to="/portal/profile"
                className={`nav-link ${isActive('/portal/profile') ? 'active' : ''}`}
                onClick={closeMenu}
              >
                My Profile
              </Link>
            </li>

            {/* 7. Admin - shown for full admin or delegated sections, hidden during impersonation */}
            {showAdmin && (
              <li className="nav-item">
                <Link
                  to="/portal/admin"
                  className={`nav-link nav-link-admin ${isActive('/portal/admin') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* User Account Controls */}
        <div className="user-controls">
          <div className="user-info">
            <span className="user-name">{user.displayName}</span>
            <span className="user-role-badge">{user.userType}</span>
          </div>

          <div className="user-avatar-wrap" title={user.displayName}>
            <img src={avatarSrc} alt="" className="user-avatar" />
          </div>

          {/* Sign out button - hidden during impersonation */}
          {!isImpersonating && (
            <button
              type="button"
              className="btn-sign-out"
              onClick={logout}
              title="Sign out of JESS Portal"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
