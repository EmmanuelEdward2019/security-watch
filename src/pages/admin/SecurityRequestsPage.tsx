import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  MessageSquare,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  StatsCard,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Input,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ServiceRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  service_type: string;
  location: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const SERVICE_LABELS: Record<string, string> = {
  security_guards: 'Security Guards',
  security_surveillance: 'Surveillance',
  security_escorts: 'Escorts & Protocol',
  event_security: 'Event Security',
  private_protection: 'Private Protection',
  home_security: 'Home Security',
  infrastructure_security: 'Infrastructure',
  maritime_security: 'Maritime',
  security_training: 'Training',
  debt_recovery: 'Debt Recovery',
  construction: 'Construction',
  logistics: 'Logistics',
  other: 'General Enquiry',
};

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  contacted: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function SecurityRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('security_service_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as ServiceRequest[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from('security_service_requests')
      .update({ status: newStatus, admin_notes: adminNotes || null })
      .eq('id', id);
    setUpdating(false);
    if (error) {
      toast.error('Failed to update');
      return;
    }
    toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus, admin_notes: adminNotes || null } : r))
    );
    if (selected?.id === id) setSelected({ ...selected, status: newStatus, admin_notes: adminNotes || null });
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.company_name && r.company_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const activeCount = requests.filter((r) => ['contacted', 'in_progress'].includes(r.status)).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Fountain Source — Service Requests</h1>
        <p className="text-surface-500 mt-1">Manage security and service enquiries</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Shield} label="Total Requests" value={requests.length} variant="brand" />
        <StatsCard icon={Clock} label="Pending" value={pendingCount} variant="accent" />
        <StatsCard icon={ArrowRight} label="Active" value={activeCount} variant="brand" />
        <StatsCard icon={CheckCircle2} label="Completed" value={completedCount} variant="brand" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="flex-1">
              <Input
                icon={Search}
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-surface-300 bg-white text-sm"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-surface-500">No requests found.</p>
          ) : (
            <div className="divide-y divide-surface-100">
              {filtered.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => {
                    setSelected(req);
                    setAdminNotes(req.admin_notes || '');
                  }}
                  className="w-full text-left flex items-center gap-4 py-4 px-2 hover:bg-surface-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-900 truncate">{req.full_name}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {SERVICE_LABELS[req.service_type] || req.service_type}
                      {req.company_name ? ` · ${req.company_name}` : ''}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <Badge variant={STATUS_VARIANT[req.status] || 'info'}>
                      {STATUS_LABELS[req.status] || req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-400 shrink-0 hidden md:block">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl border border-surface-200 w-full max-w-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-surface-900">{selected.full_name}</h2>
                  <p className="text-surface-500 text-sm mt-0.5">
                    {SERVICE_LABELS[selected.service_type]} · {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[selected.status] || 'info'} className="shrink-0">
                  {STATUS_LABELS[selected.status]}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-surface-700">
                  <Mail className="w-4 h-4 text-surface-400" />
                  <a href={`mailto:${selected.email}`} className="hover:text-forest-600">{selected.email}</a>
                </div>
                {selected.phone && (
                  <div className="flex items-center gap-2 text-surface-700">
                    <Phone className="w-4 h-4 text-surface-400" />
                    <a href={`tel:${selected.phone}`} className="hover:text-forest-600">{selected.phone}</a>
                  </div>
                )}
                {selected.company_name && (
                  <div className="flex items-center gap-2 text-surface-700">
                    <Building2 className="w-4 h-4 text-surface-400" />
                    {selected.company_name}
                  </div>
                )}
                {selected.location && (
                  <div className="flex items-center gap-2 text-surface-700">
                    <MapPin className="w-4 h-4 text-surface-400" />
                    {selected.location}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                  Message
                </p>
                <div className="rounded-lg bg-surface-50 border border-surface-200 p-4 text-sm text-surface-700 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this request..."
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 text-sm focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'contacted', 'in_progress', 'completed', 'cancelled'].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selected.status === s ? 'primary' : 'outline'}
                      onClick={() => handleStatusChange(selected.id, s)}
                      loading={updating}
                      disabled={selected.status === s}
                      className={selected.status === s ? 'bg-forest-600 text-white' : ''}
                    >
                      {STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  <XCircle className="w-4 h-4 mr-1" /> Close
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
