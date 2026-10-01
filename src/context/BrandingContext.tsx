import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Branding } from '../types';
import { api } from '../services/api';

interface BrandingContextType {
  branding: Branding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

const defaultBranding: Branding = {
  id: 1,
  mainColor: '#002B49',
  accentColor: '#BA9B37',
  textColor: '#212529',
  navBgColor: null,
  navTextColor: null,
  navAccentColor: null,
  heroBgColor: null,
  heroTextColor: null,
  heroAccentColor: null,
  navLogo: null,
  favicon: null,
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
  refreshBranding: async () => {},
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [loading, setLoading] = useState<boolean>(true);

  const applyBrandingStyles = useCallback((b: Branding) => {
    const root = document.documentElement;
    root.style.setProperty('--color-main', b.mainColor);
    root.style.setProperty('--color-accent', b.accentColor);
    root.style.setProperty('--color-text', b.textColor);

    const navBg = b.navBgColor || b.mainColor;
    const navText = b.navTextColor || '#FFFFFF';
    const navAccent = b.navAccentColor || b.accentColor;

    root.style.setProperty('--nav-bg', navBg);
    root.style.setProperty('--nav-text', navText);
    root.style.setProperty('--nav-accent', navAccent);

    const heroBg = b.heroBgColor || b.mainColor;
    const heroText = b.heroTextColor || '#FFFFFF';
    const heroAccent = b.heroAccentColor || b.accentColor;

    root.style.setProperty('--hero-bg', heroBg);
    root.style.setProperty('--hero-text', heroText);
    root.style.setProperty('--hero-accent', heroAccent);

    // Update browser theme color
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', navBg);
    }

    // Update favicon if provided
    if (b.favicon) {
      const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = b.favicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const data = await api.get<{ branding: Branding }>('/api/branding');
      if (data && data.branding) {
        setBranding(data.branding);
        applyBrandingStyles(data.branding);
      }
    } catch (err) {
      console.warn('[Branding] Could not load dynamic branding; using default branding.', err);
      applyBrandingStyles(defaultBranding);
    } finally {
      setLoading(false);
    }
  }, [applyBrandingStyles]);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};
