import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Home, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

// Placeholder - in production, fetch from Supabase
const sampleProperties = [
  { id: '1', title: '3-Bedroom Apartment in Lekki', price: '₦8,500,000', location: 'Lekki, Lagos', type: 'Apartment', verified: true, image: '/assets/property-apartment-lekki.jpg' },
  { id: '2', title: 'Family House in Ikeja', price: '₦15,000,000', location: 'Ikeja, Lagos', type: 'House', verified: true, image: '/assets/property-house-ikeja.jpg' },
  { id: '3', title: 'Office Space in VI', price: '₦500,000/mo', location: 'Victoria Island, Lagos', type: 'Office', verified: false, image: '/assets/property-office-vi.jpg' },
];

export default function PublicPropertyListPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'rent' | 'sale'>('all');

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-16 lg:py-24 bg-gradient-to-br from-forest-50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                Property Listings
              </h1>
              <p className="text-xl text-surface-600 max-w-2xl mb-8">
                Browse verified properties. Rent or buy with confidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input
                    type="text"
                    placeholder="Search by location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-surface-300 focus:ring-2 focus:ring-forest-500 focus:border-forest-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'rent', 'sale'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-lg font-medium capitalize ${
                        filter === f ? 'bg-forest-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sampleProperties.map((prop, i) => (
                <ScrollReveal key={prop.id} delay={i * 0.1}>
                  <Link
                    to={`/property/${prop.id}`}
                    className="block rounded-2xl overflow-hidden bg-white border border-surface-200 hover:shadow-lg hover:border-forest-200 transition-all group"
                  >
                    <div className="relative aspect-[4/3] bg-surface-200 overflow-hidden">
                      <img src={prop.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {prop.verified && (
                        <span className="absolute top-3 left-3 px-2 py-1 bg-forest-600 text-white text-xs font-medium rounded">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-2 text-sm text-surface-500 mb-2">
                        <Home className="w-4 h-4" />
                        {prop.type}
                      </div>
                      <h3 className="font-semibold text-surface-900 group-hover:text-forest-600 transition-colors">{prop.title}</h3>
                      <p className="text-lg font-bold text-forest-600 mt-2">{prop.price}</p>
                      <div className="flex items-center gap-2 text-sm text-surface-500 mt-2">
                        <MapPin className="w-4 h-4" />
                        {prop.location}
                      </div>
                      <span className="inline-flex items-center gap-1 text-forest-600 font-medium mt-4 group-hover:gap-2 transition-all">
                        View details <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal>
              <div className="mt-12 text-center">
                <p className="text-surface-600 mb-4">Sign in to see more listings and contact owners.</p>
                <Link to="/register">
                  <Button className="bg-forest-600 hover:bg-forest-700 text-white">Create free account</Button>
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
