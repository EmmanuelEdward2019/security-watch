import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye } from 'lucide-react';
import {
  DataTable,
  Avatar,
  Badge,
  Input,
  Select,
  Modal,
  Button,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { setUserRole, setKycStatus } from '@/services/adminService';
import type { Profile, UserRole, KycStatus } from '@/types';
import { USER_ROLE_LABELS } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ value, label }));
const KYC_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function UserManagementPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);



  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.full_name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    if (kycFilter && u.kyc_status !== kycFilter) return false;
    return true;
  });

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(true);
    // profiles.role is pinned by a database trigger: a direct UPDATE is reverted
    // and recorded as an escalation attempt. Role changes go through an RPC that
    // checks the caller is an admin and refuses to demote the last one.
    const { error } = await setUserRole(userId, newRole);
    setUpdating(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Role updated. The change is recorded in the audit log.');
    setSelectedUser((prev) => (prev && prev.user_id === userId ? { ...prev, role: newRole } : prev));
    void loadUsers();
  };

  const handleKycAction = async (userId: string, status: KycStatus) => {
    setUpdating(true);
    const { error } = await setKycStatus(userId, status);
    setUpdating(false);

    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`KYC ${status}.`);
    setSelectedUser((prev) =>
      prev && prev.user_id === userId ? { ...prev, kyc_status: status } : prev
    );
    void loadUsers();
  };

  const columns: Column<Profile>[] = [
    {
      id: 'user',
      header: 'User',
      accessor: (row) => row.full_name,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatar_url} name={row.full_name ?? ''} size="sm" />
          <div>
            <p className="font-medium">{row.full_name}</p>
            <p className="text-sm text-surface-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      accessor: 'role',
      render: (v) => <Badge variant="info">{USER_ROLE_LABELS[v as UserRole] ?? v}</Badge>,
    },
    {
      id: 'kyc',
      header: 'KYC',
      accessor: 'kyc_status',
      render: (v) => (
        <Badge
          variant={
            v === 'approved' ? 'success' : v === 'rejected' ? 'danger' : 'warning'
          }
        >
          {String(v)}
        </Badge>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      accessor: 'location',
      render: (v) => (v != null && v !== '' ? String(v) : '—'),
    },
    {
      id: 'joined',
      header: 'Joined',
      accessor: 'created_at',
      render: (v) => format(new Date(String(v)), 'MMM d, yyyy'),
    },
    {
      id: 'actions',
      header: '',
      accessor: () => null,
      render: (_, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(row);
          }}
          className="p-2 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50"
          aria-label="View user"
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">User Management</h1>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-40"
        />
        <Select
          options={KYC_OPTIONS}
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No users found"
        />
      </div>

      <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title="User Details" size="lg">
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={selectedUser.avatar_url} name={selectedUser.full_name ?? ''} size="lg" />
              <div>
                <h3 className="font-semibold text-lg">{selectedUser.full_name}</h3>
                <p className="text-surface-500">{selectedUser.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="info">{USER_ROLE_LABELS[selectedUser.role]}</Badge>
                  <Badge
                    variant={
                      selectedUser.kyc_status === 'approved'
                        ? 'success'
                        : selectedUser.kyc_status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    KYC: {selectedUser.kyc_status}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Role</label>
              <select
                value={selectedUser.role}
                onChange={(e) => handleRoleChange(selectedUser.user_id, e.target.value as UserRole)}
                disabled={updating}
                className="w-full rounded-lg border border-surface-300 px-3 py-2"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedUser.kyc_status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleKycAction(selectedUser.user_id, 'approved')}
                    loading={updating}
                  >
                    Approve KYC
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleKycAction(selectedUser.user_id, 'rejected')}
                    loading={updating}
                  >
                    Reject KYC
                  </Button>
                </>
              )}
              {selectedUser.role !== 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Promote ${selectedUser.full_name} to Administrator?`)) {
                      handleRoleChange(selectedUser.user_id, 'admin');
                    }
                  }}
                  loading={updating}
                >
                  Promote to Admin
                </Button>
              )}
              {selectedUser.role === 'admin' && (
                <Badge variant="info">Administrator</Badge>
              )}
            </div>
            <div className="text-sm text-surface-500">
              <p>Location: {selectedUser.location ?? '—'}</p>
              <p>Joined: {format(new Date(selectedUser.created_at), 'PPpp')}</p>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
