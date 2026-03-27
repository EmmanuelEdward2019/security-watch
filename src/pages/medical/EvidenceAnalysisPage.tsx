import { motion } from 'framer-motion';
import {
  Microscope,
  ClipboardList,
  Beaker,
  CheckCircle2,
  ArrowRight,
  Clock,
  FileSearch,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Badge, Button } from '@/components/ui';
const PENDING_CASES = [
  { id: '1', caseRef: 'CSE-018', title: 'Toxicology Report — Poisoning Suspicion', date: '2026-03-17', urgency: 'High' },
  { id: '2', caseRef: 'CSE-015', title: 'Autopsy Review — Unidentified Remains', date: '2026-03-12', urgency: 'Critical' },
  { id: '3', caseRef: 'CSE-012', title: 'DNA Analysis — Assault Evidence', date: '2026-03-08', urgency: 'Medium' },
];

const ANALYSIS_TOOLS = [
  { name: 'Toxicology Screening', icon: Beaker, description: 'Run toxicology panels on submitted samples' },
  { name: 'DNA Comparison', icon: Microscope, description: 'Compare DNA profiles from evidence' },
  { name: 'Document Forensics', icon: FileSearch, description: 'Analyze document authenticity and tampering' },
];

const COMPLETED_ANALYSES = [
  { id: '1', caseRef: 'CSE-006', title: 'Blood Analysis — Assault Case', date: '2026-02-20', result: 'Conclusive' },
  { id: '2', caseRef: 'CSE-003', title: 'Toxicology Panel — Food Contamination', date: '2026-02-05', result: 'Inconclusive' },
  { id: '3', caseRef: 'CSE-001', title: 'DNA Match — Theft Evidence', date: '2026-01-18', result: 'Conclusive' },
];

const URGENCY_VARIANT: Record<string, 'danger' | 'warning' | 'info'> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
};

export default function EvidenceAnalysisPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Evidence Analysis</h1>
        <p className="text-surface-500 mt-1">
          Review pending cases, run analyses, and manage completed reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Pending Analysis</h2>
            <Badge variant="warning" size="sm">
              {PENDING_CASES.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-surface-100">
            {PENDING_CASES.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-forest-600 bg-forest-50 px-1.5 py-0.5 rounded">
                      {c.caseRef}
                    </span>
                    <Badge variant={URGENCY_VARIANT[c.urgency]} size="sm">
                      {c.urgency}
                    </Badge>
                  </div>
                  <p className="font-medium text-surface-900">{c.title}</p>
                  <p className="text-sm text-surface-500 flex items-center gap-1 mt-0.5">
                    <Clock size={14} />
                    Submitted {c.date}
                  </p>
                </div>
                <Button variant="ghost" size="sm" icon={ArrowRight}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Beaker size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Analysis Tools</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ANALYSIS_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.name}
                  className="rounded-xl border border-surface-200 bg-surface-50 p-4 hover:border-forest-300 hover:bg-forest-50/30 transition-colors cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-forest-100 w-fit mb-3">
                    <Icon size={22} className="text-forest-600" />
                  </div>
                  <h3 className="font-medium text-surface-900 mb-1">{tool.name}</h3>
                  <p className="text-sm text-surface-500">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-forest-600" />
            <h2 className="font-semibold text-surface-900">Completed Analyses</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-surface-100">
            {COMPLETED_ANALYSES.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-forest-600 bg-forest-50 px-1.5 py-0.5 rounded">
                      {a.caseRef}
                    </span>
                    <Badge
                      variant={a.result === 'Conclusive' ? 'success' : 'warning'}
                      size="sm"
                      dot
                    >
                      {a.result}
                    </Badge>
                  </div>
                  <p className="font-medium text-surface-900">{a.title}</p>
                  <p className="text-sm text-surface-500 mt-0.5">Completed {a.date}</p>
                </div>
                <Button variant="ghost" size="sm" icon={ArrowRight}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
