import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { AdminUsersSection } from './admin/AdminUsersSection';
import { AdminClassesSection } from './admin/AdminClassesSection';
import { AdminPeriodsSection } from './admin/AdminPeriodsSection';
import { AdminParentLinksSection } from './admin/AdminParentLinksSection';
import { AdminParkingSection } from './admin/AdminParkingSection';
import { AdminStreamingSection } from './admin/AdminStreamingSection';
import { AdminBrandingSection } from './admin/AdminBrandingSection';

type AdminTab = 'users' | 'classes' | 'periods' | 'parentLinks' | 'parking' | 'streaming' | 'branding';

export const AdminPage: React.FC = () => {
  const { user, impersonation } = useAuth();
  const { refreshBranding } = useBranding();

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
