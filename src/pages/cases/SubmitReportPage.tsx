import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  TextArea,
  FileUpload,
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui/FileUpload';

const MOCK_CASES = [
  { value: 'case-001', label: 'CSE-001 — Fraud Investigation (Lagos)' },
  { value: 'case-002', label: 'CSE-002 — Missing Person (Abuja)' },
  { value: 'case-003', label: 'CSE-003 — Land Dispute (Port Harcourt)' },
];

export default function SubmitReportPage() {
  const [selectedCase, setSelectedCase] = useState('');
  const [title, setTitle] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCase || !title || !findings) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      toast.success('Report submitted successfully!');
      setSelectedCase('');
      setTitle('');
      setFindings('');
      setRecommendations('');
      setFiles([]);
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        <h1 className="text-2xl font-bold text-surface-900">Submit Investigation Report</h1>
        <p className="text-surface-500 mt-1">
          Submit your findings and recommendations for an assigned case.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Report Details</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label
              htmlFor="case-select"
              className="block text-sm font-medium text-surface-700 mb-1.5"
            >
              Case
            </label>
            <select
              id="case-select"
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500 hover:border-surface-400"
            >
              <option value="" disabled>
                Select a case…
              </option>
              {MOCK_CASES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Report Title"
            placeholder="E.g. Preliminary Investigation Report"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <TextArea
            label="Findings"
            placeholder="Describe your findings in detail…"
            rows={6}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
          />

          <TextArea
            label="Recommendations"
            placeholder="Provide your recommendations…"
            rows={4}
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
          />

          <div>
            <p className="text-sm font-medium text-surface-700 mb-1.5">
              Supporting Evidence
            </p>
            <FileUpload
              accept="image/*,.pdf,.doc,.docx,video/*,audio/*"
              multiple
              value={files}
              onChange={setFiles}
            />
          </div>

          <div className="pt-4 border-t border-surface-100 flex justify-end">
            <Button
              icon={Send}
              loading={isSubmitting}
              onClick={handleSubmit}
              className="bg-forest-600 hover:bg-forest-700"
            >
              Submit Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
