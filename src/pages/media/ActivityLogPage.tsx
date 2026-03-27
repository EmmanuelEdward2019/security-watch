import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Calendar, Building2, FileText, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent, StatusBadge } from '@/components/ui';

type ActivityType = 'visit' | 'report';

interface ActivityItem {
  id: string;
  date: string;
  institutionName: string;
  type: ActivityType;
  status: string;
}

const mockActivities: ActivityItem[] = [
  { id: '1', date: '2026-03-18', institutionName: 'Central Police Station', type: 'visit', status: 'completed' },
  { id: '2', date: '2026-03-17', institutionName: 'City General Hospital', type: 'report', status: 'pending' },
  { id: '3', date: '2026-03-15', institutionName: 'Westside Primary School', type: 'visit', status: 'completed' },
  { id: '4', date: '2026-03-14', institutionName: 'Market Square', type: 'report', status: 'active' },
  { id: '5', date: '2026-03-12', institutionName: 'East District Police Post', type: 'visit', status: 'completed' },
  { id: '6', date: '2026-03-10', institutionName: 'Regional Hospital', type: 'report', status: 'rejected' },
  { id: '7', date: '2026-03-08', institutionName: 'Hilltop Secondary School', type: 'visit', status: 'completed' },
  { id: '8', date: '2026-03-05', institutionName: 'Central Market', type: 'report', status: 'pending' },
];

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'visit', label: 'Visits' },
  { key: 'report', label: 'Reports' },
] as const;

export default function ActivityLogPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'visit' | 'report'>('all');

  const filtered = activeTab === 'all'
    ? mockActivities
    : mockActivities.filter((a) => a.type === activeTab);

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Activity size={24} className="text-forest-600" />
            Activity Log
          </h1>
          <p className="text-surface-600 mt-1">
            Your past visits and submitted reports
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.key
                        ? 'bg-forest-600 text-white'
                        : 'text-surface-600 hover:bg-surface-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filtered.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 p-4 rounded-lg border border-surface-200 hover:border-forest-200 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-forest-50 text-forest-600 shrink-0">
                      {item.type === 'visit' ? <Eye size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900 flex items-center gap-2">
                        <Building2 size={14} className="text-surface-400 shrink-0" />
                        {item.institutionName}
                      </p>
                      <p className="text-sm text-surface-500 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        {item.date}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        item.type === 'visit'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-forest-50 text-forest-600'
                      }`}
                    >
                      {item.type === 'visit' ? 'Visit' : 'Report'}
                    </span>
                    <StatusBadge status={item.status} />
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
