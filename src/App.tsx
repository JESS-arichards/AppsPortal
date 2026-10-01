import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { SignInPage } from './pages/SignInPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { ParkingPage } from './pages/ParkingPage';
import { AbsencePage } from './pages/AbsencePage';
import { DistanceLearningPage } from './pages/DistanceLearningPage';
import { StreamingPage } from './pages/StreamingPage';
import { AdminPage } from './pages/AdminPage';

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
        <Outlet />
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
