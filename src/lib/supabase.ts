import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create a .env file in the project root (see .env.example) with values from Supabase → Project Settings → API.'
  );
}

if (supabaseUrl.includes('your-project.supabase.co')) {
  throw new Error(
    'VITE_SUPABASE_URL still uses the placeholder. Replace it with your real Project URL from Supabase → Project Settings → API (e.g. https://YOUR_REF.supabase.co).'
  );
}

/**
 * "Remember me" decides where the session lives.
 *
 * Persisting to localStorage keeps the user signed in across browser restarts,
 * which is what they asked for when they tick the box. When they do not, the
 * session goes to sessionStorage so it dies with the tab — the previous
 * approach of wiping localStorage in a `beforeunload` handler silently failed
 * on mobile Safari and on backgrounded tabs, leaving people signed in exactly
 * when they had asked not to be.
 */
export const REMEMBER_ME_KEY = 'tsw-remember-me';

function sessionStorageAdapter() {
  return {
    getItem: (key: string) => {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string) => {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        /* private mode — session simply will not persist */
      }
    },
    removeItem: (key: string) => {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        /* nothing to do */
      }
    },
  };
}

function shouldRemember(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) === '1';
  } catch {
    return false;
  }
}

const useLocalStorage = typeof window !== 'undefined' && shouldRemember();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage:
      typeof window === 'undefined' || useLocalStorage
        ? undefined // default: localStorage
        : sessionStorageAdapter(),
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: { 'x-application-name': 'the-security-watch-web' },
  },
});

export const STORAGE_BUCKETS = {
  EVIDENCE: 'evidence',
  AVATARS: 'avatars',
  PROPERTY_IMAGES: 'property-images',
  PROPERTY_DOCUMENTS: 'property-documents',
  MEDIA_REPORTS: 'media-reports',
  KYC_DOCUMENTS: 'kyc-documents',
  CHAT_FILES: 'chat-files',
  LEGAL_DOCUMENTS: 'legal-documents',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Buckets served straight from a public CDN URL. Everything else is private and
 * must be read through a short-lived signed URL, which is what the storage
 * policies in migration 006 expect.
 */
const PUBLIC_BUCKETS = new Set<string>([
  STORAGE_BUCKETS.AVATARS,
  STORAGE_BUCKETS.PROPERTY_IMAGES,
]);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

export interface StoredObject {
  /** Object path inside the bucket. This is what belongs in the database. */
  path: string;
  /** Immediately usable URL: a CDN URL for public buckets, else a signed URL. */
  url: string;
  bucket: string;
}

/**
 * Builds an object path. The first segment matters: the storage policies key
 * access off it, so it must be the case id, conversation id, property id or
 * owner id that grants the reader access — see migration 006 for the layout.
 */
export function buildObjectPath(scopeId: string, fileName: string): string {
  const safeName = fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120);
  return `${scopeId}/${crypto.randomUUID()}-${safeName}`;
}

/**
 * Uploads a file and returns both its path and a usable URL.
 *
 * `upsert` is off deliberately. Private buckets used to be written with
 * upsert enabled and predictable paths, which meant any authenticated user who
 * learned an evidence path could replace the bytes underneath while the stored
 * SHA-256 and chain of custody stayed untouched. A colliding path now fails
 * loudly instead.
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File,
  options?: { signedUrlSeconds?: number }
): Promise<{ path: string; url: string; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  if (error || !data) {
    return { path: '', url: '', error: error?.message ?? 'Upload failed' };
  }

  if (isPublicBucket(bucket)) {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, url: urlData.publicUrl, error: null };
  }

  const signed = await getSignedUrl(bucket, data.path, options?.signedUrlSeconds);
  return { path: data.path, url: signed.url ?? '', error: null };
}

/**
 * Signs a private object for reading. Storage RLS still applies, so this only
 * succeeds when the caller is genuinely allowed the file.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  if (!path) return { url: null, error: 'No file path' };

  if (isPublicBucket(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? 'Could not sign that file' };
  }
  return { url: data.signedUrl, error: null };
}

/**
 * Accepts either a bare object path or a legacy absolute URL and returns
 * something displayable.
 *
 * Rows written before the storage fix stored `getPublicUrl()` output for
 * private buckets, which never resolved. Those values are recognised here and
 * re-signed from the path embedded in them, so historic evidence and media
 * become readable again without a data migration.
 */
export async function resolveStorageUrl(
  bucket: StorageBucket,
  pathOrUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!pathOrUrl) return null;

  if (!/^https?:\/\//i.test(pathOrUrl)) {
    const { url } = await getSignedUrl(bucket, pathOrUrl, expiresInSeconds);
    return url;
  }

  // Already signed and still valid-looking — hand it back.
  if (pathOrUrl.includes('/object/sign/')) return pathOrUrl;

  // Legacy public URL for a private bucket: recover the path and sign it.
  const marker = `/object/public/${bucket}/`;
  const idx = pathOrUrl.indexOf(marker);
  if (idx !== -1) {
    const path = decodeURIComponent(pathOrUrl.slice(idx + marker.length));
    if (isPublicBucket(bucket)) return pathOrUrl;
    const { url } = await getSignedUrl(bucket, path, expiresInSeconds);
    return url;
  }

  return pathOrUrl;
}

export async function removeFile(
  bucket: StorageBucket,
  path: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error?.message ?? null };
}

/**
 * SHA-256 of a file's bytes, hex encoded. Recorded on evidence at upload and
 * re-checked on download so tampering is detectable rather than merely
 * asserted.
 */
export async function generateFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Downloads a private object and verifies it still hashes to what was recorded.
 * This is what makes the stored hash meaningful — a hash nobody ever checks
 * proves nothing.
 */
export async function downloadAndVerify(
  bucket: StorageBucket,
  path: string,
  expectedHash?: string | null
): Promise<{ blob: Blob | null; verified: boolean | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return { blob: null, verified: null, error: error?.message ?? 'Download failed' };
  }
  if (!expectedHash) {
    return { blob: data, verified: null, error: null };
  }
  const actual = await generateFileHash(data);
  return { blob: data, verified: actual === expectedHash, error: null };
}
