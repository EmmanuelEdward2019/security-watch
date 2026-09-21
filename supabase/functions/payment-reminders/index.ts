/**
 * Chases unpaid obligations.
 *
 * "Pay later" had no later. A complainant who chose it was returned to a case
 * page that did not mention the fee, and nothing ever asked again — so the
 * money was not so much uncollected as forgotten, by both sides.
 *
 * Three kinds of obligation are chased, all from due_payment_reminders():
 * unpaid case filing fees, engagement deposits an administrator has booked but
 * nobody has funded, and property verifications requested without payment.
 * The cadence — day 1, day 3, day 7, then weekly — lives in the database, not
 * here, so changing it does not mean redeploying this function.
 *
 * CLAIM BEFORE SENDING. record_payment_reminder() is called FIRST and the row
 * is skipped if it returns false, because the UNIQUE constraint means another
 * sweep already took that step. The cost of this ordering is that a send which
 * fails after the claim is a reminder the payer never sees; the next step of
 * the cadence still fires, so it self-heals. The other ordering would double-
 * nag someone about money on every overlapping run, which is how an app gets
 * muted and then uninstalled.
 *
 * Deploy: supabase functions deploy payment-reminders --no-verify-jwt
 * Schedule alongside push-dispatch and custodian-sweep. Hourly is ample —
 * the cadence is measured in days and the ledger makes re-runs free.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ObligationKind = 'case_filing' | 'engagement_deposit' | 'property_verification';

interface DueRow {
  obligation_kind: ObligationKind;
  obligation_id: string;
  user_id: string;
  next_sequence: number;
  amount: number;
  currency: string;
  subject: string;
  pay_link: string;
  days_outstanding: number;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Constant-time, so the secret cannot be recovered by timing guesses. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function money(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

/**
 * What the payer is actually told. Each kind names the thing they recognise —
 * their case, their property — rather than an obligation id or a service key,
 * and says what the payment unlocks rather than only that money is owed.
 */
function compose(row: DueRow): { title: string; message: string } {
  const sum = money(row.amount, row.currency);
  const age = row.days_outstanding === 1 ? '1 day' : `${row.days_outstanding} days`;

  switch (row.obligation_kind) {
    case 'case_filing':
      return {
        title: 'Your case filing fee is outstanding',
        message:
          `${sum} is due on "${row.subject}", filed ${age} ago. ` +
          `The case is held open, but it cannot be assigned to an investigator until the fee is paid.`,
      };
    case 'engagement_deposit':
      return {
        title: 'A deposit is needed to begin work',
        message:
          `${sum} is due on "${row.subject}". ` +
          `The professional booked to your case is waiting on this deposit before starting.`,
      };
    case 'property_verification':
      return {
        title: 'Your property verification is waiting on payment',
        message:
          `${sum} is due on "${row.subject}", requested ${age} ago. ` +
          `The title check begins once the payment clears.`,
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('PAYMENT_REMINDER_SECRET') ?? '';
  if (!expected) {
    // Refuses rather than running open. An unauthenticated caller could
    // otherwise burn every payer's cadence in a single loop.
    console.error('PAYMENT_REMINDER_SECRET is not set; refusing to run');
    return json({ error: 'Not configured' }, 500);
  }

  if (!secretMatches(req.headers.get('x-sweep-secret') ?? '', expected)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // The in-app link is a path; email needs somewhere a browser can go.
  const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://thesecuritywatch.com';
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('due_payment_reminders');
  if (error) {
    console.error('due_payment_reminders failed', error.message);
    return json({ error: 'Query failed' }, 500);
  }

  const due = (data ?? []) as DueRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let emailFailed = 0;

  for (const row of due) {
    const { title, message } = compose(row);

    // Claim the step. See the header for why this precedes the send.
    const { data: claimed, error: claimErr } = await supabase.rpc('record_payment_reminder', {
      p_kind: row.obligation_kind,
      p_obligation: row.obligation_id,
      p_user: row.user_id,
      p_sequence: row.next_sequence,
      p_channels: ['in_app', 'push', 'email'],
    });

    if (claimErr) {
      console.error('claim failed', row.obligation_kind, row.obligation_id, claimErr.message);
      failed++;
      continue;
    }
    if (claimed !== true) {
      // Another sweep took this step. Correct behaviour, not an error.
      skipped++;
      continue;
    }

    // One insert covers two channels: 025 made `notifications` the push queue,
    // so push-dispatch picks this row up on its next run.
    const { error: notifyErr } = await supabase.from('notifications').insert({
      user_id: row.user_id,
      title,
      message,
      type: 'warning',
      link: row.pay_link,
    });

    if (notifyErr) {
      console.error('notify failed', row.obligation_id, notifyErr.message);
      failed++;
      continue;
    }
    sent++;

    // Email is best effort. A reminder that reached the app and the handset is
    // still a reminder, and failing the whole row here would strand the claim.
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId: row.user_id,
          template: 'payment_reminder',
          data: {
            caseTitle: row.subject,
            amount: money(row.amount, row.currency),
            extraNote: message,
            actionUrl: `${SITE_URL}${row.pay_link}`,
          },
        }),
      });
      if (!res.ok) {
        emailFailed++;
        console.warn('reminder email rejected', row.obligation_id, res.status);
      }
    } catch (mailErr) {
      emailFailed++;
      console.warn('reminder email failed', (mailErr as Error).message);
    }
  }

  // Counts only. Who owes money is not something to leave in a log line.
  return json({ due: due.length, sent, skipped, failed, emailFailed }, 200);
});
