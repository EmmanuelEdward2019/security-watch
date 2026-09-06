import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Clock, FileText, AlertTriangle, Eye } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { openGrant, type OpenedGrant } from '@/services/evidenceGrantService';

/**
 * What the outside recipient sees.
 *
 * The viewer here has no account and never will — that is the point of the
 * feature. So this page is public, carries no navigation into the rest of the
 * platform, and shows nothing but the exhibits the grant names.
 *
 * FOUR THINGS IT DELIBERATELY DOES:
 *
 * 1. Opens the grant EXACTLY ONCE per page load. The call counts the view and
 *    can exhaust a limited grant, so it is guarded by a ref rather than left to
 *    an effect that React may run twice in development — a strict-mode double
 *    invocation would burn two of somebody's three permitted opens.
 *
 * 2. Watermarks the material with the recipient's name. Honest about what that
 *    is worth: it deters forwarding and makes a leak attributable. It is not
 *    forensic and the footer says so.
 *
 * 3. Prints the SHA-256 next to each exhibit, so the recipient can verify the
 *    file against a custody certificate themselves rather than taking our word.
 *
 * 4. Says nothing about why a bad link failed. Expired, withdrawn, used up and
 *    never-existed all produce the same sentence, because distinguishing them
 *    confirms to a holder that the link was once real.
 */

function useGrant(token: string | undefined) {
  const [grant, setGrant] = useState<OpenedGrant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // See note 1 above. This is the guard, not an optimisation.
  const opened = useRef(false);

  useEffect(() => {
    if (!token || opened.current) return;
    opened.current = true;

    void openGrant(token).then(({ grant: g, error: err }) => {
      setGrant(g);
      setError(err);
      setLoading(false);
    });
  }, [token]);

  return { grant, error, loading };
}

function Watermark({ name }: { name: string }) {
  // Repeated diagonally and pointer-events-none, so it sits over the material
  // without stopping the recipient scrolling or selecting text.
  const rows = Array.from({ length: 14 });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden opacity-[0.13]"
    >
      {rows.map((_, i) => (
        <div
          key={i}
          className="whitespace-nowrap py-8 text-center font-semibold uppercase tracking-[0.3em] text-surface-900"
          style={{ transform: 'rotate(-24deg)', fontSize: 13 }}
        >
          {`${name} · The Security Watch · `.repeat(6)}
        </div>
      ))}
    </div>
  );
}

function Exhibit({
  item,
  recipient,
}: {
  item: OpenedGrant['evidence'][number];
  recipient: string;
}) {
  const isImage = item.fileType?.startsWith('image/');
  const isVideo = item.fileType?.startsWith('video/');
  const isAudio = item.fileType?.startsWith('audio/');

  return (
    <article className="overflow-hidden rounded-xl border border-surface-200 bg-white">
      <div className="relative bg-surface-950">
        <Watermark name={recipient} />

        {item.url === null ? (
          // Shown as unavailable rather than dropped. A missing row would read
          // as "there was nothing", which is a different claim entirely.
          <div className="flex h-48 items-center justify-center text-sm text-surface-400">
            This exhibit could not be loaded. Try opening the link again.
          </div>
        ) : isImage ? (
          <img src={item.url} alt={item.fileName} className="mx-auto max-h-[70vh]" />
        ) : isVideo ? (
          <video src={item.url} controls className="mx-auto max-h-[70vh] w-full" />
        ) : isAudio ? (
          <div className="p-8">
            <audio src={item.url} controls className="w-full" />
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-surface-300">
            <FileText size={32} />
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              Open {item.fileName}
            </a>
          </div>
        )}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="font-medium text-surface-900">{item.fileName}</h3>
        {item.description && (
          <p className="text-sm leading-relaxed text-surface-600">{item.description}</p>
        )}
        {item.fileHash && (
          <p className="text-xs text-surface-500">
            SHA-256{' '}
            <code className="break-all font-mono text-surface-700">{item.fileHash}</code>
            <span className="mt-1 block">
              Check this against the certificate you were given — it establishes the file
              has not changed since we received it.
            </span>
          </p>
        )}
      </div>
    </article>
  );
}

export default function EvidenceGrantViewPage() {
  const { token } = useParams<{ token: string }>();
  const { grant, error, loading } = useGrant(token);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <Spinner />
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 px-6">
        <div className="max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto text-surface-400" />
          <h1 className="mt-4 text-lg font-semibold text-surface-900">
            This link cannot be opened
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-surface-600">
            {error ??
              'This link is no longer valid. It may have expired or been withdrawn.'}
          </p>
          <p className="mt-4 text-xs text-surface-500">
            If you still need this material, ask whoever sent it to issue a new link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="border-b border-surface-200 bg-forest-600 px-6 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">
            The Security Watch
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{grant.caseTitle}</h1>
          <p className="mt-1 text-sm text-white/80">
            Shared with <strong>{grant.recipientName}</strong>
            {grant.purpose ? ` · ${grant.purpose}` : ''}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/75">
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              Access ends {new Date(grant.expiresAt).toLocaleString()}
            </span>
            {grant.viewsLeft !== null && (
              <span className="flex items-center gap-1.5">
                <Eye size={13} />
                {grant.viewsLeft} {grant.viewsLeft === 1 ? 'opening' : 'openings'} left
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} />
              This opening has been recorded
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {grant.evidence.length === 0 ? (
          <p className="text-sm text-surface-600">
            There is nothing attached to this case yet.
          </p>
        ) : (
          grant.evidence.map((item) => (
            <Exhibit key={item.id} item={item} recipient={grant.recipientName} />
          ))
        )}

        <footer className="border-t border-surface-200 pt-6 text-xs leading-relaxed text-surface-500">
          <p>
            This material was shared with you under a time-boxed grant. It can be
            withdrawn at any time, including now, and every opening is recorded against
            the name above and visible to the people on the case.
          </p>
          <p className="mt-2">
            The name shown across the material identifies who this copy was issued to. It
            is a deterrent and an attribution aid, not a technical control — please treat
            this material as confidential and do not pass it on.
          </p>
          <p className="mt-2">
            Links to the files themselves expire after {grant.urlTtlSeconds} seconds.
            Reload the page to view them again.
          </p>
        </footer>
      </main>
    </div>
  );
}
