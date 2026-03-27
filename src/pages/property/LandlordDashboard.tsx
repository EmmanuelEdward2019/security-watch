import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  FileCheck,
  MessageSquare,
  List,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { usePropertyStore } from '@/stores/propertyStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  StatsCard,
  Spinner,
  EmptyState,
  StatusBadge,
  Avatar,
} from '@/components/ui';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export function LandlordDashboard() {
  const { user } = useAuthStore();
  const {
    properties,
    requests,
    isLoading,
    fetchProperties,
    fetchRequests,
    updateRequest,
    deleteProperty,
  } = usePropertyStore();

  useEffect(() => {
    if (user?.user_id) {
      fetchProperties(user.user_id);
      fetchRequests(user.user_id, true);
    }
  }, [user?.user_id, fetchProperties, fetchRequests]);

  const myProperties = properties;
  const verifiedCount = myProperties.filter((p) => p.status === 'verified').length;
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const activeListings = myProperties.filter((p) => p.is_active).length;

  const handleAcceptRequest = async (id: string) => {
    const { error } = await updateRequest(id, 'accepted');
    if (error) toast.error(error);
    else {
      toast.success('Request accepted');
      user && fetchRequests(user.user_id, true);
    }
  };

  const handleRejectRequest = async (id: string) => {
    const { error } = await updateRequest(id, 'rejected');
    if (error) toast.error(error);
    else {
      toast.success('Request rejected');
      user && fetchRequests(user.user_id, true);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    const { error } = await deleteProperty(id);
    if (error) toast.error(error);
    else {
      toast.success('Property removed');
      user && fetchProperties(user.user_id);
    }
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
          description="Please sign in to access your landlord dashboard."
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
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Landlord Dashboard</h1>
            <p className="text-surface-600 mt-1">Manage your properties and tenant requests</p>
          </div>
          <Link to="/app/property/create">
            <Button variant="primary" icon={Plus} size="lg">
              List New Property
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatsCard
            icon={Home}
            label="Total Properties"
            value={myProperties.length}
            variant="brand"
          />
          <StatsCard
            icon={FileCheck}
            label="Verified"
            value={verifiedCount}
            variant="success"
          />
          <StatsCard
            icon={MessageSquare}
            label="Pending Requests"
            value={pendingRequests}
            variant="warning"
          />
          <StatsCard
            icon={List}
            label="Active Listings"
            value={activeListings}
            variant="default"
          />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* My Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-lg font-semibold">My Properties</h2>
                <Link to="/app/property/create">
                  <Button variant="ghost" size="sm" icon={Plus}>
                    Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : myProperties.length === 0 ? (
                  <EmptyState
                    title="No properties yet"
                    description="List your first property to start receiving tenant requests."
                    action={
                      <Link to="/app/property/create">
                        <Button variant="primary" icon={Plus}>
                          List New Property
                        </Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {myProperties.map((property) => (
                      <motion.div
                        key={property.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-4 p-4 rounded-lg border border-surface-200 bg-white hover:border-brand-200 transition-colors"
                      >
                        <div className="w-20 h-16 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          {property.images?.[0] ? (
                            <img
                              src={property.images[0]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-400">
                              <Home size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-surface-900 truncate">
                            {property.title}
                          </h3>
                          <StatusBadge
                            status={requestStatusMap[property.status] ?? property.status}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={`/app/property/${property.id}`}>
                            <Button variant="ghost" size="sm" icon={Edit2}>
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            className="text-accent-600 hover:text-accent-700"
                            onClick={() => handleDeleteProperty(property.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Tenant Requests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Tenant Requests</h2>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <EmptyState
                    title="No requests yet"
                    description="Requests from tenants will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 rounded-lg border border-surface-200 bg-surface-50/50"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar
                            src={req.requester?.avatar_url}
                            name={req.requester?.full_name ?? 'User'}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-surface-900 text-sm">
                              {req.requester?.full_name ?? 'Unknown'}
                            </p>
                            <p className="text-sm text-surface-600 line-clamp-2 mt-0.5">
                              {req.message}
                            </p>
                            <p className="text-xs text-surface-500 mt-1">
                              {req.property?.title} •{' '}
                              {formatDistanceToNow(new Date(req.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                            {req.status === 'pending' && (
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAcceptRequest(req.id)}
                                  icon={Check}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleRejectRequest(req.id)}
                                  icon={X}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {req.status !== 'pending' && (
                              <StatusBadge
                                status={requestStatusMap[req.status] ?? req.status}
                                className="mt-2"
                              />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
