import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Image,
  Video,
  Music,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Download,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { useCaseStore } from '@/stores/caseStore';
import {
  buildCustodyCertificate,
  openCustodyCertificate,
} from '@/services/custodyExport';
import type { Evidence, CustodyLog } from '@/types';
import { cn } from '@/utils/cn';

/**
 * Resolved from a module-scope table rather than a function called during
 * render — the React Compiler treats a component produced mid-render as a new
 * component type each pass, which forces a remount.
 */
const FILE_ICONS = {
  image: Image,
  video: Video,
  audio: Music,
  file: FileText,
} as const;

function fileIconKey(fileType: string): keyof typeof FILE_ICONS {
  if (fileType?.startsWith('image/')) return 'image';
  if (fileType?.startsWith('video/')) return 'video';
  if (fileType?.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface EvidenceTimelineProps {
  evidence: Evidence[];
  uploaderNames?: Record<string, string>;
  className?: string;
  /** Printed on the custody certificate so it identifies its own subject. */
  caseTitle?: string;
  caseId?: string;
  /** Who is issuing — recorded on the document. */
  issuedBy?: string;
}

/**
 * Filed evidence, newest first, with its chain of custody.
 *
 * Opening a file downloads it and re-hashes the bytes against the SHA-256
 * recorded at upload. A hash nobody verifies proves nothing, so the result is
 * shown on the item and the access is appended to the custody log.
 */
export function EvidenceTimeline({
  evidence,
  uploaderNames = {},
  className,
  caseTitle = 'Untitled case',
  caseId = '',
  issuedBy = 'The Security Watch',
}: EvidenceTimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-surface-200" aria-hidden />

      <div className="space-y-0">
        {evidence.map((item, index) => (
          <EvidenceTimelineItem
            key={item.id}
            item={item}
            index={index}
            uploaderName={uploaderNames[item.uploaded_by] ?? 'Unknown'}
            caseTitle={caseTitle}
            caseId={caseId}
            issuedBy={issuedBy}
          />
        ))}
      </div>
    </div>
  );
}

interface EvidenceTimelineItemProps {
  item: Evidence;
  caseTitle: string;
  caseId: string;
  issuedBy: string;
  index: number;
  uploaderName: string;
}

function EvidenceTimelineItem({
  item,
  index,
  uploaderName,
  caseTitle,
  caseId,
  issuedBy,
}: EvidenceTimelineItemProps) {
  const [custodyExpanded, setCustodyExpanded] = useState(false);
  const [opening, setOpening] = useState(false);
  const [integrity, setIntegrity] = useState<boolean | null>(null);
  const downloadEvidence = useCaseStore((s) => s.downloadEvidence);

  const Icon = FILE_ICONS[fileIconKey(item.file_type)];
  const hasCustody = item.chain_of_custody?.length > 0;

  const handleCertificate = () => {
    const html = buildCustodyCertificate({
      evidence: item,
      caseTitle,
      caseId,
      issuedBy,
      verifiedNow: integrity,
    });

    if (!openCustodyCertificate(html)) {
      toast.error('Allow pop-ups for this site to open the certificate.');
    }
  };

  const handleOpen = async () => {
    setOpening(true);
    const { blob, verified, error } = await downloadEvidence(item);
    setOpening(false);

    if (error) {
      toast.error(`Could not open that file: ${error}`);
      return;
    }

    setIntegrity(verified);

    if (verified === false) {
      toast.error(
        'INTEGRITY FAILURE — this file no longer matches the hash recorded when it was filed. Do not rely on it, and report this immediately.',
        { duration: 10_000 }
      );
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex gap-4 pl-2"
    >
      {/* Timeline dot */}
      <motion.div
        className="absolute left-3 top-6 w-4 h-4 rounded-full bg-brand-500 border-2 border-white shadow-sm z-10"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.05 + 0.1, type: 'spring', stiffness: 200 }}
      />

      <div className="flex-1 pl-8 pb-8">
        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-surface-900 truncate">{item.file_name}</h4>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-surface-500">
                <span>{formatFileSize(item.file_size)}</span>
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {uploaderName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              {item.description && (
                <p className="mt-2 text-sm text-surface-600">{item.description}</p>
              )}
              {item.file_hash && (
                <p className="mt-1 text-xs text-surface-400 font-mono truncate" title={item.file_hash}>
                  SHA-256: {item.file_hash}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  loading={opening}
                  disabled={opening}
                  onClick={() => void handleOpen()}
                >
                  Open &amp; verify
                </Button>

                {/*
                  The integrity record is only useful where it matters — with a
                  lawyer, an insurer, a court — and until now it existed solely
                  inside this screen. `integrity` is passed through so the
                  document states whether the file was re-verified at the moment
                  it was issued, rather than implying a check that never ran.
                */}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={FileText}
                  onClick={handleCertificate}
                >
                  Custody certificate
                </Button>

                {integrity === true && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                    <ShieldCheck size={13} /> Integrity verified
                  </span>
                )}
                {integrity === false && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-700">
                    <ShieldAlert size={13} /> Hash mismatch — do not rely on this file
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasCustody && (
            <div className="mt-4 pt-4 border-t border-surface-100">
              <button
                type="button"
                onClick={() => setCustodyExpanded(!custodyExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Chain of Custody ({item.chain_of_custody.length} entries)
                {custodyExpanded ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              <AnimatePresence>
                {custodyExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      {item.chain_of_custody.map((log: CustodyLog, i: number) => (
                        <CustodyLogEntry key={i} log={log} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CustodyLogEntry({ log }: { log: CustodyLog }) {
  return (
    <div className="flex gap-3 rounded-lg bg-surface-50 px-3 py-2 text-sm">
      <span className="text-surface-500 shrink-0">
        {format(new Date(log.timestamp), 'MMM d, HH:mm')}
      </span>
      <span className="font-medium text-surface-700 capitalize">{log.action}</span>
      <span className="text-surface-600">by {log.user_name}</span>
      {log.notes && (
        <span className="text-surface-500 italic">— {log.notes}</span>
      )}
    </div>
  );
}
