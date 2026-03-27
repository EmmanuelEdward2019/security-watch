import { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Shield, Home, Film, Save } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardContent } from '@/components/ui';

export default function PricingControlPage() {
  const [investigationFees, setInvestigationFees] = useState({
    baseFee: '500',
    complexCaseFee: '1500',
    urgentCaseFee: '2500',
  });

  const [propertyFees, setPropertyFees] = useState({
    listingFee: '100',
    verificationFee: '300',
    commission: '5',
  });

  const [mediaFees, setMediaFees] = useState({
    agentPayout: '200',
    contentLicenseFee: '150',
  });

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <DollarSign size={24} className="text-forest-600" />
            Pricing Control
          </h1>
          <p className="text-surface-600 mt-1">
            Manage fees and pricing across all platform services
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <Shield size={20} className="text-forest-600" />
                  Investigation Fees
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Base Fee (GHS)"
                  type="number"
                  value={investigationFees.baseFee}
                  onChange={(e) =>
                    setInvestigationFees((p) => ({ ...p, baseFee: e.target.value }))
                  }
                />
                <Input
                  label="Complex Case Fee (GHS)"
                  type="number"
                  value={investigationFees.complexCaseFee}
                  onChange={(e) =>
                    setInvestigationFees((p) => ({ ...p, complexCaseFee: e.target.value }))
                  }
                />
                <Input
                  label="Urgent Case Fee (GHS)"
                  type="number"
                  value={investigationFees.urgentCaseFee}
                  onChange={(e) =>
                    setInvestigationFees((p) => ({ ...p, urgentCaseFee: e.target.value }))
                  }
                />
                <Button variant="primary" icon={Save} className="w-full">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <Home size={20} className="text-forest-600" />
                  Property Fees
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Listing Fee (GHS)"
                  type="number"
                  value={propertyFees.listingFee}
                  onChange={(e) =>
                    setPropertyFees((p) => ({ ...p, listingFee: e.target.value }))
                  }
                />
                <Input
                  label="Verification Fee (GHS)"
                  type="number"
                  value={propertyFees.verificationFee}
                  onChange={(e) =>
                    setPropertyFees((p) => ({ ...p, verificationFee: e.target.value }))
                  }
                />
                <Input
                  label="Commission (%)"
                  type="number"
                  value={propertyFees.commission}
                  onChange={(e) =>
                    setPropertyFees((p) => ({ ...p, commission: e.target.value }))
                  }
                />
                <Button variant="primary" icon={Save} className="w-full">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
                  <Film size={20} className="text-forest-600" />
                  Media Fees
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Agent Payout (GHS)"
                  type="number"
                  value={mediaFees.agentPayout}
                  onChange={(e) =>
                    setMediaFees((p) => ({ ...p, agentPayout: e.target.value }))
                  }
                />
                <Input
                  label="Content License Fee (GHS)"
                  type="number"
                  value={mediaFees.contentLicenseFee}
                  onChange={(e) =>
                    setMediaFees((p) => ({ ...p, contentLicenseFee: e.target.value }))
                  }
                />
                <Button variant="primary" icon={Save} className="w-full">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
