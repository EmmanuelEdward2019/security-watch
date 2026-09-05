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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter Sidebar - Collapsible on mobile */}
          <aside
            className={cn(
              'lg:w-72 shrink-0',
              showFilters ? 'block mb-4' : 'hidden lg:block'
            )}
          >
            <Card className="lg:sticky lg:top-4">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-surface-900">Filters</h3>
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
                </div>

                <Input
                  label="Location"
                  placeholder="City or area"
                  value={filters.location ?? ''}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
                />
                <div className="grid grid-cols-2 gap-2">
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
                <Select
                  label="Property Type"
                  options={PROPERTY_TYPE_OPTIONS}
                  value={filters.propertyType ?? ''}
                  onChange={(e) =>
                    setFilters({ ...filters, propertyType: e.target.value || undefined })
                  }
                />
                <Select
                  label="Listing Type"
                  options={LISTING_TYPE_OPTIONS}
                  value={filters.listingType ?? ''}
                  onChange={(e) =>
                    setFilters({ ...filters, listingType: e.target.value || undefined })
                  }
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-surface-700">Verified only</span>
                </label>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleApplyFilters}
                >
                  Apply Filters
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden"
              >
                {showFilters ? (
                  <>
                    <ChevronUp size={16} />
                    Hide Filters
                  </>
                ) : (
                  <>
                    <SlidersHorizontal size={16} />
                    Show Filters
                  </>
                )}
              </Button>
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
