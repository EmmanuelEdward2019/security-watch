import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Calendar, Eye, BarChart3 } from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';

interface InstitutionReport {
  id: string;
  name: string;
  category: string;
  score: number;
  lastVisitDate: string;
}

const mockInstitutions: InstitutionReport[] = [
  { id: '1', name: 'Central Police Station', category: 'Police', score: 87, lastVisitDate: '2026-03-18' },
  { id: '2', name: 'City General Hospital', category: 'Hospitals', score: 72, lastVisitDate: '2026-03-16' },
  { id: '3', name: 'Westside Primary School', category: 'Schools', score: 91, lastVisitDate: '2026-03-14' },
  { id: '4', name: 'Market Square', category: 'Markets', score: 65, lastVisitDate: '2026-03-12' },
  { id: '5', name: 'East District Police Post', category: 'Police', score: 54, lastVisitDate: '2026-03-10' },
  { id: '6', name: 'Regional Hospital', category: 'Hospitals', score: 78, lastVisitDate: '2026-03-08' },
  { id: '7', name: 'Hilltop Secondary School', category: 'Schools', score: 83, lastVisitDate: '2026-03-06' },
  { id: '8', name: 'Central Market', category: 'Markets', score: 69, lastVisitDate: '2026-03-04' },
  { id: '9', name: 'Highway Patrol Office', category: 'Police', score: 46, lastVisitDate: '2026-03-02' },
];

function getScoreColor(score: number) {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-accent-100 text-accent-700';
}

const categories = ['All', 'Police', 'Schools', 'Hospitals', 'Markets'];

export default function InstitutionReportsPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = mockInstitutions.filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || inst.category === activeCategory;
    return matchesSearch && matchesCategory;
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
            <BarChart3 size={24} className="text-forest-600" />
            Institution Reports
          </h1>
          <p className="text-surface-600 mt-1">
            View performance reports for monitored institutions
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 space-y-4"
        >
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search institutions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-300 bg-white pl-10 pr-4 py-2.5 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-forest-600/50 focus:border-forest-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === cat
                    ? 'bg-forest-600 text-white'
                    : 'text-surface-600 hover:bg-surface-100 border border-surface-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((inst, i) => (
            <motion.div
              key={inst.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card hover>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-forest-50 text-forest-600">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-surface-900">{inst.name}</h3>
                        <span className="text-xs text-surface-500">{inst.category}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-sm font-bold rounded-lg ${getScoreColor(inst.score)}`}>
                      {inst.score}
                    </span>
                  </div>
                  <p className="text-sm text-surface-500 flex items-center gap-1">
                    <Calendar size={14} />
                    Last visit: {inst.lastVisitDate}
                  </p>
                  <Button variant="outline" size="sm" icon={Eye} className="w-full">
                    View Report
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Building2 size={48} className="mx-auto text-surface-300 mb-4" strokeWidth={1.5} />
            <p className="text-surface-600 font-medium">No institutions found</p>
            <p className="text-surface-500 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
