import { motion } from 'framer-motion';
import { ShieldCheck, Plus, Home, Calendar, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, StatusBadge } from '@/components/ui';

interface VerificationRequest {
  id: string;
  propertyTitle: string;
  requestDate: string;
  status: 'pending' | 'verified' | 'rejected';
}

const mockRequests: VerificationRequest[] = [
  { id: '1', propertyTitle: '3BR Apartment, Westlands', requestDate: '2026-03-18', status: 'pending' },
  { id: '2', propertyTitle: 'Studio Flat, CBD', requestDate: '2026-03-15', status: 'verified' },
  { id: '3', propertyTitle: '2BR House, Osu', requestDate: '2026-03-12', status: 'verified' },
  { id: '4', propertyTitle: '1BR Apartment, Labone', requestDate: '2026-03-10', status: 'rejected' },
  { id: '5', propertyTitle: '4BR Villa, East Legon', requestDate: '2026-03-08', status: 'pending' },
  { id: '6', propertyTitle: '2BR Apartment, Cantonments', requestDate: '2026-03-05', status: 'verified' },
];

export default function VerificationRequestsPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              <ShieldCheck size={24} className="text-forest-600" />
              Verification Requests
            </h1>
            <p className="text-surface-600 mt-1">
              Track the verification status of your property requests
            </p>
          </div>
          <Button variant="primary" icon={Plus} size="lg">
            Request New Verification
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-surface-900">Your Requests</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockRequests.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-surface-200 hover:border-forest-200 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-forest-50 text-forest-600 shrink-0">
                      <Home size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900">{req.propertyTitle}</p>
                      <p className="text-sm text-surface-500 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        Requested on {req.requestDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={req.status} />
                      <Button variant="ghost" size="sm" icon={Eye}>
                        View
                      </Button>
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
