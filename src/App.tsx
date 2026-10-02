import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { SignInPage } from './pages/SignInPage';
import { HomePage } from './pages/HomePage';

// Feature pages are split into separate chunks so the sign-in and home pages load quickly.
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ParkingPage = lazy(() => import('./pages/ParkingPage').then(m => ({ default: m.ParkingPage })));
const AbsencePage = lazy(() => import('./pages/AbsencePage').then(m => ({ default: m.AbsencePage })));
const DistanceLearningPage = lazy(() => import('./pages/DistanceLearningPage').then(m => ({ default: m.DistanceLearningPage })));
const StreamingPage = lazy(() => import('./pages/StreamingPage').then(m => ({ default: m.StreamingPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

const PageLoading: React.FC = () => (
  <div className="page-loading" role="status">
    <div className="spinner" />
    <p>Loading...</p>
  </div>
);

const ProtectedLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Authenticating JESS Community Portal...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="portal-app-layout">
      <ImpersonationBanner />
      <Header />
      <main className="portal-main-content">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <BrandingProvider>
        <AuthProvider>
          <Routes>
            {/* Public Sign-In */}
            <Route path="/" element={<SignInPage />} />

            {/* Authenticated Portal Routes */}
            <Route element={<ProtectedLayout />}>
              <Route path="/portal" element={<HomePage />} />
              <Route path="/portal/profile" element={<ProfilePage />} />
              <Route path="/portal/parking" element={<ParkingPage />} />
              <Route path="/portal/absence" element={<AbsencePage />} />
              <Route path="/portal/distance-learning" element={<DistanceLearningPage />} />
              <Route path="/portal/streaming" element={<StreamingPage />} />
              <Route path="/portal/admin" element={<AdminPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  );
};

export default App;
