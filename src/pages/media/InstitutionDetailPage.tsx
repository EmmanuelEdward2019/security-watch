import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  MapPin,
  Star,
  Video,
  BarChart3,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useMediaStore } from '@/stores/mediaStore';
import { useAuthStore } from '@/stores/authStore';
import { ScoreCard } from '@/components/media/ScoreCard';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Modal,
  Spinner,
  EmptyState,
  TextArea,
} from '@/components/ui';
import toast from 'react-hot-toast';

const METRIC_KEYS = [
  'punctuality',
  'professionalism',
  'cleanliness',
  'integrity',
  'service_delivery',
] as const;

const METRIC_LABELS: Record<string, string> = {
  punctuality: 'Punctuality',
  professionalism: 'Professionalism',
  cleanliness: 'Cleanliness',
  integrity: 'Integrity',
  service_delivery: 'Service Delivery',
};

export function InstitutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    institutions,
    mediaReports,
    scores,
    isLoading,
    fetchInstitutions,
    fetchMediaReports,
    fetchScores,
    addScore,
    getInstitutionRanking,
  } = useMediaStore();

  const [institution, setInstitution] = useState(
    () => institutions.find((i) => i.id === id)
  );
  const [rankPosition, setRankPosition] = useState<number | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    punctuality: 3,
    professionalism: 3,
    cleanliness: 3,
    integrity: 3,
    service_delivery: 3,
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  useEffect(() => {
    if (id) {
      fetchScores(id);
      fetchMediaReports({ institutionId: id, status: 'published' });
    }
  }, [id, fetchScores, fetchMediaReports]);

  useEffect(() => {
    getInstitutionRanking().then((r) => {
      const pos = r.findIndex((x) => x.institution.id === id);
      setRankPosition(pos >= 0 ? pos + 1 : null);
    });
  }, [id, getInstitutionRanking]);

  useEffect(() => {
    setInstitution(institutions.find((i) => i.id === id));
  }, [id, institutions]);

  const avgScores = scores.length
    ? METRIC_KEYS.reduce(
        (acc, key) => {
          const sum = scores.reduce((a, s) => a + (s[key] ?? 0), 0);
          acc[key] = sum / scores.length;
          return acc;
        },
        {} as Record<string, number>
      )
    : null;

  const overallAvg =
    avgScores &&
    Object.values(avgScores).reduce((a, b) => a + b, 0) / Object.values(avgScores).length;

  const radarData = avgScores
    ? METRIC_KEYS.map((key) => ({
        subject: METRIC_LABELS[key],
        value: avgScores[key] ?? 0,
        fullMark: 5,
      }))
    : [];

  const barData = avgScores
    ? METRIC_KEYS.map((key) => ({
        name: METRIC_LABELS[key],
        value: avgScores[key] ?? 0,
      }))
    : [];

  const handleSubmitRating = async () => {
    if (!id || !user) return;
    setIsSubmitting(true);
    const { error } = await addScore({
      institution_id: id,
      scorer_id: user.user_id,
      ...ratingForm,
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Thank you for your rating!');
    setRateModalOpen(false);
    setRatingForm({
      punctuality: 3,
      professionalism: 3,
      cleanliness: 3,
      integrity: 3,
      service_delivery: 3,
      comment: '',
    });
    fetchScores(id);
  };

  if (isLoading && !institution) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          title="Institution not found"
          description="This institution may have been removed or doesn't exist."
          action={
            <Link to="/app/media/institutions">
              <Button variant="outline">Back to Institutions</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/app/media/institutions"
          className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-brand-600 mb-6"
        >
          <ChevronLeft size={16} />
          Back to institutions
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-surface-900 mb-1">
                    {institution.name}
                  </h1>
                  <p className="text-surface-600 capitalize">{institution.type}</p>
                  {institution.location && (
                    <div className="flex items-center gap-1.5 mt-2 text-surface-600">
                      <MapPin size={16} className="text-brand-500" />
                      {institution.location}
                    </div>
                  )}
                  {institution.supervising_authority && (
                    <p className="text-sm text-surface-500 mt-1">
                      Supervised by: {institution.supervising_authority}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {rankPosition != null && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-50">
                      <Star size={20} className="text-brand-600" />
                      <span className="font-semibold text-brand-700">
                        Rank #{rankPosition}
                      </span>
                    </div>
                  )}
                  {user && (
                    <Button
                      variant="primary"
                      icon={Star}
                      onClick={() => setRateModalOpen(true)}
                    >
                      Rate This Institution
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Scorecard */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} />
              Performance Scorecard
            </h2>

            {scores.length === 0 ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center justify-center">
                  <p className="text-surface-600 mb-4">
                    No ratings yet. Be the first to rate this institution!
                  </p>
                  {user && (
                    <Button
                      variant="primary"
                      icon={Star}
                      onClick={() => setRateModalOpen(true)}
                    >
                      Rate This Institution
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                <ScoreCard
                  scores={avgScores ?? {}}
                  overallScore={overallAvg != null ? overallAvg : undefined}
                  size="lg"
                />
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">Score Breakdown</h3>
                    </CardHeader>
                    <CardContent>
                      {radarData.length > 0 && (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid />
                              <PolarAngleAxis />
                              <PolarRadiusAxis angle={90} domain={[0, 5]} />
                              <Radar
                                name="Institution"
                                dataKey="value"
                                stroke="var(--color-brand-500)"
                                fill="var(--color-brand-500)"
                                fillOpacity={0.3}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {barData.length > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} layout="vertical" margin={{ left: 0 }}>
                              <XAxis type="number" domain={[0, 5]} />
                              <YAxis type="category" dataKey="name" width={100} />
                              <Tooltip />
                              <Bar
                                dataKey="value"
                                fill="var(--color-brand-500)"
                                radius={[0, 4, 4, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Media Reports */}
          {mediaReports.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-surface-900 mb-4 flex items-center gap-2">
                <Video size={20} />
                Media Reports
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mediaReports.map((report) => (
                  <Link key={report.id} to={`/app/media/${report.id}`}>
                    <Card hover>
                      <div className="aspect-video bg-surface-100">
                        {report.thumbnail_url ? (
                          <img
                            src={report.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-surface-400">
                            <Video size={32} />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-medium text-surface-900 line-clamp-2 text-sm">
                          {report.title}
                        </h3>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Rate Modal */}
      <Modal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title="Rate This Institution"
        size="lg"
      >
        <div className="space-y-4">
          {METRIC_KEYS.map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                {METRIC_LABELS[key]} (1-5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={ratingForm[key]}
                onChange={(e) =>
                  setRatingForm({
                    ...ratingForm,
                    [key]: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-surface-200 accent-brand-500"
              />
              <span className="text-sm text-surface-500 ml-2">
                {ratingForm[key]}
              </span>
            </div>
          ))}
          <TextArea
            label="Comment (optional)"
            value={ratingForm.comment}
            onChange={(e) =>
              setRatingForm({ ...ratingForm, comment: e.target.value })
            }
            placeholder="Share your experience..."
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setRateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmitting}
              onClick={handleSubmitRating}
            >
              Submit Rating
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
