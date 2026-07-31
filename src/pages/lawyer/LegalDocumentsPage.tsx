import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Upload, Download, Trash2, Gavel, FileCheck2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  Select,
  TextArea,
  FileUpload,
  Spinner,
  EmptyState,
  DataTable,
  StatusBadge,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import type { UploadedFile } from '@/components/ui/FileUpload';
import { useAuthStore } from '@/stores/authStore';
import { STORAGE_BUCKETS } from '@/lib/supabase';
import {
  fetchLegalDocuments,
  uploadLegalDocument,
  updateLegalDocumentStatus,
  deleteLegalDocument,
  fetchMyAssignedCases,
  getAttachmentUrl,
} from '@/services/caseWorkService';
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_STATUS_LABELS,
  type LegalDocument,
  type LegalDocumentType,
  type Case,
} from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type AssignedCase = Pick<Case, 'id' | 'title' | 'status' | 'category' | 'urgency' | 'location' | 'created_at'>;

const DOC_TYPE_OPTIONS = (
  Object.entries(LEGAL_DOCUMENT_TYPE_LABELS) as [LegalDocumentType, string][]
).map(([value, label]) => ({ value, label }));

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lawyer document management.
 *
 * The lawyer role had no working feature: this screen showed a hardcoded list
 * and faked uploads with a timer. Documents now persist, are hashed on upload,
 * live in a private bucket readable by the author, admins and the participants
 * of the linked case, and move through a filing lifecycle.
 */
export default function LegalDocumentsPage() {
  const user = useAuthStore((s) => s.user);

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);

  const [documentType, setDocumentType] = useState<LegalDocumentType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseId, setCaseId] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [docsResult, casesResult] = await Promise.all([
      fetchLegalDocuments({ authorId: user.user_id }),
      fetchMyAssignedCases(),
    ]);

    if (docsResult.error) toast.error(docsResult.error);
    setDocuments(docsResult.documents);
    setCases(casesResult.cases);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async () => {
    if (!user) return;

    if (!documentType) {
      toast.error('Choose a document type.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the document a title.');
      return;
    }
    if (files.length === 0) {
      toast.error('Attach the document file.');
      return;
    }

    setIsUploading(true);
    let failures = 0;

    for (const uploaded of files) {
      const { error } = await uploadLegalDocument(
        {
          caseId: caseId || null,
          documentType,
          title:
            files.length > 1 ? `${title.trim()} — ${uploaded.file.name}` : title.trim(),
          description: description.trim() || undefined,
          file: uploaded.file,
        },
        user.user_id
      );
      if (error) {
        failures += 1;
        toast.error(error);
      }
    }

    setIsUploading(false);

    if (failures < files.length) {
      const filed = files.length - failures;
      toast.success(filed === 1 ? 'Document filed.' : `${filed} documents filed.`);
      setDocumentType('');
      setTitle('');
      setDescription('');
      setCaseId('');
      setFiles([]);
      await load();
    }
  };

  const handleDownload = async (doc: LegalDocument) => {
    const url = await getAttachmentUrl(STORAGE_BUCKETS.LEGAL_DOCUMENTS, doc.file_path);
    if (!url) {
      toast.error('Could not open that document. You may no longer have access to it.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleStatusChange = async (doc: LegalDocument, status: LegalDocument['status']) => {
    const { error } = await updateLegalDocumentStatus(doc.id, status);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Marked ${LEGAL_DOCUMENT_STATUS_LABELS[status].toLowerCase()}.`);
    await load();
  };

  const handleDelete = async (doc: LegalDocument) => {
    if (!window.confirm(`Delete "${doc.title}"? Only draft documents can be removed.`)) return;
    const { error } = await deleteLegalDocument(doc.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Document deleted.');
    await load();
  };

  const columns: Column<LegalDocument>[] = [
    {
      id: 'title',
      header: 'Document',
      accessor: 'title',
      render: (_value, row) => (
        <div className="min-w-0">
          <p className="font-medium text-surface-900 truncate">{row.title}</p>
          <p className="text-xs text-surface-500 truncate">{row.file_name}</p>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessor: 'document_type',
      render: (value) => (
        <span className="text-sm text-surface-700">
          {LEGAL_DOCUMENT_TYPE_LABELS[value as LegalDocumentType]}
        </span>
      ),
    },
    {
      id: 'case',
      header: 'Case',
      accessor: (row) => row.case?.title ?? '—',
      render: (value) => (
        <span className="text-sm text-surface-600 line-clamp-1">{value as string}</span>
      ),
    },
    {
      id: 'size',
      header: 'Size',
      accessor: 'file_size',
      render: (value) => (
        <span className="text-sm text-surface-500 tabular-nums">{formatBytes(value as number)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (value) => {
        const status = value as LegalDocument['status'];
        return (
          <StatusBadge
            status={
              status === 'filed'
                ? 'active'
                : status === 'served'
                  ? 'completed'
                  : status === 'archived'
                    ? 'closed'
                    : 'pending'
            }
          />
        );
      },
    },
    {
      id: 'created',
      header: 'Filed',
      accessor: 'created_at',
      render: (value) => (
        <span className="text-sm text-surface-500">
          {format(new Date(value as string), 'd MMM yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      render: (_value, row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={() => void handleDownload(row)}
            aria-label={`Download ${row.title}`}
          />
          {row.status === 'draft' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={Gavel}
                onClick={() => void handleStatusChange(row, 'filed')}
                aria-label={`Mark ${row.title} as filed`}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => void handleDelete(row)}
                aria-label={`Delete ${row.title}`}
              />
            </>
          )}
          {row.status === 'filed' && (
            <Button
              variant="ghost"
              size="sm"
              icon={FileCheck2}
              onClick={() => void handleStatusChange(row, 'served')}
              aria-label={`Mark ${row.title} as served`}
            />
          )}
        </div>
      ),
    },
  ];

  const caseOptions = [
    { value: '', label: 'Not tied to a case' },
    ...cases.map((c) => ({ value: c.id, label: c.title })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Legal documents</h1>
        <p className="text-surface-500 mt-1">
          File affidavits, petitions, court filings and opinions. Documents attached to a case become
          visible to everyone assigned to it.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-surface-900">File a document</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Document type"
                options={DOC_TYPE_OPTIONS}
                placeholder="Select a type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as LegalDocumentType)}
                required
              />
              <Input
                label="Title"
                placeholder="e.g. Affidavit of service"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
              <Select
                label="Linked case (optional)"
                options={caseOptions}
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
              <TextArea
                label="Notes (optional)"
                placeholder="Anything the case team should know about this document."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <FileUpload
                accept=".pdf,.doc,.docx,image/*"
                multiple
                maxSize={20 * 1024 * 1024}
                value={files}
                onChange={setFiles}
              />
              <Button
                onClick={() => void handleUpload()}
                loading={isUploading}
                disabled={isUploading}
                icon={Upload}
                className="w-full"
              >
                File document
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-surface-900">Your documents</h2>
                <span className="text-sm text-surface-500 tabular-nums">{documents.length}</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No documents yet"
                  description="Documents you file will be listed here with their status and linked case."
                />
              ) : (
                <DataTable columns={columns} data={documents} pageSize={10} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
