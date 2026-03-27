import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs } from '@/components/ui';
import { AgentVerificationTab } from './AgentVerificationTab';
import { PropertyVerificationTab } from './PropertyVerificationTab';

export function VerificationPage() {
  const [activeTab, setActiveTab] = useState('agents');

  const tabs = [
    {
      id: 'agents',
      label: 'Agent Verifications',
      content: <AgentVerificationTab />,
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
