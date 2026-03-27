import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent-100 text-accent-600 mb-6">
          <ShieldAlert size={40} strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-surface-900">
          Access denied
        </h1>
        <p className="mt-3 text-surface-500">
          You don&apos;t have permission to access this page.
        </p>
        <Link to="/app/dashboard" className="mt-8 inline-block">
          <Button variant="outline" icon={ArrowLeft}>
            Back to dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
