import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, ChevronUp } from 'lucide-react';
import { usePropertyStore } from '@/stores/propertyStore';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Button, Input, Select, Card, CardContent, EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/utils/cn';

const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Office' },
];

const LISTING_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'For Rent' },
];

export function PropertyListPage() {
  const {
    properties,
    isLoading,
    filters,
    setFilters,
    fetchProperties,
  } = usePropertyStore();

  const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    setFilters({
      ...filters,
      search: searchQuery || undefined,
      status: verifiedOnly ? 'verified' : undefined,
    });
  }, [searchQuery, verifiedOnly]);

  useEffect(() => {
    fetchProperties();
  }, [filters, fetchProperties]);

  const handleApplyFilters = () => {
    fetchProperties();
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setVerifiedOnly(false);
    fetchProperties();
  };

  const hasActiveFilters =
    filters.location ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.propertyType ||
    filters.listingType ||
    filters.status ||
    searchQuery;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-700 text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
              Find Your Perfect Property
            </h1>
            <p className="text-brand-100 text-lg mb-8">
              Browse verified listings from trusted landlords. Your next home awaits.
            </p>
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400"
                size={20}
              />
              <input
                type="search"
                placeholder="Search by title, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/*
            Filters run across the top rather than down a 288px rail.
            Stacked vertically they pushed the listing grid into two
            columns on a laptop and forced a scroll past six controls to
            reach the one you wanted. Across the top they read at a glance
            and the grid gets the full width back.
          */}
          <aside>
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-surface-900">Filters</h3>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-accent-600"
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="lg:hidden"
                    >
                      {showFilters ? <ChevronUp size={16} /> : <SlidersHorizontal size={16} />}
                      {showFilters ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>

                <div
                  className={cn(
                    'gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end',
                    showFilters ? 'grid' : 'hidden lg:grid'
                  )}
                >

                  <div className="lg:col-span-3">
                    <Input
                      label="Location"
                      placeholder="City or area"
                      value={filters.location ?? ''}
                      onChange={(e) =>
                        setFilters({ ...filters, location: e.target.value || undefined })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 lg:col-span-3">
                  <Input
                    label="Min Price"
                    type="number"
                    placeholder="0"
                    value={filters.minPrice ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minPrice: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    label="Max Price"
                    type="number"
                    placeholder="Any"
                    value={filters.maxPrice ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxPrice: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                  <div className="lg:col-span-2">
                    <Select
                      label="Property Type"
                      options={PROPERTY_TYPE_OPTIONS}
                      value={filters.propertyType ?? ''}
                      onChange={(e) =>
                        setFilters({ ...filters, propertyType: e.target.value || undefined })
                      }
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <Select
                      label="Listing Type"
                      options={LISTING_TYPE_OPTIONS}
                      value={filters.listingType ?? ''}
                      onChange={(e) =>
                        setFilters({ ...filters, listingType: e.target.value || undefined })
                      }
                    />
                  </div>

                  {/* Sits on the control baseline, so the row reads as one
                      strip rather than a stack with a stray checkbox. */}
                  <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={verifiedOnly}
                        onChange={(e) => setVerifiedOnly(e.target.checked)}
                        className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm text-surface-700">Verified only</span>
                    </label>
                    <Button variant="primary" className="flex-1" onClick={handleApplyFilters}>
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="min-w-0">
            {/* The show/hide toggle now lives on the filter card itself,
                beside Clear, rather than orphaned above the results. */}
            <div className="mb-6 flex items-center justify-end">
              <p className="text-sm text-surface-500">
                {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Spinner size="lg" />
              </div>
            ) : properties.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No properties found"
                description="Try adjusting your filters or search criteria to find more listings."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {properties.map((property, index) => (
                    <div
                      key={property.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <PropertyCard property={property} />
                    </div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
