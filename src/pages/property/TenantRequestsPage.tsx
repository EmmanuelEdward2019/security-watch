import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  Check,
  X,
  User,
  Home,
  MessageSquare,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  StatsCard,
  StatusBadge,
  EmptyState,
  Spinner,
  Avatar,
} from '@/components/ui';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import {
  fetchTenantRequestsForOwner,
  respondToPropertyRequest,
} from '@/services/propertyExtrasService';
import type { PropertyRequest } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

type FilterTab = 'all' | 'pending' | 'accepted' | 'rejected';

/**
 * Tenant enquiries on a landlord's listings.
 *
 * Ran on a hardcoded array before, so accepting or rejecting a request changed
 * nothing. Real `property_requests` rows now, and accepting one opens a direct
 * conversation with the enquirer so there is somewhere to continue.
 */
export default function TenantRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const createConversation = useMessageStore((s) => s.createConversation);
  const navigate = useNavigate();

  const [requests, setRequests] = useState<PropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    const { requests: rows, error } = await fetchTenantRequestsForOwner();
    if (error) toast.error(error);
    setRequests(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
    }),
    [requests]
  );

  const visible = useMemo(
    () => (tab === 'all' ? requests : requests.filter((r) => r.status === tab)),
    [requests, tab]
  );

  const handleRespond = async (request: PropertyRequest, status: 'accepted' | 'rejected') => {
    setActing(request.id);
    const { error } = await respondToPropertyRequest(request.id, status);

    if (error) {
      setActing(null);
      toast.error(error);
      return;
    }

    // An accepted enquiry needs a channel to continue in.
    if (status === 'accepted' && user && request.requester_id) {
      const { id, error: convError } = await createConversation(
        'direct',
        [request.requester_id],
        undefined,
        request.property?.title ?? 'Property enquiry'
      );
      if (convError) {
        toast.error(`Request accepted, but the chat could not be opened: ${convError}`);
      } else if (id) {
        toast.success('Request accepted. A conversation is open in Messages.');
      }
    } else {
      toast.success('Request declined.');
    }

    setActing(null);
    await load();
  };

  const openChat = async (request: PropertyRequest) => {
    if (!request.requester_id) return;
    const { id, error } = await createConversation(
      'direct',
      [request.requester_id],
      undefined,
      request.property?.title ?? 'Property enquiry'
    );
    if (error || !id) {
      toast.error(error ?? 'Could not open a conversation.');
      return;
    }
    navigate('/app/messages');
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
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Tenant requests</h1>
        <p className="text-surface-500 mt-1">
          Enquiries from prospective tenants and buyers on your listings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard label="Total enquiries" value={stats.total} icon={ClipboardList} />
        <StatsCard label="Awaiting response" value={stats.pending} icon={Clock} variant="warning" />
        <StatsCard label="Accepted" value={stats.accepted} icon={CheckCircle} variant="success" />
      </div>

      <div
        role="tablist"
        aria-label="Filter requests by status"
        className="flex flex-wrap gap-2 border-b border-surface-200 pb-3"
      >
        {(
          [
            ['pending', `Pending (${stats.pending})`],
            ['accepted', 'Accepted'],
            ['rejected', 'Declined'],
            ['all', 'All'],
          ] as [FilterTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              tab === id
                ? 'bg-brand-500 text-white'
                : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'pending' ? 'No enquiries waiting' : 'Nothing here'}
          description={
            tab === 'pending'
              ? 'When someone enquires about one of your listings, it will appear here for you to accept or decline.'
              : 'There are no requests with this status.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar
                      src={request.requester?.avatar_url}
                      name={request.requester?.full_name ?? 'Unknown'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 truncate">
                        {request.requester?.full_name ?? 'Unknown enquirer'}
                      </p>
                      <p className="text-sm text-surface-500 flex items-center gap-1.5 truncate">
                        <Home size={13} className="shrink-0" />
                        {request.property?.title ?? 'Listing unavailable'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={
                        request.status === 'accepted'
                          ? 'active'
                          : request.status === 'rejected'
                            ? 'rejected'
                            : 'pending'
                      }
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <blockquote className="text-sm text-surface-700 bg-surface-50 border-l-2 border-brand-500 pl-3 py-2">
                  {request.message}
                </blockquote>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-surface-400 space-y-0.5">
                    <p>
                      Received {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      {' · '}
                      {format(new Date(request.created_at), 'd MMM yyyy, HH:mm')}
                    </p>
                    {request.requester?.email && (
                      <p className="flex items-center gap-1">
                        <User size={11} /> {request.requester.email}
                        {request.requester.phone ? ` · ${request.requester.phone}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {request.status === 'pending' ? (
                      <>
                        <Button
                          size="sm"
                          icon={Check}
                          loading={acting === request.id}
                          disabled={acting !== null}
                          onClick={() => void handleRespond(request, 'accepted')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={X}
                          disabled={acting !== null}
                          onClick={() => void handleRespond(request, 'rejected')}
                        >
                          Decline
                        </Button>
                      </>
                    ) : request.status === 'accepted' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={MessageSquare}
                        onClick={() => void openChat(request)}
                      >
                        Open chat
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
