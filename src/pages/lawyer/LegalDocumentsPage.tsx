import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Download, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  FileUpload,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui/FileUpload';

const DOC_TYPE_OPTIONS = [
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'motion', label: 'Motion' },
  { value: 'brief', label: 'Legal Brief' },
  { value: 'contract', label: 'Contract' },
  { value: 'evidence', label: 'Evidence Document' },
  { value: 'report', label: 'Report' },
  { value: 'other', label: 'Other' },
];

const MOCK_DOCUMENTS = [
  { id: '1', name: 'Affidavit_CSE-014.pdf', type: 'Affidavit', date: '2026-03-14', size: '1.2 MB' },
  { id: '2', name: 'Motion_Hearing_Feb.pdf', type: 'Motion', date: '2026-02-28', size: '845 KB' },
  { id: '3', name: 'Legal_Brief_LandDispute.docx', type: 'Legal Brief', date: '2026-02-10', size: '2.3 MB' },
  { id: '4', name: 'Contract_ClientAgreement.pdf', type: 'Contract', date: '2026-01-22', size: '560 KB' },
];

export default function LegalDocumentsPage() {
  const [docType, setDocType] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!docType || files.length === 0) {
      toast.error('Please select a document type and upload at least one file.');
      return;
    }

    setIsUploading(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      toast.success('Document uploaded successfully!');
      setDocType('');
      setDescription('');
      setFiles([]);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Legal Documents</h1>
        <p className="text-surface-500 mt-1">
          Upload, manage, and access your legal documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Upload Document</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="doc-type"
              className="block text-sm font-medium text-surface-700 mb-1.5"
            >
              Document Type
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500 hover:border-surface-400"
            >
              <option value="" disabled>
                Select document type…
              </option>
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="doc-desc"
              className="block text-sm font-medium text-surface-700 mb-1.5"
            >
              Description (optional)
            </label>
            <input
              id="doc-desc"
              type="text"
              placeholder="Brief description of the document…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500 hover:border-surface-400"
            />
          </div>

          <FileUpload
            accept=".pdf,.doc,.docx,.txt"
            multiple
            value={files}
            onChange={setFiles}
          />

          <div className="flex justify-end">
            <Button
              icon={Upload}
              loading={isUploading}
              onClick={handleUpload}
              className="bg-forest-600 hover:bg-forest-700"
            >
              Upload Document
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderOpen size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">My Documents</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-surface-100">
            {MOCK_DOCUMENTS.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-forest-50">
                    <FileText size={20} className="text-forest-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 truncate">{doc.name}</p>
                    <p className="text-sm text-surface-500">
                      {doc.type} · {doc.date} · {doc.size}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon={Download}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
