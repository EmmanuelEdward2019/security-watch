import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Library, Film, Calendar } from 'lucide-react';
import { Card, CardContent, Button, StatusBadge } from '@/components/ui';

interface MediaItem {
  id: string;
  title: string;
  category: string;
  date: string;
  status: string;
}

const mockMedia: MediaItem[] = [
  { id: '1', title: 'Central Station Monthly Report', category: 'Police', date: '2026-03-18', status: 'verified' },
  { id: '2', title: 'School Infrastructure Audit', category: 'Schools', date: '2026-03-16', status: 'verified' },
  { id: '3', title: 'City Hospital Staff Review', category: 'Hospitals', date: '2026-03-14', status: 'pending' },
  { id: '4', title: 'Market Safety Inspection', category: 'Markets', date: '2026-03-12', status: 'verified' },
  { id: '5', title: 'East Police Post Update', category: 'Police', date: '2026-03-10', status: 'active' },
  { id: '6', title: 'Regional Hospital Conditions', category: 'Hospitals', date: '2026-03-08', status: 'verified' },
  { id: '7', title: 'Hilltop School Water Access', category: 'Schools', date: '2026-03-06', status: 'pending' },
  { id: '8', title: 'Central Market Vendor Survey', category: 'Markets', date: '2026-03-04', status: 'verified' },
  { id: '9', title: 'Highway Patrol Office Footage', category: 'Police', date: '2026-03-02', status: 'active' },
];

const categories = ['All', 'Police', 'Schools', 'Hospitals', 'Markets'];

export default function ContentLibraryPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = mockMedia.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
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
            <Library size={24} className="text-forest-600" />
            Content Library
          </h1>
          <p className="text-surface-600 mt-1">
            Browse and manage approved media content
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
              placeholder="Search content..."
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
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card hover>
                <div className="h-40 bg-surface-100 flex items-center justify-center">
                  <Film size={40} className="text-surface-300" strokeWidth={1.5} />
                </div>
                <CardContent>
                  <h3 className="font-semibold text-surface-900 line-clamp-1">{item.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-forest-50 text-forest-600">
                      {item.category}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-surface-500 flex items-center gap-1 mt-2">
                    <Calendar size={12} />
                    {item.date}
                  </p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Library size={48} className="mx-auto text-surface-300 mb-4" strokeWidth={1.5} />
            <p className="text-surface-600 font-medium">No content found</p>
            <p className="text-surface-500 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
