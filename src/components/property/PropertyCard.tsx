import { motion } from 'framer-motion';
import { MapPin, Bed, Bath } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Property } from '@/types';
import { cn } from '@/utils/cn';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  house: 'House',
  land: 'Land',
  commercial: 'Commercial',
  office: 'Office',
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  sale: 'For Sale',
  rent: 'For Rent',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'default'> = {
  verified: 'success',
  pending: 'warning',
  unverified: 'default',
};

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
  className?: string;
}

export function PropertyCard({ property, onClick, className }: PropertyCardProps) {
  const imageUrl = property.images?.[0] || null;
  const statusVariant = STATUS_VARIANTS[property.status] ?? 'default';

  const content = (
    <Card hover className={cn('h-full overflow-hidden', className)}>
      <div className="relative aspect-[4/3] bg-surface-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="text-4xl text-brand-300 font-display">TSW</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge variant={statusVariant} size="sm">
            {property.status === 'verified' ? 'Verified' : property.status === 'pending' ? 'Pending' : 'Unverified'}
          </Badge>
          <Badge variant="info" size="sm">
            {LISTING_TYPE_LABELS[property.listing_type] ?? property.listing_type}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-surface-900 line-clamp-2 mb-1">
          {property.title}
        </h3>
        <p className="text-lg font-bold text-brand-600 mb-2">
          {formatPrice(property.price, property.currency)}
        </p>
        {property.location && (
          <div className="flex items-center gap-1.5 text-sm text-surface-600 mb-2">
            <MapPin size={14} className="shrink-0 text-brand-500" />
            <span className="truncate">{property.location}</span>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm text-surface-500">
          {property.bedrooms != null && (
            <span className="flex items-center gap-1">
              <Bed size={14} />
              {property.bedrooms}
            </span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath size={14} />
              {property.bathrooms}
            </span>
          )}
        </div>
        <Badge variant="default" size="sm" className="mt-2">
          {PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}
        </Badge>
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      {onClick ? (
        <div onClick={onClick} className="h-full cursor-pointer">
          {content}
        </div>
      ) : (
        <Link to={`/app/property/${property.id}`} className="block h-full">
          {content}
        </Link>
      )}
    </motion.div>
  );
}
