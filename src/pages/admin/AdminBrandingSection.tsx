import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LiveRegion } from '../../components/LiveRegion';
import { CoreValueIcon } from '../../components/CoreValueIcon';
import { DEFAULT_BRANDING } from '../../../shared/defaults';
import {
  MAX_CORE_VALUES,
  MAX_ICON_TEXT_LENGTH,
  isImageIcon,
  parseCoreValues,
  resizeIconImage,
} from '../../utils/coreValues';
import {
  Branding,
  HomeContent,
  LoginContent,
  CoreValue,
} from '../../types';

interface LoginTextField {
  key: keyof LoginContent;
  label: string;
  maxLength: number;
  multiline?: boolean;
}

const LOGIN_TEXT_GROUPS: { title: string; fields: LoginTextField[] }[] = [
  {
    title: 'Sign-in card',
    fields: [
      { key: 'signInHeading', label: 'Heading', maxLength: 200 },
      { key: 'signInIntro', label: 'Introduction', maxLength: 1000, multiline: true },
    ],
  },
  {
    title: 'Sign-in choices',
    fields: [
      { key: 'staffChoiceTitle', label: 'Staff & student title', maxLength: 150 },
      { key: 'staffChoiceDescription', label: 'Staff & student description', maxLength: 500 },
      { key: 'parentChoiceTitle', label: 'Parent title', maxLength: 150 },
      { key: 'parentChoiceDescription', label: 'Parent description', maxLength: 500 },
    ],
  },
  {
    title: 'Parent sign-in labels',
    fields: [
      { key: 'parentEmailLabel', label: 'Email field label', maxLength: 100 },
      { key: 'parentCodeLabel', label: 'Code field label', maxLength: 100 },
      { key: 'sendCodeLabel', label: 'Send code button', maxLength: 100 },
      { key: 'verifyCodeLabel', label: 'Verify code button', maxLength: 100 },
      { key: 'resendCodeLabel', label: 'Resend code link', maxLength: 100 },
    ],
  },
  {
    title: 'Help',
    fields: [
      { key: 'helpPrompt', label: 'Help prompt', maxLength: 250 },
      { key: 'helpLinkText', label: 'Help link text', maxLength: 100 },
    ],
  },
];

// =====================================================================
// BRANDING & CONTENT SECTION
// =====================================================================
export const AdminBrandingSection: React.FC<{ refreshBranding: () => Promise<void> }> = ({ refreshBranding }) => {
  const [brandingData, setBrandingData] = useState<Branding>(DEFAULT_BRANDING);

  const [homeData, setHomeData] = useState<HomeContent | null>(null);
  const [loginData, setLoginData] = useState<LoginContent | null>(null);
  const [valuesArray, setValuesArray] = useState<CoreValue[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [homeContentOpen, setHomeContentOpen] = useState(false);
  const [loginContentOpen, setLoginContentOpen] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      const [brandRes, homeRes, loginRes] = await Promise.all([
        api.get<{ branding: Branding }>('/api/branding'),
        api.get<{ content: HomeContent }>('/api/home-content'),
        api.get<{ content: LoginContent }>('/api/login-content'),
      ]);
      setBrandingData(brandRes.branding);
      setHomeData(homeRes.content);
      setLoginData(loginRes.content);
      setValuesArray(parseCoreValues(loginRes.content.valuesJson));
    } catch (err: any) {
      setError(err.message || 'Failed to load branding and content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Contrast Ratio Calculation helper
  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };

  const getContrast = (fg: string, bg: string) => {
    try {
      const l1 = getLuminance(fg);
      const l2 = getLuminance(bg);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      return (brightest + 0.05) / (darkest + 0.05);
    } catch {
      return 1;
    }
  };

  const effectiveNavBg = brandingData.navBgColor || brandingData.mainColor;
  const effectiveNavText = brandingData.navTextColor || '#FFFFFF';
  const navContrast = getContrast(effectiveNavText, effectiveNavBg);

  const effectiveHeroBg = brandingData.heroBgColor || brandingData.mainColor;
  const effectiveHeroText = brandingData.heroTextColor || '#FFFFFF';
  const heroContrast = getContrast(effectiveHeroText, effectiveHeroBg);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (navContrast < 4.5 || heroContrast < 4.5) {
      setError('Save blocked: Tested contrast ratio is below WCAG AA minimum of 4.5:1');
      return;
    }

    try {
      await api.put('/api/admin/branding', brandingData);
      setSuccess('Portal branding saved.');
      await refreshBranding();
    } catch (err: any) {
      setError(err.message || 'Failed to save branding');
    }
  };

  const handleSaveHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeData) return;
    setError(null);
    setSuccess(null);
    try {
      await api.put('/api/admin/home-content', homeData);
      setSuccess('Home page content saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save home content');
    }
  };

  const handleSaveLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData) return;
    setError(null);
    setSuccess(null);
    try {
      const values = valuesArray
        .map(v => ({ text: v.text.trim(), icon: v.icon || null }))
        .filter(v => v.text.length > 0);
      await api.put('/api/admin/login-content', {
        ...loginData,
        values,
      });
      setSuccess('Sign-in page content saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save sign-in content');
    }
  };

  const updateValue = (index: number, patch: Partial<CoreValue>) => {
    setValuesArray(prev => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const moveValue = (index: number, delta: number) => {
    setValuesArray(prev => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleValueIconUpload = async (index: number, file?: File) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Core value icon must be an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Core value icon exceeds 2 MB limit');
      return;
    }
    try {
      updateValue(index, { icon: await resizeIconImage(file) });
    } catch (err: any) {
      setError(err.message || 'Failed to process icon image');
    }
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Navigation logo exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingData({ ...brandingData, navLogo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Favicon exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrandingData({ ...brandingData, favicon: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleHeroImageUpload = (file?: File) => {
    if (!file || !homeData) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Hero image exceeds 2 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHomeData({ ...homeData, heroImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="admin-branding-tab">
      <LiveRegion loading={loading} error={error} />
      {success && <div className="status-box success-box">{success}</div>}

      <div className="admin-stacked-sections">
        {/* 1. Branding Form */}
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={colorPaletteOpen}
            onClick={() => setColorPaletteOpen(o => !o)}
          >
            <h2 className="card-section-title">Color Palette &amp; Logos</h2>
            <span className="collapsible-chevron" aria-hidden="true">{colorPaletteOpen ? '▾' : '▸'}</span>
          </button>
          {colorPaletteOpen && (
        <form onSubmit={handleSaveBranding}>
          <div className="form-row-three">
            <div className="form-group">
              <label className="form-label">Main Brand Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, mainColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, mainColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Accent Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.accentColor}
                  onChange={e => setBrandingData({ ...brandingData, accentColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.accentColor}
                  onChange={e => setBrandingData({ ...brandingData, accentColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Text Color *</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.textColor}
                  onChange={e => setBrandingData({ ...brandingData, textColor: e.target.value })}
                />
                <input
                  type="text"
                  required
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="form-control"
                  value={brandingData.textColor}
                  onChange={e => setBrandingData({ ...brandingData, textColor: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Optional Surface Overrides */}
          <h3 className="subheading" style={{ marginTop: '16px' }}>Surface Color Overrides &amp; Contrast Validation</h3>
          <div className="form-row-two">
            <div className="form-group">
              <label className="form-label">Navigation Background (Optional)</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.navBgColor || brandingData.mainColor}
                  onChange={e => setBrandingData({ ...brandingData, navBgColor: e.target.value })}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Auto-derived"
                  value={brandingData.navBgColor || ''}
                  onChange={e => setBrandingData({ ...brandingData, navBgColor: e.target.value || null })}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navBgColor: null })}
                  title="Reset to automatic derivation"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Navigation Text (Optional)</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-picker"
                  value={brandingData.navTextColor || '#FFFFFF'}
                  onChange={e => setBrandingData({ ...brandingData, navTextColor: e.target.value })}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="#FFFFFF"
                  value={brandingData.navTextColor || ''}
                  onChange={e => setBrandingData({ ...brandingData, navTextColor: e.target.value || null })}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navTextColor: null })}
                  title="Reset to automatic derivation"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Live Contrast Previews */}
          <div className="contrast-preview-grid">
            <div className="preview-box" style={{ backgroundColor: effectiveNavBg, color: effectiveNavText }}>
              <span>Navigation Preview Text</span>
              <span className={`contrast-badge ${navContrast >= 4.5 ? 'pass' : 'fail'}`}>
                Ratio: {navContrast.toFixed(2)}:1 {navContrast >= 4.5 ? '✓ Pass (AA)' : '✕ Fail (< 4.5)'}
              </span>
            </div>

            <div className="preview-box" style={{ backgroundColor: effectiveHeroBg, color: effectiveHeroText }}>
              <span>Hero Preview Headline</span>
              <span className={`contrast-badge ${heroContrast >= 4.5 ? 'pass' : 'fail'}`}>
                Ratio: {heroContrast.toFixed(2)}:1 {heroContrast >= 4.5 ? '✓ Pass (AA)' : '✕ Fail (< 4.5)'}
              </span>
            </div>
          </div>

          {/* Navigation Logo and Favicon Pickers */}
          <div className="form-row-two" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">Navigation Brand Logo (PNG/JPEG/WebP, Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="form-control"
                  onChange={e => handleLogoUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, navLogo: null })}
                >
                  Use default logo
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Browser Favicon (PNG/JPEG/WebP, Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon"
                  className="form-control"
                  onChange={e => handleFaviconUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setBrandingData({ ...brandingData, favicon: null })}
                >
                  Use default icon
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={navContrast < 4.5 || heroContrast < 4.5}
              style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}
            >
              Save branding
            </button>
          </div>
        </form>
          )}
        </section>

        {/* 2. Home Page Editor */}
        {homeData && (
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={homeContentOpen}
            onClick={() => setHomeContentOpen(o => !o)}
          >
            <h2 className="card-section-title">Home Page Content Editor</h2>
            <span className="collapsible-chevron" aria-hidden="true">{homeContentOpen ? '▾' : '▸'}</span>
          </button>
          {homeContentOpen && (
          <form onSubmit={handleSaveHome}>
            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Hero Eyebrow Label (Max 120)</label>
                <input
                  type="text"
                  maxLength={120}
                  className="form-control"
                  value={homeData.heroLabel}
                  onChange={e => setHomeData({ ...homeData, heroLabel: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hero Headline (Max 200) *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  className="form-control"
                  value={homeData.heroHeadline}
                  onChange={e => setHomeData({ ...homeData, heroHeadline: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Hero Introduction (Max 1,000)</label>
              <textarea
                rows={2}
                maxLength={1000}
                className="form-control"
                value={homeData.heroIntro}
                onChange={e => setHomeData({ ...homeData, heroIntro: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hero Image (Max 2 MB)</label>
              <div className="form-actions-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="form-control"
                  onChange={e => handleHeroImageUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setHomeData({ ...homeData, heroImage: null })}
                >
                  Use default image
                </button>
              </div>
            </div>

            <div className="form-row-two">
              <div className="form-group">
                <label className="form-label">Caption Attribution Name</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control"
                  value={homeData.captionName}
                  onChange={e => setHomeData({ ...homeData, captionName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Caption Attribution Role</label>
                <input
                  type="text"
                  maxLength={100}
                  className="form-control"
                  value={homeData.captionRole}
                  onChange={e => setHomeData({ ...homeData, captionRole: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Welcome Section Heading (Max 250) *</label>
              <input
                type="text"
                required
                maxLength={250}
                className="form-control"
                value={homeData.welcomeHeading}
                onChange={e => setHomeData({ ...homeData, welcomeHeading: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Welcome Body Message (Max 12,000 characters; blank lines separate paragraphs) *</label>
              <textarea
                rows={6}
                required
                maxLength={12000}
                className="form-control"
                value={homeData.welcomeMessage}
                onChange={e => setHomeData({ ...homeData, welcomeMessage: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Save home page
            </button>
          </form>
          )}
        </section>
        )}

        {/* 3. Sign-In Page Editor */}
        {loginData && (
        <section className="card collapsible-card">
          <button
            type="button"
            className="collapsible-header"
            aria-expanded={loginContentOpen}
            onClick={() => setLoginContentOpen(o => !o)}
          >
            <h2 className="card-section-title">Sign-In Page Content Editor</h2>
            <span className="collapsible-chevron" aria-hidden="true">{loginContentOpen ? '▾' : '▸'}</span>
          </button>
          {loginContentOpen && (
          <form onSubmit={handleSaveLogin}>
            <div className="form-group">
              <label className="form-label">Welcome Headline (Max 200)</label>
              <input
                type="text"
                maxLength={200}
                className="form-control"
                value={loginData.welcomeHeadline}
                onChange={e => setLoginData({ ...loginData, welcomeHeadline: e.target.value })}
              />
            </div>

            {/* Values are displayed in the order listed */}
            <fieldset className="form-group core-values-editor">
              <legend className="form-label">
                Sign-In Page Core Values (display order; up to {MAX_CORE_VALUES})
              </legend>
              <p className="form-hint">
                Each value shows a small icon. Leave it as the default diamond, type an emoji or symbol, or upload an
                image (PNG/JPEG/WebP/SVG, max 2 MB) — uploads are automatically scaled to fit the icon size.
              </p>
              <ul className="core-values-editor-list">
                {valuesArray.map((val, idx) => {
                  const hasImage = isImageIcon(val.icon);
                  return (
                    <li key={idx} className="core-value-row">
                      <div className="core-value-preview" title="Icon preview">
                        <CoreValueIcon icon={val.icon} />
                      </div>
                      <input
                        type="text"
                        maxLength={50}
                        required
                        className="form-control core-value-text"
                        aria-label={`Core value ${idx + 1} text`}
                        placeholder="Value text"
                        value={val.text}
                        onChange={e => updateValue(idx, { text: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-control core-value-symbol"
                        aria-label={`Core value ${idx + 1} emoji or symbol icon`}
                        placeholder="◆"
                        title="Emoji or symbol (leave blank for the default diamond)"
                        value={hasImage ? '' : val.icon || ''}
                        disabled={hasImage}
                        onChange={e => {
                          const chars = Array.from(e.target.value).slice(0, MAX_ICON_TEXT_LENGTH).join('');
                          updateValue(idx, { icon: chars.trim() ? chars : null });
                        }}
                      />
                      <div className="core-value-actions">
                        <label className="btn btn-sm btn-secondary core-value-upload">
                          {hasImage ? 'Replace image' : 'Upload image'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            aria-label={`Upload icon image for core value ${idx + 1}`}
                            onChange={e => {
                              handleValueIconUpload(idx, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={!val.icon}
                          onClick={() => updateValue(idx, { icon: null })}
                        >
                          Default icon
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          aria-label={`Move core value ${idx + 1} up`}
                          disabled={idx === 0}
                          onClick={() => moveValue(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          aria-label={`Move core value ${idx + 1} down`}
                          disabled={idx === valuesArray.length - 1}
                          onClick={() => moveValue(idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          aria-label={`Remove core value ${idx + 1}`}
                          onClick={() => setValuesArray(prev => prev.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={valuesArray.length >= MAX_CORE_VALUES}
                onClick={() => setValuesArray(prev => [...prev, { text: '', icon: null }])}
              >
                + Add value
              </button>
            </fieldset>

            {LOGIN_TEXT_GROUPS.map(group => (
              <fieldset key={group.title} className="form-group login-text-group">
                <legend className="form-label">{group.title}</legend>
                <div className="form-row-two">
                  {group.fields.map(field => {
                    const id = `login-${field.key}`;
                    const value = (loginData[field.key] as string | null | undefined) ?? '';
                    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      setLoginData({ ...loginData, [field.key]: e.target.value });
                    return (
                      <div key={field.key} className="form-group" style={field.multiline ? { gridColumn: '1 / -1' } : undefined}>
                        <label className="form-label" htmlFor={id}>{field.label}</label>
                        {field.multiline ? (
                          <textarea id={id} rows={3} maxLength={field.maxLength} className="form-control" value={value} onChange={onChange} />
                        ) : (
                          <input id={id} type="text" maxLength={field.maxLength} className="form-control" value={value} onChange={onChange} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-main)', color: '#FFFFFF' }}>
              Save sign-in page
            </button>
          </form>
          )}
        </section>
        )}
      </div>
    </div>
  );
};
