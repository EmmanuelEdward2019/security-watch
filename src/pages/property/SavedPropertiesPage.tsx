import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, MapPin, Eye, Trash2, Home, BedDouble, Bath } from 'lucide-react';
import { Card, CardContent, Button, EmptyState, Spinner, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { fetchSavedProperties, unsaveProperty } from '@/services/propertyExtrasService';
import { formatCurrency } from '@/services/paymentService';
import type { SavedProperty } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Saved listings.
 *
 * Previously a hardcoded array in local state, so a saved property vanished on
 * reload and nothing was persisted. Backed by the `saved_properties` table now,
 * which RLS scopes to the owning user.
 */
export default function SavedPropertiesPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { saved: items, error } = await fetchSavedProperties(user.user_id);
    if (error) toast.error(error);
    setSaved(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async (propertyId: string) => {
    if (!user) return;
    setRemoving(propertyId);
    const { error } = await unsaveProperty(user.user_id, propertyId);
    setRemoving(null);

    if (error) {
      toast.error(error);
      return;
    }
    setSaved((prev) => prev.filter((s) => s.property_id !== propertyId));
    toast.success('Removed from saved listings.');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Saved properties</h1>
          <p className="text-surface-500 mt-1">
            Listings you have bookmarked. Verification status updates as our team reviews each
            property.
          </p>
        </div>
        <span className="text-sm text-surface-500 tabular-nums">
          {saved.length} {saved.length === 1 ? 'listing' : 'listings'}
        </span>
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Browse the marketplace and use the bookmark button on a listing to keep it here."
          action={
            <Button onClick={() => navigate('/app/property')} icon={Home}>
              Browse properties
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((item) => {
            const property = item.property;
            if (!property) return null;

            return (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                {property.images?.[0] ? (
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 w-full bg-surface-100 flex items-center justify-center">
                    <Home size={32} className="text-surface-300" />
                  </div>
                )}

                <CardContent className="flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-surface-900 line-clamp-2">{property.title}</h2>
                    <Badge
                      variant={
                        property.status === 'verified'
                          ? 'success'
                          : property.status === 'pending'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {property.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-surface-500 flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{property.location}</span>
                  </p>

                  <p className="text-lg font-bold text-surface-900 tabular-nums">
                    {formatCurrency(Number(property.price), property.currency)}
                    {property.listing_type === 'rent' && (
                      <span className="text-sm font-normal text-surface-500"> / year</span>
                    )}
                  </p>

                  {(property.bedrooms || property.bathrooms) && (
                    <div className="flex items-center gap-4 text-sm text-surface-500">
                      {property.bedrooms ? (
                        <span className="flex items-center gap-1">
                          <BedDouble size={14} /> {property.bedrooms}
                        </span>
                      ) : null}
                      {property.bathrooms ? (
                        <span className="flex items-center gap-1">
                          <Bath size={14} /> {property.bathrooms}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <p className="text-xs text-surface-400 mt-auto">
                    Saved {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/app/property/${property.id}`)}
                      icon={Eye}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      loading={removing === property.id}
                      disabled={removing !== null}
                      onClick={() => void handleRemove(property.id)}
                      aria-label={`Remove ${property.title} from saved`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {saved.length > 0 && (
        <p className="text-sm text-surface-500">
          Considering one of these?{' '}
          <Link to="/app/property/verify" className="text-brand-600 hover:underline">
            Request an independent title verification
          </Link>{' '}
          before you pay anything.
        </p>
      )}
    </motion.div>
  );
}
