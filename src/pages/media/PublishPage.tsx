import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import {
  Button,
  Input,
  TextArea,
  Select,
  Card,
  CardHeader,
  CardContent,
  StatusBadge,
} from '@/components/ui';

interface PublishedItem {
  id: string;
  title: string;
  category: string;
  publishedDate: string;
  status: string;
}

const mockPublished: PublishedItem[] = [
  { id: '1', title: 'Central Station Monthly Report', category: 'Police', publishedDate: '2026-03-18', status: 'verified' },
  { id: '2', title: 'School Infrastructure Audit', category: 'Schools', publishedDate: '2026-03-15', status: 'verified' },
  { id: '3', title: 'City Hospital Staff Review', category: 'Hospitals', publishedDate: '2026-03-12', status: 'active' },
  { id: '4', title: 'Market Safety Inspection', category: 'Markets', publishedDate: '2026-03-10', status: 'verified' },
];

const categoryOptions = [
  { value: 'police', label: 'Police' },
  { value: 'schools', label: 'Schools' },
  { value: 'hospitals', label: 'Hospitals' },
  { value: 'markets', label: 'Markets' },
  { value: 'government', label: 'Government' },
];

export default function PublishPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [contentId, setContentId] = useState('');

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Send size={24} className="text-forest-600" />
            Publish Content
          </h1>
          <p className="text-surface-600 mt-1">
            Schedule and publish media content
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-surface-900">Publish Content</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Select Content"
                  placeholder="Search or enter content ID..."
                  icon={FileText}
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                />
                <Input
                  label="Title"
                  placeholder="Publication title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <TextArea
                  label="Description"
                  placeholder="Brief description of the content..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Select
                  label="Category"
                  options={categoryOptions}
                  placeholder="Select a category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <Input
                  label="Schedule Date"
                  type="datetime-local"
                  icon={Calendar}
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <div className="flex gap-3 pt-2">
                  <Button variant="primary" icon={Send} className="flex-1">
                    Publish Now
                  </Button>
                  <Button variant="outline" icon={Clock} className="flex-1">
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <CheckCircle size={20} className="text-forest-600" />
                  Recently Published
                </h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockPublished.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:border-forest-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 text-sm truncate">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-surface-500">{item.publishedDate}</span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-forest-50 text-forest-600">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={item.status} />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
