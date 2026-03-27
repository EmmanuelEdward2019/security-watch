import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Heart, FileCheck, Clock } from 'lucide-react';
import { usePropertyStore } from '@/stores/propertyStore';
import { useAuthStore } from '@/stores/authStore';
import { PropertyCard } from '@/components/property/PropertyCard';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  EmptyState,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';

export function TenantDashboard() {
  const { user } = useAuthStore();
  const {
    properties,
    requests,
    isLoading,
    fetchProperties,
    fetchRequests,
  } = usePropertyStore();

  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('tsw-saved-properties');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (user?.user_id) {
      fetchRequests(user.user_id, false);
    }
    fetchProperties();
  }, [user?.user_id, fetchProperties, fetchRequests]);

  const savedProperties = properties.filter((p) => savedIds.has(p.id));

  const toggleSaved = (id: string) => {
    const next = new Set(savedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSavedIds(next);
    localStorage.setItem('tsw-saved-properties', JSON.stringify([...next]));
  };

  const requestStatusMap: Record<string, string> = {
    pending: 'pending',
    accepted: 'active',
    rejected: 'rejected',
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Sign in required"
          description="Please sign in to access your tenant dashboard."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900">Tenant Dashboard</h1>
          <p className="text-surface-600 mt-1">
            Track your property requests and saved listings
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Browse CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="bg-gradient-to-br from-brand-50 to-brand-100/50 border-brand-200">
              <CardContent className="p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-xl font-semibold text-surface-900 mb-2">
                    Find your next home
                  </h2>
                  <p className="text-surface-600 mb-4">
                    Browse verified properties from trusted landlords.
                  </p>
                  <Link to="/app/property">
                    <Button variant="primary" icon={Search} size="lg">
                      Browse Properties
                    </Button>
                  </Link>
                </div>
                <div className="text-6xl text-brand-300/50">🏠</div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Background check placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileCheck size={20} className="text-brand-500" />
                  Background Check
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <FileCheck size={20} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-900 text-sm">Status</p>
                    <p className="text-sm text-surface-500">
                      Complete your profile for faster verification
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* My Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={20} />
                My Requests
              </h2>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  title="No requests yet"
                  description="When you request a property, it will appear here."
                  action={
                    <Link to="/app/property">
                      <Button variant="outline">Browse Properties</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-4 rounded-lg border border-surface-200 hover:border-brand-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/app/property/${req.property_id}`}
                          className="font-medium text-surface-900 hover:text-brand-600"
                        >
                          {req.property?.title ?? 'Property'}
                        </Link>
                        <p className="text-sm text-surface-500 mt-0.5">
                          {formatDistanceToNow(new Date(req.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <StatusBadge
                        status={requestStatusMap[req.status] ?? req.status}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Saved Properties */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Heart size={20} className="text-accent-500" />
                Saved Properties
              </h2>
            </CardHeader>
            <CardContent>
              {savedProperties.length === 0 ? (
                <EmptyState
                  title="No saved properties"
                  description="Save properties you like by clicking the heart icon while browsing."
                  action={
                    <Link to="/app/property">
                      <Button variant="outline" icon={Search}>
                        Browse Properties
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedProperties.map((property) => (
                    <div key={property.id} className="relative">
                      <PropertyCard property={property} />
                      <button
                        type="button"
                        onClick={() => toggleSaved(property.id)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/90 shadow hover:bg-white z-10"
                        aria-label="Remove from saved"
                      >
                        <Heart
                          size={20}
                          className="text-accent-500 fill-accent-500"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
