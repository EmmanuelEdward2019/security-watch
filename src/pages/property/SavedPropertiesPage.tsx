import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, MapPin, Eye, Trash2, Home } from 'lucide-react';
import { Card, CardContent, Button, EmptyState } from '@/components/ui';

interface SavedProperty {
  id: string;
  title: string;
  location: string;
  price: string;
}

const initialSaved: SavedProperty[] = [
  { id: '1', title: '3BR Apartment, Westlands', location: 'Westlands, Accra', price: 'GHS 2,500/mo' },
  { id: '2', title: 'Studio Flat, CBD', location: 'Central Business District', price: 'GHS 1,200/mo' },
  { id: '3', title: '2BR House, Osu', location: 'Osu, Accra', price: 'GHS 3,500/mo' },
  { id: '4', title: '4BR Villa, East Legon', location: 'East Legon, Accra', price: 'GHS 8,000/mo' },
  { id: '5', title: '1BR Apartment, Labone', location: 'Labone, Accra', price: 'GHS 1,800/mo' },
  { id: '6', title: '2BR Apartment, Cantonments', location: 'Cantonments, Accra', price: 'GHS 3,000/mo' },
];

export default function SavedPropertiesPage() {
  const [saved, setSaved] = useState(initialSaved);

  const handleRemove = (id: string) => {
    setSaved((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Bookmark size={24} className="text-forest-600" />
            Saved Properties
          </h1>
          <p className="text-surface-600 mt-1">
            Properties you've bookmarked for later
          </p>
        </motion.div>

        {saved.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent>
                <EmptyState
                  icon={Bookmark}
                  title="No saved properties"
                  description="Properties you bookmark will appear here. Browse listings to find your next home."
                />
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {saved.map((property, i) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                layout
              >
                <Card hover>
                  <div className="h-40 bg-surface-100 flex items-center justify-center">
                    <Home size={40} className="text-surface-300" strokeWidth={1.5} />
                  </div>
                  <CardContent>
                    <h3 className="font-semibold text-surface-900">{property.title}</h3>
                    <p className="text-sm text-surface-500 flex items-center gap-1 mt-1">
                      <MapPin size={14} />
                      {property.location}
                    </p>
                    <p className="text-lg font-bold text-forest-600 mt-2">{property.price}</p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="primary" size="sm" icon={Eye} className="flex-1">
                        View
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        className="flex-1"
                        onClick={() => handleRemove(property.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
