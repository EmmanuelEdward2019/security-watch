import { motion } from 'framer-motion';
import {
  DollarSign,
  Clock,
  FileText,
  Calendar,
  User,
  Home,
} from 'lucide-react';
import {
  StatsCard,
  Card,
  CardHeader,
  CardContent,
  StatusBadge,
} from '@/components/ui';

interface Transaction {
  id: string;
  date: string;
  tenant: string;
  property: string;
  amount: string;
  type: 'rent' | 'deposit' | 'lease' | 'refund';
  status: string;
}

const mockTransactions: Transaction[] = [
  { id: '1', date: '2026-03-18', tenant: 'Amina Osei', property: '3BR Apartment, Westlands', amount: 'GHS 2,500', type: 'rent', status: 'completed' },
  { id: '2', date: '2026-03-15', tenant: 'Kwame Mensah', property: 'Studio Flat, CBD', amount: 'GHS 1,200', type: 'rent', status: 'completed' },
  { id: '3', date: '2026-03-14', tenant: 'Grace Addo', property: '2BR House, Osu', amount: 'GHS 5,000', type: 'deposit', status: 'completed' },
  { id: '4', date: '2026-03-12', tenant: 'Joseph Tetteh', property: '1BR Apartment, Labone', amount: 'GHS 1,800', type: 'rent', status: 'pending' },
  { id: '5', date: '2026-03-10', tenant: 'Fatima Alhassan', property: '4BR Villa, East Legon', amount: 'GHS 8,000', type: 'lease', status: 'completed' },
  { id: '6', date: '2026-03-08', tenant: 'Daniel Boateng', property: '2BR Apartment, Cantonments', amount: 'GHS 3,000', type: 'rent', status: 'pending' },
  { id: '7', date: '2026-03-05', tenant: 'Grace Addo', property: '2BR House, Osu', amount: 'GHS 2,000', type: 'refund', status: 'completed' },
];

const typeStyles: Record<string, string> = {
  rent: 'bg-forest-50 text-forest-600',
  deposit: 'bg-sky-100 text-sky-700',
  lease: 'bg-amber-100 text-amber-700',
  refund: 'bg-accent-100 text-accent-700',
};

export default function TransactionsPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900">Transactions</h1>
          <p className="text-surface-600 mt-1">
            Track rent payments, deposits, and lease history
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <StatsCard icon={DollarSign} label="Total Revenue" value="GHS 23,500" variant="success" />
          <StatsCard icon={Clock} label="Pending Payments" value={2} variant="warning" />
          <StatsCard icon={FileText} label="Active Leases" value={4} variant="brand" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-surface-900">Transaction History</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTransactions.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-surface-200 hover:border-forest-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium text-surface-900 flex items-center gap-1.5">
                          <User size={14} className="text-surface-400" />
                          {tx.tenant}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${typeStyles[tx.type]}`}>
                          {tx.type}
                        </span>
                      </div>
                      <p className="text-sm text-surface-600 flex items-center gap-1.5 mt-1">
                        <Home size={14} className="text-surface-400" />
                        {tx.property}
                      </p>
                      <p className="text-xs text-surface-500 flex items-center gap-1 mt-1">
                        <Calendar size={12} />
                        {tx.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-lg font-semibold text-surface-900">{tx.amount}</span>
                      <StatusBadge status={tx.status} />
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
