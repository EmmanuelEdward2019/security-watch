import { Link, useParams } from 'react-router-dom';
import { MapPin, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function PublicPropertyDetailPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-8 lg:py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="grid lg:grid-cols-2 gap-12">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-surface-200">
                  <img src="/assets/property-verification.jpg" alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-forest-100 text-forest-600 rounded-full text-sm font-medium mb-4">
                    <Shield className="w-4 h-4" /> Verified
                  </span>
                  <h1 className="text-3xl font-bold text-surface-900 mb-4">
                    {id === '1' ? '3-Bedroom Apartment in Lekki' : id === '2' ? 'Family House in Ikeja' : 'Office Space in VI'}
                  </h1>
                  <p className="text-2xl font-bold text-forest-600 mb-4">
                    {id === '1' ? '₦8,500,000' : id === '2' ? '₦15,000,000' : '₦500,000/mo'}
                  </p>
                  <div className="flex items-center gap-2 text-surface-600 mb-6">
                    <MapPin className="w-5 h-5" />
                    {id === '1' ? 'Lekki, Lagos' : id === '2' ? 'Ikeja, Lagos' : 'Victoria Island, Lagos'}
                  </div>
                  <p className="text-surface-600 mb-8">
                    A well-maintained property with modern amenities. Verified ownership and documents. 
                    Contact the owner to schedule a viewing or make an offer.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Link to="/register">
                      <Button size="lg" icon={ArrowRight} className="bg-forest-600 hover:bg-forest-700 text-white">
                        Contact owner
                      </Button>
                    </Link>
                    <Link to="/register">
                      <Button size="lg" variant="outline">Request verification</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
