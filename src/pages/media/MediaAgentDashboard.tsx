import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video,
  FileCheck,
  Clock,
  Plus,
  Upload,
  Building2, Library } from 'lucide-react';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  StatsCard,
  Spinner,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';

export function MediaAgentDashboard() {
  const { user } = useAuthStore();
  const {
    mediaReports,
    institutions,
    isLoading,
    fetchMediaReports,
    fetchInstitutions,
  } = useMediaStore();

  useEffect(() => {
    if (user?.user_id) {
      fetchMediaReports({ reporterId: user.user_id });
    }
    fetchInstitutions();
  }, [user?.user_id, fetchMediaReports, fetchInstitutions]);

  const myReports = mediaReports;
  const publishedCount = myReports.filter((r) => r.status === 'published').length;
  const pendingCount = myReports.filter(
    (r) => r.status === 'pending_review' || r.status === 'approved'
  ).length;

  const reportedInstitutionIds = new Set(myReports.map((r) => r.institution_id));
  const reportedInstitutions = institutions.filter((i) =>
    reportedInstitutionIds.has(i.id)
  );

  const statusMap: Record<string, string> = {
    pending_review: 'pending',
    approved: 'active',
    rejected: 'rejected',
    published: 'verified',
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Sign in required"
          description="Please sign in to access your media agent dashboard."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-surface-900">
              Media Agent Dashboard
            </h1>
            <p className="text-surface-600 mt-1">
              Manage your media reports and submissions
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/*
              The library had no route in from here. Its contents come from
              this dashboard's own work — everything recorded or imported —
              and the only way to reach it was the link buried on the field
              recording screen.
            */}
            <Link to="/app/media/library">
              <Button variant="outline" icon={Library} size="lg">
                Media library
              </Button>
            </Link>
            <Link to="/app/media/upload">
              <Button variant="primary" icon={Plus} size="lg">
                Upload Report
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <StatsCard
            icon={Video}
            label="Reports Submitted"
            value={myReports.length}
            variant="brand"
          />
          <StatsCard
            icon={FileCheck}
            label="Published"
            value={publishedCount}
            variant="success"
          />
          <StatsCard
            icon={Clock}
            label="Pending Review"
            value={pendingCount}
            variant="warning"
          />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* My Reports */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-lg font-semibold">My Reports</h2>
                <Link to="/app/media/upload">
                  <Button variant="ghost" size="sm" icon={Upload}>
                    Upload
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : myReports.length === 0 ? (
                  <EmptyState
                    title="No reports yet"
                    description="Submit your first media report to get started."
                    action={
                      <Link to="/app/media/upload">
                        <Button variant="primary" icon={Upload}>
                          Upload Report
                        </Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {myReports.map((report) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-4 p-4 rounded-lg border border-surface-200 hover:border-brand-200 transition-colors"
                      >
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-100 shrink-0">
                          {report.thumbnail_url ? (
                            <img
                              src={report.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-400">
                              <Video size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/app/media/${report.id}`}
                            className="font-medium text-surface-900 hover:text-brand-600 line-clamp-1"
                          >
                            {report.title}
                          </Link>
                          <p className="text-sm text-surface-500">
                            {report.institution?.name ?? 'Unknown'} •{' '}
                            {formatDistanceToNow(new Date(report.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <StatusBadge
                          status={statusMap[report.status] ?? report.status}
                          className="shrink-0"
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Institutions I've reported on */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 size={20} />
                  Institutions I've Reported On
                </h2>
              </CardHeader>
              <CardContent>
                {reportedInstitutions.length === 0 ? (
                  <EmptyState
                    title="None yet"
                    description="Institutions you report on will appear here."
                  />
                ) : (
                  <div className="space-y-2">
                    {reportedInstitutions.map((inst) => (
                      <Link
                        key={inst.id}
                        to={`/app/media/institutions/${inst.id}`}
                        className="block p-3 rounded-lg border border-surface-200 hover:border-brand-200 hover:bg-surface-50 transition-colors"
                      >
                        <p className="font-medium text-surface-900 text-sm">
                          {inst.name}
                        </p>
                        <p className="text-xs text-surface-500 capitalize">
                          {inst.type}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
