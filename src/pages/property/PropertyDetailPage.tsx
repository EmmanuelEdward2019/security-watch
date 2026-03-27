import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Bed,
  Bath,
  Maximize2,
  FileText,
  MessageCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePropertyStore } from '@/stores/propertyStore';
import { useAuthStore } from '@/stores/authStore';
import { PropertyCard } from '@/components/property/PropertyCard';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Avatar,
  Badge,
  Modal,
  TextArea,
  Spinner,
  EmptyState,
} from '@/components/ui';
import toast from 'react-hot-toast';
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

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    currentProperty,
    documents,
    properties,
    isLoading,
    fetchProperty,
    fetchDocuments,
    fetchProperties,
    createRequest,
    updateProperty,
  } = usePropertyStore();

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProperty(id);
      fetchDocuments(id);
    }
  }, [id, fetchProperty, fetchDocuments]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const relatedProperties = properties
    .filter((p) => p.id !== id && p.location === currentProperty?.location)
    .slice(0, 3);

  const handleRequestProperty = async () => {
    if (!user || !id || !requestMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    setIsSubmitting(true);
    const { error } = await createRequest({
      property_id: id,
      requester_id: user.user_id,
      message: requestMessage.trim(),
      status: 'pending',
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Request sent successfully');
    setRequestModalOpen(false);
    setRequestMessage('');
    fetchProperty(id);
  };

  const handleRequestVerification = async () => {
    if (!id) return;
    setIsSubmitting(true);
    const { error } = await updateProperty(id, { status: 'pending' });
    setIsSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Verification request submitted');
    setVerificationModalOpen(false);
    fetchProperty(id);
  };

  if (isLoading && !currentProperty) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!currentProperty) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Property not found"
          description="The property you're looking for may have been removed or doesn't exist."
          action={
            <Link to="/app/property">
              <Button>Browse Properties</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const images = currentProperty.images || [];
  const owner = currentProperty.owner;

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/app/property"
          className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-brand-600 mb-6"
        >
          <ChevronLeft size={16} />
          Back to listings
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid lg:grid-cols-3 gap-8"
        >
          {/* Gallery */}
          <div className="lg:col-span-2">
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-surface-100">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[galleryIndex]}
                    alt={currentProperty.title}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryIndex((i) => (i === 0 ? images.length - 1 : i - 1))
                        }
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow-lg hover:bg-white"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryIndex((i) => (i === images.length - 1 ? 0 : i + 1))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow-lg hover:bg-white"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                  <span className="text-6xl text-brand-300 font-display">TSW</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setGalleryIndex(i)}
                    className={cn(
                      'shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors',
                      i === galleryIndex
                        ? 'border-brand-500'
                        : 'border-transparent hover:border-surface-300'
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge
                  variant={
                    currentProperty.status === 'verified'
                      ? 'success'
                      : currentProperty.status === 'pending'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {currentProperty.status === 'verified' ? (
                    <>
                      <ShieldCheck size={12} />
                      Verified
                    </>
                  ) : (
                    currentProperty.status
                  )}
                </Badge>
                <Badge variant="info">
                  {LISTING_TYPE_LABELS[currentProperty.listing_type]}
                </Badge>
                <Badge variant="default">
                  {PROPERTY_TYPE_LABELS[currentProperty.property_type]}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-surface-900 mb-2">
                {currentProperty.title}
              </h1>
              <p className="text-2xl font-bold text-brand-600">
                {formatPrice(currentProperty.price, currentProperty.currency)}
              </p>
            </div>

            {currentProperty.location && (
              <div className="flex items-center gap-2 text-surface-600">
                <MapPin size={18} className="text-brand-500 shrink-0" />
                <span>{currentProperty.location}</span>
              </div>
            )}

            <div className="flex gap-6 text-surface-600">
              {currentProperty.bedrooms != null && (
                <span className="flex items-center gap-1">
                  <Bed size={18} />
                  {currentProperty.bedrooms} beds
                </span>
              )}
              {currentProperty.bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath size={18} />
                  {currentProperty.bathrooms} baths
                </span>
              )}
              {currentProperty.area_sqm != null && (
                <span className="flex items-center gap-1">
                  <Maximize2 size={18} />
                  {currentProperty.area_sqm} m²
                </span>
              )}
            </div>

            {currentProperty.description && (
              <p className="text-surface-700 leading-relaxed">
                {currentProperty.description}
              </p>
            )}

            {currentProperty.features?.length > 0 && (
              <div>
                <h3 className="font-semibold text-surface-900 mb-2">Features</h3>
                <ul className="flex flex-wrap gap-2">
                  {currentProperty.features.map((f) => (
                    <li key={f}>
                      <Badge variant="default" size="sm">
                        {f}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Owner Card */}
            {owner && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Property Owner</h3>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <Avatar
                    src={owner.avatar_url}
                    name={owner.full_name}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-900">{owner.full_name}</p>
                    {owner.phone && (
                      <p className="text-sm text-surface-500">{owner.phone}</p>
                    )}
                  </div>
                  {user && user.user_id !== currentProperty.owner_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={MessageCircle}
                      onClick={() => setRequestModalOpen(true)}
                    >
                      Contact
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {user && user.user_id !== currentProperty.owner_id && (
                <Button
                  variant="primary"
                  className="w-full"
                  size="lg"
                  onClick={() => setRequestModalOpen(true)}
                >
                  Request Property
                </Button>
              )}
              {user &&
                user.user_id === currentProperty.owner_id &&
                currentProperty.status === 'unverified' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setVerificationModalOpen(true)}
                  >
                    Request Verification
                  </Button>
                )}
            </div>
          </div>
        </motion.div>

        {/* Documents - for verified */}
        {currentProperty.status === 'verified' && documents.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12"
          >
            <h2 className="text-xl font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <FileText size={20} />
              Documents
            </h2>
            <div className="flex flex-wrap gap-2">
              {documents.map((doc) => (
                <Badge
                  key={doc.id}
                  variant="info"
                  size="md"
                  className="cursor-pointer"
                  onClick={() => window.open(doc.file_url, '_blank')}
                >
                  {doc.document_type} - {doc.file_name}
                </Badge>
              ))}
            </div>
          </motion.section>
        )}

        {/* Related Properties */}
        {relatedProperties.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-16"
          >
            <h2 className="text-xl font-semibold text-surface-900 mb-6">
              Related Properties
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProperties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* Request Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request Property"
        size="md"
      >
        <div className="space-y-4">
          <TextArea
            label="Message"
            placeholder="Introduce yourself and your interest in this property..."
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmitting}
              onClick={handleRequestProperty}
            >
              Send Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Verification Modal */}
      <Modal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        title="Request Verification"
        size="md"
      >
        <p className="text-surface-600 mb-4">
          Submit this property for admin verification. Your documents will be
          reviewed and you'll be notified once verified.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setVerificationModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onClick={handleRequestVerification}
          >
            Submit for Review
          </Button>
        </div>
      </Modal>
    </div>
  );
}
