import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Tabs, Card, CardContent } from '@/components/ui';
import { PropertyVerificationTab } from './PropertyVerificationTab';

/**
 * Verifications.
 *
 * The agent tab used to render a review panel showing a name, a rating, a
 * specialisation and two document links. Approving an investigator grants sight
 * of criminal case files, complainant identities and filed evidence — that is
 * not a decision anyone should make from four fields.
 *
 * Everything the applicant actually submitted — date of birth, National ID,
 * residential address, professional summary, qualifications, every uploaded
 * document and both guarantors — is assembled by `admin_kyc_application()` and
 * shown on the KYC review screen. That screen existed all along but was never
 * routed, so the sidebar link bounced admins to the public home page and this
 * thin panel was the only thing they could reach.
 *
 * Rather than maintain a second, weaker review surface, the tab now points at
 * the real one. Property verification is unaffected and stays here.
 */
export function VerificationPage() {
  const [activeTab, setActiveTab] = useState('agents');

  const tabs = [
    {
      id: 'agents',
      label: 'Agent Verifications',
      content: (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <ShieldCheck className="h-6 w-6 text-brand-600" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900">
              Agent verification has moved
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-surface-600">
              Applications are reviewed on the KYC screen, which shows identity
              details, professional standing, every uploaded document and both
              guarantors — everything needed to make the decision properly.
            </p>
            <Link
              to="/app/admin/kyc"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
            >
              Open KYC review
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'properties',
      label: 'Property Verifications',
      content: <PropertyVerificationTab />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Verifications</h1>
      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />
    </motion.div>
  );
}
