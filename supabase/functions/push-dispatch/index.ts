/**
 * Delivers pending notifications to devices, as a sweep.
 *
 * Runs on a schedule rather than on write. A trigger that made an HTTP call
 * would put a network round-trip inside the transaction that created the
 * notification: when Expo is slow the case update is slow, and when Expo is
 * down the case update rolls back. Notifications are the thing that must
 * survive; the push is best-effort on top.
 *
 * The batch is claimed and marked in a single statement (`claim_push_batch`),
 * so two overlapping runs cannot both send the same row. Marking happens at
 * claim time, not on success — see the note in migration 025 for why a
 * duplicate is the cheaper failure than a queue that never drains.
 *
 * PRIVACY. Whether a notification's title and body may appear in the payload
 * is the recipient's setting, resolved per row by the database. This function
 * must never decide that for itself: the default is discreet because a push
 * lands on a lock screen, and the people using this platform are sometimes
 * reporting the people most likely to end up holding their phone.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo's documented ceiling for one request. */
const EXPO_CHUNK = 100;

/** Batches per invocation. Bounds the run against the function timeout. */
const MAX_BATCHES = 10;

interface ClaimRow {
  notification_id: string;
  token: string;
  platform: 'ios' | 'android';
  title: string;
  body: string;
  link: string | null;
  show_preview: boolean;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Constant-time compare, so a caller cannot recover the secret by timing
 * repeated guesses against it.
 */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function buildMessage(row: ClaimRow) {
  const preview = row.show_preview;

  return {
    to: row.token,
    // The discreet form says something happened and nothing about what. It is
    // deliberately identical for every notification type — a distinct wording
    // per category would leak the category, which for "evidence added to your
    // case" is most of what an onlooker needs.
    title: preview ? row.title : 'The Security Watch',
    body: preview ? row.body : 'You have a new update. Open the app to read it.',
    // `data` is not rendered on a lock screen. The link is a UUID path, not
    // content, and it is what makes the tap land in the right place.
    data: { notificationId: row.notification_id, link: row.link ?? null },
    sound: 'default',
    // Notifications here are case events, not marketing. `high` is what gets
    // them past Android's batching while the user still cares.
    priority: 'high',
    channelId: 'default',
  };
}

async function sendChunk(messages: ReturnType<typeof buildMessage>[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    // A non-2xx is an Expo-side or transport problem, not a per-token verdict.
    // Returning empty tickets means no token is disabled off the back of it —
    // disabling a live device because Expo had a bad minute would silently
    // stop that person's alerts for good.
    console.error('expo push rejected the request', res.status, await res.text().catch(() => ''));
    return [];
  }

  const payload = await res.json().catch(() => null);
  return Array.isArray(payload?.data) ? (payload.data as ExpoTicket[]) : [];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  if (!expected) {
    console.error('PUSH_DISPATCH_SECRET is not set; refusing to run');
    return json({ error: 'Not configured' }, 500);
  }

  const given = req.headers.get('x-dispatch-secret') ?? '';
  if (!secretMatches(given, expected)) {
    // Deliberately identical to the "not configured" shape from outside:
    // an unauthenticated caller learns nothing about why it failed.
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  let claimed = 0;
  let sent = 0;
  let disabled = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data, error } = await supabase.rpc('claim_push_batch', { p_limit: EXPO_CHUNK });

    if (error) {
      console.error('claim_push_batch failed', error.message);
      return json({ error: 'Claim failed', claimed, sent, disabled }, 500);
    }

    const rows = (data ?? []) as ClaimRow[];
    if (rows.length === 0) break;

    claimed += rows.length;

    // One row per (notification, device). A user with a phone and a tablet
    // gets two rows for one notification, which is correct — both should ring.
    const messages = rows.map(buildMessage);
    const tickets = await sendChunk(messages);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const row = rows[i];
      if (!ticket || !row) continue;

      if (ticket.status === 'ok') {
        sent++;
        continue;
      }

      const reason = ticket.details?.error ?? ticket.message ?? 'unknown';

      // DeviceNotRegistered is the only verdict that means the token is
      // permanently gone — the app was uninstalled or the token rotated. Every
      // other error (rate limits, a malformed message, an Expo fault) is about
      // this attempt, and disabling on those would quietly retire working
      // devices one bad batch at a time.
      if (ticket.details?.error === 'DeviceNotRegistered') {
        const { error: offErr } = await supabase.rpc('disable_push_token', {
          p_token: row.token,
          p_reason: reason,
        });
        if (offErr) console.error('disable_push_token failed', offErr.message);
        else disabled++;
      } else {
        console.error('push ticket error', reason, row.notification_id);
      }
    }

    // A short batch means the queue is drained; another round trip would only
    // find nothing.
    if (rows.length < EXPO_CHUNK) break;
  }

  return json({ claimed, sent, disabled }, 200);
});
