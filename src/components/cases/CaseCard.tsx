import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import {
  CASE_CATEGORY_LABELS,
  CASE_URGENCY_LABELS,
  type Case,
  type CaseCategory,
  type CaseUrgency,
} from '@/types';
import { cn } from '@/utils/cn';

const CATEGORY_VARIANTS: Record<CaseCategory, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  fraud: 'warning',
  robbery: 'danger',
  murder: 'danger',
  assault: 'danger',
  domestic_dispute: 'warning',
  land_dispute: 'info',
  cybercrime: 'info',
  corruption: 'warning',
  kidnapping: 'danger',
  missing_person: 'info',
  other: 'default',
};

const URGENCY_COLORS: Record<CaseUrgency, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const STATUS_MAP: Record<string, string> = {
  submitted: 'pending',
  under_review: 'in-progress',
  assigned: 'active',
  investigating: 'in-progress',
  legal_processing: 'in-progress',
  completed: 'completed',
  closed: 'closed',
};

export interface CaseCardProps {
  caseData: Case;
  onClick?: () => void;
  className?: string;
}

export function CaseCard({ caseData, onClick, className }: CaseCardProps) {
  const categoryVariant = CATEGORY_VARIANTS[caseData.category] ?? 'default';
  const urgencyColor = URGENCY_COLORS[caseData.urgency];
  const statusDisplay = STATUS_MAP[caseData.status] ?? caseData.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, boxShadow: '0 12px 40px -12px rgba(22, 101, 52, 0.2)' }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <Card
        hover
        onClick={onClick}
        className="h-full cursor-pointer"
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-semibold text-surface-900 line-clamp-2 flex-1 min-w-0">
              {caseData.title}
            </h3>
            <span
              className={cn('shrink-0 w-2.5 h-2.5 rounded-full', urgencyColor)}
              title={CASE_URGENCY_LABELS[caseData.urgency]}
              aria-hidden
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant={categoryVariant} size="sm">
              {CASE_CATEGORY_LABELS[caseData.category]}
            </Badge>
            <StatusBadge status={statusDisplay} />
          </div>

          {caseData.location && (
            <div className="flex items-center gap-1.5 text-sm text-surface-600 mb-2">
              <MapPin size={14} className="shrink-0 text-brand-500" />
              <span className="truncate">{caseData.location}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Clock size={12} />
              {formatDistanceToNow(new Date(caseData.created_at), { addSuffix: true })}
            </div>
            {caseData.investigator && (
              <Avatar
                src={caseData.investigator.avatar_url}
                name={caseData.investigator.full_name}
                size="sm"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
