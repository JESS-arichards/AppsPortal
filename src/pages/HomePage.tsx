import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { HomeContent } from '../types';
import { LiveRegion } from '../components/LiveRegion';
import { DEFAULT_HOME_CONTENT } from '../../shared/defaults';

export const HomePage: React.FC = () => {
  const [content, setContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ content: HomeContent }>('/api/home-content')
      .then(res => {
        if (res.content) {
          setContent(res.content);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load home page content');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const heroImageSrc = content.heroImage || '/Default_Home_Page_Image.png';

  // Split welcome message into paragraphs based on blank lines
  const paragraphs = content.welcomeMessage
    ? content.welcomeMessage.split(/\r?\n\s*\r?\n/).filter(p => p.trim().length > 0)
    : [];

  return (
    <div className="home-page-container">
      <LiveRegion loading={loading} error={error} />

      {/* Hero Section */}
      <section
        className="portal-hero-section"
        style={{
          backgroundColor: 'var(--hero-bg)',
          color: 'var(--hero-text)',
        }}
      >
        <div className="hero-content-wrapper">
          <div className="hero-text-block">
            <span className="hero-eyebrow" style={{ color: 'var(--hero-accent)' }}>
              {content.heroLabel}
            </span>
            <h1 className="hero-headline">{content.heroHeadline}</h1>
            <p className="hero-intro">{content.heroIntro}</p>
          </div>

          <div className="hero-image-block">
            <figure className="hero-figure">
              <img
                src={heroImageSrc}
                alt={content.heroImageAlt || 'JESS Dubai'}
                className="hero-image"
              />
              {(content.captionName || content.captionRole) && (
                <figcaption className="hero-caption" style={{ color: 'var(--hero-accent)' }}>
                  <strong>{content.captionName}</strong>
                  {content.captionRole && <span> &mdash; {content.captionRole}</span>}
                </figcaption>
              )}
            </figure>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="portal-welcome-section">
        <div className="welcome-inner">
          <span className="welcome-eyebrow" style={{ color: 'var(--color-accent)' }}>
            {content.welcomeLabel}
          </span>
          <h2 className="welcome-heading" style={{ color: 'var(--color-main)' }}>
            {content.welcomeHeading}
          </h2>

          <div className="welcome-body">
            {paragraphs.map((p, idx) => (
              <p key={idx} className="welcome-paragraph">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
