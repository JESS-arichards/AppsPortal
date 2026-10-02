import React, { useState, useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import { api } from '../services/api';
import { StreamItem } from '../types';
import { LiveRegion } from '../components/LiveRegion';
import { ModalPortal } from '../components/ModalPortal';

export const StreamingPage: React.FC = () => {
  const [videos, setVideos] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Active playing video modal
  const [activeVideo, setActiveVideo] = useState<StreamItem | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    api.get<{ videos: StreamItem[] }>('/api/streaming/videos')
      .then(res => {
        setVideos(res.videos || []);
      })
      .catch(err => {
        setError(err.message || 'Failed to load video streams');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Compute unique active categories from the catalogue
  const allCategories = useMemo(() => {
    const catSet = new Set<string>();
    videos.forEach(v => {
      if (v.categories) {
        v.categories.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed) catSet.add(trimmed);
        });
      }
    });
    return Array.from(catSet).sort();
  }, [videos]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Filter videos using client-side case-insensitive match & AND semantics for categories
  const filteredVideos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return videos.filter(video => {
      // 1. Text search
      const matchesSearch =
        !q ||
        video.title.toLowerCase().includes(q) ||
        (video.description && video.description.toLowerCase().includes(q)) ||
        (video.categories && video.categories.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Categories filter (AND semantics)
      if (selectedCategories.length > 0) {
        const videoCats = (video.categories || '')
          .split(',')
          .map(c => c.trim().toLowerCase());
        const hasAllCats = selectedCategories.every(c => videoCats.includes(c.toLowerCase()));
        if (!hasAllCats) return false;
      }

      return true;
    });
  }, [videos, searchQuery, selectedCategories]);

  // Separate Live and On Demand
  const liveVideos = useMemo(() => filteredVideos.filter(v => v.streamType === 'Live'), [filteredVideos]);
  const onDemandVideos = useMemo(() => filteredVideos.filter(v => v.streamType === 'On Demand'), [filteredVideos]);

  // HLS and Video Cleanup
  const closePlayer = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setActiveVideo(null);
  };

  useEffect(() => {
    if (activeVideo && activeVideo.videoUrl.includes('.m3u8') && videoRef.current) {
      const videoEl = videoRef.current;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(activeVideo.videoUrl);
        hls.attachMedia(videoEl);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoEl.play().catch(() => {});
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        videoEl.src = activeVideo.videoUrl;
        videoEl.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeVideo]);

  return (
    <div className="streaming-page-container">
      <header className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-main)' }}>JESS Streaming &amp; Media</h1>
        <p className="page-subtitle">Watch live school events, sports tournaments, and on-demand educational broadcasts.</p>
      </header>

      <LiveRegion loading={loading} error={error} />

      {/* Filter and Search Bar */}
      <section className="card streaming-search-card">
        <div className="search-bar-row">
          <input
            type="search"
            aria-label="Search video catalogue"
            placeholder="Search by title, description, or tags..."
            className="form-control search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Chips */}
        {allCategories.length > 0 && (
          <div className="categories-chips-container" aria-label="Filter by category">
            <span className="chips-label">Categories:</span>
            {allCategories.map(cat => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={isSelected}
                  className={`category-chip ${isSelected ? 'chip-active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                  style={{
                    backgroundColor: isSelected ? 'var(--color-accent)' : undefined,
                    color: isSelected ? '#FFFFFF' : undefined,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Live Videos Track (hidden when empty) */}
      {liveVideos.length > 0 && (
        <section className="streaming-section" aria-labelledby="live-heading">
          <div className="section-title-wrap">
            <span className="live-dot" aria-hidden="true">🔴</span>
            <h2 id="live-heading" className="stream-section-title">Live Broadcasts</h2>
          </div>

          <div className="video-cards-grid">
            {liveVideos.map(video => (
              <VideoCard key={video.id} video={video} onSelect={() => setActiveVideo(video)} />
            ))}
          </div>
        </section>
      )}

      {/* On Demand Videos Track */}
      <section className="streaming-section" aria-labelledby="ondemand-heading">
        <h2 id="ondemand-heading" className="stream-section-title">On Demand Media</h2>

        {onDemandVideos.length > 0 ? (
          <div className="video-cards-grid">
            {onDemandVideos.map(video => (
              <VideoCard key={video.id} video={video} onSelect={() => setActiveVideo(video)} />
            ))}
          </div>
        ) : (
          <div className="empty-box card">
            <p className="empty-text">No videos match your active filter and search terms.</p>
          </div>
        )}
      </section>

      {/* Player Modal Dialog */}
      {activeVideo && (
        <ModalPortal>
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="player-modal-title">
          <div className="modal-content modal-player">
            <div className="modal-header">
              <h3 id="player-modal-title" className="modal-title">{activeVideo.title}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closePlayer}
                aria-label="Close video player"
              >
                ✕
              </button>
            </div>

            <div className="video-player-frame">
              {activeVideo.videoUrl.includes('.m3u8') ? (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  className="native-hls-video"
                />
              ) : (
                <iframe
                  src={activeVideo.videoUrl}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="castr-iframe"
                />
              )}
            </div>

            <div className="player-meta-box">
              <div className="player-badges">
                <span className="badge badge-primary">{activeVideo.streamType}</span>
                {activeVideo.accessType === 'Pay Per View' && (
                  <span className="badge badge-warning">Pay Per View</span>
                )}
                <span className="player-categories">{activeVideo.categories}</span>
              </div>
              {activeVideo.description && (
                <p className="player-description">{activeVideo.description}</p>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closePlayer}>
                Close
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

const VideoCard: React.FC<{ video: StreamItem; onSelect: () => void }> = ({ video, onSelect }) => {
  const thumbnail = video.thumbnailUrl || '/Default_Home_Page_Image.png';

  return (
    <article
      className="video-card card"
      tabIndex={0}
      role="button"
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Play ${video.title}`}
    >
      <div className="video-card-thumb-wrap">
        <img src={thumbnail} alt="" className="video-thumb-img" />
        <div className="card-badge-row">
          <span className="badge badge-primary">{video.streamType}</span>
          {video.accessType === 'Pay Per View' && (
            <span className="badge badge-warning">PPV</span>
          )}
        </div>
      </div>

      <div className="video-card-body">
        <h3 className="video-card-title">{video.title}</h3>
        {video.categories && (
          <p className="video-card-categories">{video.categories}</p>
        )}
      </div>
    </article>
  );
};
