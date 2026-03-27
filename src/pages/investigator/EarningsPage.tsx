import { motion } from 'framer-motion';
import { DollarSign, Clock, CheckCircle, Download } from 'lucide-react';
import {
  StatsCard,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
} from '@/components/ui';
const MOCK_PAYMENTS = [
  { id: '1', date: '2026-03-15', caseTitle: 'CSE-014 — Fraud Investigation', amount: '₦350,000', status: 'paid' as const },
  { id: '2', date: '2026-03-08', caseTitle: 'CSE-011 — Cybercrime Probe', amount: '₦200,000', status: 'paid' as const },
  { id: '3', date: '2026-02-27', caseTitle: 'CSE-009 — Missing Person', amount: '₦150,000', status: 'pending' as const },
  { id: '4', date: '2026-02-14', caseTitle: 'CSE-007 — Land Dispute', amount: '₦275,000', status: 'paid' as const },
  { id: '5', date: '2026-01-30', caseTitle: 'CSE-005 — Corruption Case', amount: '₦400,000', status: 'pending' as const },
];

const STATUS_VARIANT: Record<string, 'success' | 'warning'> = {
  paid: 'success',
  pending: 'warning',
};

export default function EarningsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Earnings</h1>
        <p className="text-surface-500 mt-1">Track your earnings and payment history.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          icon={DollarSign}
          label="Total Earnings"
          value="₦1,375,000"
          variant="success"
        />
        <StatsCard
          icon={Clock}
          label="Pending Payout"
          value="₦550,000"
          variant="warning"
        />
        <StatsCard
          icon={CheckCircle}
          label="Cases Completed"
          value={5}
          variant="brand"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="font-semibold text-surface-900">Payment History</h2>
          <Button variant="outline" size="sm" icon={Download}>
            Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-6 py-3 font-medium text-surface-500">Date</th>
                  <th className="px-6 py-3 font-medium text-surface-500">Case</th>
                  <th className="px-6 py-3 font-medium text-surface-500">Amount</th>
                  <th className="px-6 py-3 font-medium text-surface-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {MOCK_PAYMENTS.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-6 py-3 text-surface-600 whitespace-nowrap">{p.date}</td>
                    <td className="px-6 py-3 text-surface-900 font-medium">{p.caseTitle}</td>
                    <td className="px-6 py-3 text-surface-900 font-semibold whitespace-nowrap">
                      {p.amount}
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={STATUS_VARIANT[p.status]} size="sm" dot>
                        {p.status === 'paid' ? 'Paid' : 'Pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
