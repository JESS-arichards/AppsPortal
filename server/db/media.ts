/**
 * Media (images and lesson files) are stored as data URLs in the database but are never sent
 * inline in JSON. Repositories return short versioned URLs served by /api/media instead.
 *
 * Write rule shared by both repositories: an incoming value that is one of these media URLs means
 * "unchanged" (the client echoed back what it was given), a data URL replaces the stored value and
 * an empty value clears it.
 */
import type { DistanceLessonResource, PortalBranding, PortalHomeContent, StreamItem } from './types.js';

export type MediaKind = 'navLogo' | 'favicon' | 'heroImage' | 'streamThumbnail' | 'userPicture' | 'lessonResource';

export interface MediaRecord {
  data: string | null;
  updatedAt?: string;
  fileName?: string | null;
  mimeType?: string | null;
  /** Owning class for lesson resources (used for authorisation). */
  classCode?: string;
}

export const MEDIA_PREFIX = '/api/media/';

export function isMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(MEDIA_PREFIX);
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function version(updatedAt?: string | null): string {
  const ms = updatedAt ? Date.parse(updatedAt) : NaN;
  return Number.isNaN(ms) ? '' : `?v=${ms}`;
}

export const mediaUrl = {
  navLogo: (updatedAt?: string | null) => `${MEDIA_PREFIX}branding/navLogo${version(updatedAt)}`,
  favicon: (updatedAt?: string | null) => `${MEDIA_PREFIX}branding/favicon${version(updatedAt)}`,
  heroImage: (updatedAt?: string | null) => `${MEDIA_PREFIX}home/heroImage${version(updatedAt)}`,
  streamThumbnail: (id: number, updatedAt?: string | null) => `${MEDIA_PREFIX}streams/${id}/thumbnail${version(updatedAt)}`,
  userPicture: (id: string, updatedAt?: string | null) => `${MEDIA_PREFIX}users/${encodeURIComponent(id)}/picture${version(updatedAt)}`,
  lessonResource: (id: number) => `${MEDIA_PREFIX}lesson-resources/${id}/file`,
};

/** Resolves the value to store given the incoming value and the currently stored one. */
export function resolveMediaWrite(incoming: string | null | undefined, existing: string | null | undefined): string | null {
  if (incoming === undefined || isMediaUrl(incoming)) return existing ?? null;
  return incoming || null;
}

/** Converts a stored data URL into its public media URL; other values (e.g. external URLs) pass through. */
export function presentMedia(stored: string | null | undefined, url: () => string): string | null {
  if (!stored) return null;
  return isDataUrl(stored) ? url() : stored;
}

export function presentUser<T extends { id: string; profilePicture?: string | null; updatedAt?: string }>(user: T): T {
  return { ...user, profilePicture: presentMedia(user.profilePicture, () => mediaUrl.userPicture(user.id, user.updatedAt)) };
}

export function presentStream(stream: StreamItem): StreamItem {
  return { ...stream, thumbnailUrl: presentMedia(stream.thumbnailUrl, () => mediaUrl.streamThumbnail(stream.id, stream.updatedAt)) };
}

export function presentBranding(branding: PortalBranding): PortalBranding {
  return {
    ...branding,
    navLogo: presentMedia(branding.navLogo, () => mediaUrl.navLogo(branding.updatedAt)),
    favicon: presentMedia(branding.favicon, () => mediaUrl.favicon(branding.updatedAt)),
  };
}

export function presentHomeContent(content: PortalHomeContent): PortalHomeContent {
  return { ...content, heroImage: presentMedia(content.heroImage, () => mediaUrl.heroImage(content.updatedAt)) };
}

/** Strips the stored file from a lesson resource, exposing a download URL instead. */
export function presentResource(r: DistanceLessonResource & { id: number }): DistanceLessonResource {
  const { fileData, ...rest } = r;
  const hasFile = r.hasFile ?? !!fileData;
  return { ...rest, hasFile, fileUrl: hasFile ? mediaUrl.lessonResource(r.id) : null };
}

export function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const buffer = match[3] ? Buffer.from(match[4], 'base64') : Buffer.from(decodeURIComponent(match[4]), 'utf8');
  return { mimeType, buffer };
}
