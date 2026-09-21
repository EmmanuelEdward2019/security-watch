/**
 * The media library.
 *
 * Field material used to have exactly one destination: a `media_reports` row
 * against a named institution, created at the moment of capture. That meant a
 * media agent had to know what a recording was about before they could keep it,
 * a clip could not be used on a second case without uploading it twice, and
 * anything captured on a body camera or a wearable had nowhere to go at all.
 *
 * The library owns the file. Two explicit exits lead out of it — attach to a
 * case as evidence, or submit to an administrator as an institution report —
 * and the library row survives both, so one capture can be used more than once.
 *
 * Both exits go through SECURITY DEFINER RPCs (migration 017) rather than
 * direct inserts, because the rules that matter are server-side: the file hash
 * must be present, and you must not be able to attach evidence to a case you
 * have nothing to do with.
 */
import { supabase } from '@/lib/supabase';
import {
  STORAGE_BUCKETS,
  buildObjectPath,
  generateFileHash,
  uploadFile,
} from '@/lib/supabase';
import type { MediaLibraryItem } from '@/types';

/** Maps a MIME type onto the library's four kinds. */
export function kindForMimeType(mime: string): MediaLibraryItem['media_kind'] {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'photo';
  return 'document';
}

export interface AddToLibraryInput {
  ownerId: string;
  file: File | Blob;
  fileName: string;
  source: 'capture' | 'import';
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  /** Reverse-geocoded at capture; null when the fix would not geocode (033). */
  address?: string | null;
  durationSeconds?: number | null;
}

/**
 * Uploads a file and records it in the library.
 *
 * The hash is computed before the upload, over the same bytes that are sent, so
 * the recorded digest describes exactly what is stored. It is required by the
 * table, which is deliberate: the chain-of-custody claim this platform makes
 * rests on it, and a nullable hash means a client could simply omit it.
 */
export async function addToLibrary(
  input: AddToLibraryInput
): Promise<{ item: MediaLibraryItem | null; error: string | null }> {
  const {
    ownerId, file, fileName, source,
    capturedAt = null, latitude = null, longitude = null, address = null,
    note = null, durationSeconds = null,
  } = input;

  if (file.size === 0) {
    return { item: null, error: 'That file is empty.' };
  }

  const asFile =
    file instanceof File ? file : new File([file], fileName, { type: file.type });

  const hash = await generateFileHash(asFile);

  // The path prefix is load-bearing: storage policies grant on the first
  // segment matching auth.uid(). An upload keyed to anything else is refused.
  const path = buildObjectPath(ownerId, fileName);

  const { path: storedPath, error: uploadError } = await uploadFile(
    STORAGE_BUCKETS.MEDIA_REPORTS,
    path,
    asFile
  );

  if (uploadError || !storedPath) {
    return { item: null, error: uploadError ?? 'Upload failed.' };
  }

  const { data, error } = await supabase
    .from('media_library')
    .insert({
      owner_id: ownerId,
      file_path: storedPath,
      file_name: fileName,
      file_type: asFile.type || 'application/octet-stream',
      file_size: asFile.size,
      file_hash: hash,
      media_kind: kindForMimeType(asFile.type),
      source,
      captured_at: capturedAt,
      gps_latitude: latitude,
      gps_longitude: longitude,
      gps_address: address,
      note,
      duration_seconds: durationSeconds,
    })
    .select()
    .single();

  if (error) {
    // The object is uploaded but unreferenced. Remove it rather than leaving
    // a file nothing points at, which storage would bill for indefinitely.
    await supabase.storage
      .from(STORAGE_BUCKETS.MEDIA_REPORTS)
      .remove([storedPath])
      .catch(() => {});
    return { item: null, error: error.message };
  }

  return { item: data as MediaLibraryItem, error: null };
}

export async function listLibrary(
  ownerId: string,
  kind?: MediaLibraryItem['media_kind']
): Promise<{ items: MediaLibraryItem[]; error: string | null }> {
  let query = supabase
    .from('media_library')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (kind) query = query.eq('media_kind', kind);

  const { data, error } = await query;
  return { items: (data ?? []) as MediaLibraryItem[], error: error?.message ?? null };
}

/** Removes the library row and the stored object together. */
export async function deleteLibraryItem(
  item: MediaLibraryItem
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('media_library').delete().eq('id', item.id);
  if (error) return { error: error.message };

  // Best effort. The row is gone either way; an orphaned object is a storage
  // cost, not a correctness problem, and reporting it would confuse the user.
  await supabase.storage
    .from(STORAGE_BUCKETS.MEDIA_REPORTS)
    .remove([item.file_path])
    .catch(() => {});

  return { error: null };
}

/**
 * Attaches an item to a case as evidence.
 *
 * The RPC re-checks that the caller participates in the case. Without that,
 * anyone could inject material into any investigation.
 */
export async function attachToCase(
  itemId: string,
  caseId: string,
  description?: string
): Promise<{ evidenceId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('attach_library_item_to_case', {
    p_item_id: itemId,
    p_case_id: caseId,
    p_description: description ?? null,
  });

  return { evidenceId: (data as string) ?? null, error: error?.message ?? null };
}

/**
 * Submits an item to administrators as an institution field report.
 *
 * Always enters as `pending_review` — publication stays an administrator's
 * decision, which is what keeps unverified allegations about named
 * institutions off the public archive. The RPC also notifies every admin,
 * which the old client-side insert never did.
 */
export async function submitToAdmin(
  itemId: string,
  institutionId: string,
  title: string,
  description: string,
  tags: string[] = []
): Promise<{ reportId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_library_item_to_admin', {
    p_item_id: itemId,
    p_institution_id: institutionId,
    p_title: title,
    p_description: description,
    p_tags: tags,
  });

  return { reportId: (data as string) ?? null, error: error?.message ?? null };
}
