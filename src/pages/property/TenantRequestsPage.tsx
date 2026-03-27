import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  Check,
  X,
  User,
  Home,
  Calendar,
} from 'lucide-react';
import {
  StatsCard,
  Card,
  CardHeader,
  CardContent,
  Button,
  StatusBadge,
} from '@/components/ui';

interface TenantRequest {
  id: string;
  tenantName: string;
  propertyTitle: string;
  date: string;
  status: 'pending' | 'active' | 'rejected';
  message: string;
}

const initialRequests: TenantRequest[] = [
  { id: '1', tenantName: 'Amina Osei', propertyTitle: '3BR Apartment, Westlands', date: '2026-03-18', status: 'pending', message: 'Interested in viewing this property this weekend.' },
  { id: '2', tenantName: 'Kwame Mensah', propertyTitle: 'Studio Flat, CBD', date: '2026-03-17', status: 'pending', message: 'Is this property still available? I can move in immediately.' },
  { id: '3', tenantName: 'Grace Addo', propertyTitle: '2BR House, Osu', date: '2026-03-15', status: 'active', message: 'Lease signed and deposit paid.' },
  { id: '4', tenantName: 'Joseph Tetteh', propertyTitle: '1BR Apartment, Labone', date: '2026-03-14', status: 'rejected', message: 'Looking for a pet-friendly apartment.' },
  { id: '5', tenantName: 'Fatima Alhassan', propertyTitle: '4BR Villa, East Legon', date: '2026-03-12', status: 'pending', message: 'Would like to schedule a visit for next week.' },
  { id: '6', tenantName: 'Daniel Boateng', propertyTitle: '2BR Apartment, Cantonments', date: '2026-03-10', status: 'active', message: 'Tenant onboarded successfully.' },
];

export default function TenantRequestsPage() {
  const [requests, setRequests] = useState(initialRequests);

  const totalRequests = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'active').length;

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'active' as const } : r))
    );
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r))
    );
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900">Tenant Requests</h1>
          <p className="text-surface-600 mt-1">
            Manage tenant inquiries and requests for your properties
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <StatsCard icon={ClipboardList} label="Total Requests" value={totalRequests} variant="brand" />
          <StatsCard icon={Clock} label="Pending" value={pendingCount} variant="warning" />
          <StatsCard icon={CheckCircle} label="Approved" value={approvedCount} variant="success" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-surface-900">All Requests</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 rounded-lg border border-surface-200 hover:border-forest-200 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 flex items-center gap-2">
                          <User size={14} className="text-surface-400 shrink-0" />
                          {req.tenantName}
                        </p>
                        <p className="text-sm text-surface-600 flex items-center gap-2 mt-1">
                          <Home size={14} className="text-surface-400 shrink-0" />
                          {req.propertyTitle}
                        </p>
                        <p className="text-sm text-surface-500 mt-1 line-clamp-1">{req.message}</p>
                        <p className="text-xs text-surface-400 flex items-center gap-1 mt-1">
                          <Calendar size={12} />
                          {req.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={req.status} />
                        {req.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Check}
                              onClick={() => handleApprove(req.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={X}
                              onClick={() => handleReject(req.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
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
