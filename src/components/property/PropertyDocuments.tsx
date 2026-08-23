import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, FileUp, Trash2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card, CardHeader, CardContent, Button, Badge, Select, Spinner, Modal,
} from '@/components/ui';
import { usePropertyStore } from '@/stores/propertyStore';
import {
  STORAGE_BUCKETS,
  buildObjectPath,
  resolveStorageUrl,
  uploadFile,
} from '@/lib/supabase';
import type { PropertyDocument } from '@/types';

/**
 * Title documents on an existing listing.
 *
 * Documents could only be attached while the listing was being created. A
 * landlord who published first — or who was later asked for a Certificate of
 * Occupancy during verification — had no way to add one, and the only route
 * was to delete the listing and start over.
 *
 * Reading follows the table's own rule: the owner and administrators, never a
 * prospective tenant. A title deed carries the owner's full name and the
 * property's legal history.
 */

/**
 * Matches the mobile vocabulary exactly, so a document filed on one client
 * reads correctly on the other.
 */
const DOCUMENT_TYPES = {
  title_deed: 'Title deed',
  certificate_of_occupancy: 'Certificate of Occupancy',
  survey_plan: 'Survey plan',
  deed_of_assignment: 'Deed of assignment',
  other: 'Other document',
} as const;

type DocumentTypeKey = keyof typeof DOCUMENT_TYPES;

export interface PropertyDocumentsProps {
  propertyId: string;
  /** True when the signed-in user owns this listing. */
  isOwner: boolean;
}

export function PropertyDocuments({ propertyId, isOwner }: PropertyDocumentsProps) {
  const { documents, fetchDocuments, addDocument, deleteDocument } = usePropertyStore();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [docType, setDocType] = useState<DocumentTypeKey | ''>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchDocuments(propertyId);
    setLoading(false);
  }, [propertyId, fetchDocuments]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilePicked = async (file: File | undefined) => {
    if (!file || !docType) return;

    setUploading(true);
    try {
      const path = buildObjectPath(propertyId, file.name);
      const { path: storedPath, error } = await uploadFile(
        STORAGE_BUCKETS.PROPERTY_DOCUMENTS,
        path,
        file
      );

      if (error || !storedPath) {
        toast.error(error ?? 'That file could not be uploaded.');
        return;
      }

      // The PATH, never a URL. property-documents is private, so a URL here
      // would be a signed one and would expire, leaving a record that cannot
      // be opened.
      const { error: rowError } = await addDocument({
        property_id: propertyId,
        document_type: docType,
        file_url: storedPath,
        file_name: file.name,
        verified: false,
      });

      if (rowError) {
        toast.error(rowError);
        return;
      }

      toast.success(`${DOCUMENT_TYPES[docType]} added.`);
      setPickerOpen(false);
      setDocType('');
      void load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const open = async (doc: PropertyDocument) => {
    // Signed on demand and short-lived: a link that outlives the viewing is a
    // copy of a title deed on the internet.
    const url = await resolveStorageUrl(STORAGE_BUCKETS.PROPERTY_DOCUMENTS, doc.file_url, 600);
    if (!url) {
      toast.error('That document could not be opened from storage.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const remove = async (doc: PropertyDocument) => {
    if (!window.confirm(`Remove ${doc.file_name}? This cannot be undone.`)) return;
    const { error } = await deleteDocument(doc);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Document removed.');
  };

  // Nothing to show a non-owner with no documents, and nothing they could do
  // about it either.
  if (!isOwner && documents.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-surface-900">
          <ShieldCheck size={18} className="text-brand-500" />
          Title documents
        </h2>
        {isOwner && (
          <Button size="sm" variant="secondary" icon={FileUp} onClick={() => setPickerOpen(true)}>
            Add a document
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : documents.length === 0 ? (
          <p className="py-4 text-sm text-surface-500">
            No documents yet. A title deed or Certificate of Occupancy is what lets this
            listing be verified.
          </p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 py-3">
                <FileText size={18} className="shrink-0 text-surface-400" />

                <button
                  type="button"
                  onClick={() => void open(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium text-surface-900">
                    {DOCUMENT_TYPES[doc.document_type as DocumentTypeKey] ?? doc.document_type}
                  </p>
                  <p className="truncate text-xs text-surface-500">{doc.file_name}</p>
                </button>

                {/* Verification is an administrator's decision — this tells the
                    owner whether the document has been accepted. */}
                <Badge variant={doc.verified ? 'success' : 'default'}>
                  {doc.verified ? 'Verified' : 'Unverified'}
                </Badge>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => void remove(doc)}
                    className="rounded-lg p-2 text-surface-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${doc.file_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add a document"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentTypeKey)}
            options={[
              { value: '', label: 'Select…' },
              ...(Object.keys(DOCUMENT_TYPES) as DocumentTypeKey[]).map((key) => ({
                value: key,
                label: DOCUMENT_TYPES[key],
              })),
            ]}
          />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => void onFilePicked(e.target.files?.[0])}
          />

          <Button
            disabled={!docType}
            loading={uploading}
            icon={FileUp}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </Button>

          <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-500">
            Visible to you and to administrators reviewing this listing. Never shown to
            a prospective tenant.
          </p>
        </div>
      </Modal>
    </Card>
  );
}
