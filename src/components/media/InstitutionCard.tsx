import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Institution } from '@/types';
import { cn } from '@/utils/cn';

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  police: 'Police',
  school: 'School',
  hospital: 'Hospital',
  market: 'Market',
  government: 'Government',
  court: 'Court',
  other: 'Other',
};

export interface InstitutionCardProps {
  institution: Institution;
  scorePreview?: number;
  onClick?: () => void;
  className?: string;
}

export function InstitutionCard({
  institution,
  scorePreview,
  onClick,
  className,
}: InstitutionCardProps) {
  const content = (
    <Card hover className={cn('h-full', className)}>
      <CardContent className="p-4">
        <h3 className="font-semibold text-surface-900 mb-2 line-clamp-2">
          {institution.name}
        </h3>
        <Badge variant="info" size="sm" className="mb-2">
          {INSTITUTION_TYPE_LABELS[institution.type] ?? institution.type}
        </Badge>
        {institution.location && (
          <div className="flex items-center gap-1.5 text-sm text-surface-600 mb-2">
            <MapPin size={14} className="shrink-0 text-brand-500" />
            <span className="truncate">{institution.location}</span>
          </div>
        )}
        {scorePreview != null && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-sm font-medium text-surface-700">Score:</span>
            <span
              className={cn(
                'font-bold',
                scorePreview >= 4
                  ? 'text-green-600'
                  : scorePreview >= 3
                    ? 'text-amber-600'
                    : 'text-accent-600'
              )}
            >
              {scorePreview.toFixed(1)}/5
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {onClick ? (
        <div onClick={onClick} className="cursor-pointer">
          {content}
        </div>
      ) : (
        <Link to={`/app/media/institutions/${institution.id}`}>{content}</Link>
      )}
    </motion.div>
  );
}
