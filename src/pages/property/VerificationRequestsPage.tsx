import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Plus, Home, Eye, X, CreditCard, FileSearch } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  StatusBadge,
  EmptyState,
  Spinner,
  Modal,
  Select,
  TextArea,
} from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { usePropertyStore } from '@/stores/propertyStore';
import {
  fetchMyVerificationRequests,
  requestPropertyVerification,
  cancelVerificationRequest,
} from '@/services/propertyExtrasService';
import { fetchServicePrices, formatCurrency } from '@/services/paymentService';
import {
  PROPERTY_VERIFICATION_STATUS_LABELS,
  type PropertyVerificationRequest,
  type ServicePrice,
} from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Tenant-side title verification requests.
 *
 * Was a hardcoded list with a "New request" button that did nothing. A request
 * is now a real row that starts at "awaiting payment"; the Paystack webhook moves
 * it into the admin review queue once the verification fee settles, so the queue
 * cannot be entered without a confirmed payment.
 */
export default function VerificationRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { properties, fetchProperties } = usePropertyStore();

  const [requests, setRequests] = useState<PropertyVerificationRequest[]>([]);
  const [price, setPrice] = useState<ServicePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [requestsResult, pricesResult] = await Promise.all([
      fetchMyVerificationRequests(user.user_id),
      fetchServicePrices('property'),
    ]);

    if (requestsResult.error) toast.error(requestsResult.error);
    setRequests(requestsResult.requests);
    setPrice(pricesResult.prices.find((p) => p.key === 'property_verification') ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
    void fetchProperties();
  }, [load, fetchProperties]);

  // A property already under request should not be offered again.
  const requestedIds = useMemo(
    () =>
      new Set(
        requests
          .filter((r) => r.status !== 'cancelled' && r.status !== 'failed')
          .map((r) => r.property_id)
      ),
    [requests]
  );

  const propertyOptions = useMemo(
    () =>
      properties
        .filter((p) => p.status !== 'verified' && !requestedIds.has(p.id))
        .map((p) => ({ value: p.id, label: `${p.title} — ${p.location}` })),
    [properties, requestedIds]
  );

  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedProperty) {
      toast.error('Choose the property you want verified.');
      return;
    }

    setSubmitting(true);
    const { id, error } = await requestPropertyVerification(
      user.user_id,
      selectedProperty,
      reason.trim() || undefined
    );
    setSubmitting(false);

    if (error || !id) {
      toast.error(error ?? 'Could not raise that request.');
      return;
    }

    setModalOpen(false);
    setSelectedProperty('');
    setReason('');
    toast.success('Request created. Pay the verification fee to put it in the review queue.');
    await load();

    navigate(
      `/app/payments?purpose=property_verification&propertyId=${encodeURIComponent(selectedProperty)}`
    );
  };

  const handleCancel = async (request: PropertyVerificationRequest) => {
    if (!window.confirm('Cancel this verification request?')) return;
    setCancelling(request.id);
    const { error } = await cancelVerificationRequest(request.id);
    setCancelling(null);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Request cancelled.');
    await load();
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
          <h1 className="text-2xl font-bold text-surface-900">Verification requests</h1>
          <p className="text-surface-500 mt-1">
            Have a listing's title documents checked independently before you commit money to it.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>
          New request
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-50 border border-brand-200">
        <ShieldCheck size={20} className="text-brand-600 mt-0.5 shrink-0" />
        <div className="text-sm text-brand-800">
          <p className="font-medium mb-0.5">What verification covers</p>
          <p>
            Our team examines the title documents on file, confirms them against the relevant land
            registry, and inspects the property. A listing only carries the verified badge once that
            check passes — an owner cannot apply it themselves.
            {price && (
              <>
                {' '}
                The fee is{' '}
                <strong>{formatCurrency(Number(price.amount), price.currency)}</strong> per property.
              </>
            )}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No verification requests"
          description="Request a check on any listing you are seriously considering. You will see its progress here."
          action={
            <Button icon={Plus} onClick={() => setModalOpen(true)}>
              Request a verification
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-900 truncate">
                      {request.property?.title ?? 'Listing unavailable'}
                    </p>
                    <p className="text-sm text-surface-500 flex items-center gap-1.5 truncate">
                      <Home size={13} className="shrink-0" />
                      {request.property?.location ?? '—'}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      request.status === 'verified'
                        ? 'verified'
                        : request.status === 'failed'
                          ? 'rejected'
                          : request.status === 'cancelled'
                            ? 'cancelled'
                            : request.status === 'in_review'
                              ? 'in-progress'
                              : 'pending'
                    }
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-surface-600">
                  {PROPERTY_VERIFICATION_STATUS_LABELS[request.status]}
                  {request.status === 'pending' &&
                    ' — pay the verification fee to start the review.'}
                </p>

                {request.reason && (
                  <p className="text-sm text-surface-500 italic">"{request.reason}"</p>
                )}

                {request.admin_notes && (
                  <div className="text-sm bg-surface-50 border border-surface-200 rounded-lg p-3">
                    <p className="font-medium text-surface-700 mb-0.5">Reviewer notes</p>
                    <p className="text-surface-600">{request.admin_notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-surface-400">
                    Raised {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    {request.reviewed_at && (
                      <> · reviewed {format(new Date(request.reviewed_at), 'd MMM yyyy')}</>
                    )}
                  </p>

                  <div className="flex gap-2">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          icon={CreditCard}
                          onClick={() =>
                            navigate(
                              `/app/payments?purpose=property_verification&propertyId=${encodeURIComponent(request.property_id)}`
                            )
                          }
                        >
                          Pay fee
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={X}
                          loading={cancelling === request.id}
                          disabled={cancelling !== null}
                          onClick={() => void handleCancel(request)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {request.property_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Eye}
                        onClick={() => navigate(`/app/property/${request.property_id}`)}
                      >
                        View listing
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Request a verification"
        size="md"
      >
        <div className="space-y-4">
          {propertyOptions.length === 0 ? (
            <p className="text-sm text-surface-600">
              There are no listings available to verify — either every listing you can see is already
              verified, or you have an open request on it.
            </p>
          ) : (
            <>
              <Select
                label="Property"
                options={propertyOptions}
                placeholder="Choose a listing"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                required
              />
              <TextArea
                label="What would you like us to check? (optional)"
                placeholder="e.g. Confirm the certificate of occupancy and that there is no existing charge on the title."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
              {price && (
                <p className="text-sm text-surface-600">
                  Fee:{' '}
                  <strong className="tabular-nums">
                    {formatCurrency(Number(price.amount), price.currency)}
                  </strong>
                  . You will be taken to checkout after the request is created.
                </p>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              loading={submitting}
              disabled={submitting || propertyOptions.length === 0}
              className="flex-1"
            >
              Create request
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
