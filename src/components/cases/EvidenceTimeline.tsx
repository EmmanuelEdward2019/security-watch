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
} from 'lucide-react';
import { format } from 'date-fns';
import type { Evidence, CustodyLog } from '@/types';
import { cn } from '@/utils/cn';

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  return FileText;
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
}

export function EvidenceTimeline({
  evidence,
  uploaderNames = {},
  className,
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
          />
        ))}
      </div>
    </div>
  );
}

interface EvidenceTimelineItemProps {
  item: Evidence;
  index: number;
  uploaderName: string;
}

function EvidenceTimelineItem({ item, index, uploaderName }: EvidenceTimelineItemProps) {
  const [custodyExpanded, setCustodyExpanded] = useState(false);
  const Icon = getFileIcon(item.file_type);
  const hasCustody = item.chain_of_custody?.length > 0;

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
                  Hash: {item.file_hash}
                </p>
              )}
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
      <span className="font-medium text-surface-700">{log.action}</span>
      <span className="text-surface-600">by {log.user_name}</span>
      {log.notes && (
        <span className="text-surface-500 italic">— {log.notes}</span>
      )}
    </div>
  );
}
