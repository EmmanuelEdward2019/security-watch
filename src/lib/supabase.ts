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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
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
} as const;

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) return { url: '', error: error.message };

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { url: urlData.publicUrl, error: null };
}

export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
