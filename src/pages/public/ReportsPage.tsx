import { Link } from 'react-router-dom';
import { FileText, Award, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-20 lg:py-28 bg-sky-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal>
                <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 mb-6">
                  Reports & Insights
                </h1>
                <p className="text-xl text-surface-600 max-w-2xl">
                  Institution performance summaries, top performers, and improvement case studies. 
                  Data-driven transparency.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/assets/professional-woman.jpg"
                    alt="Reports and data-driven insights"
                    className="w-full h-[280px] sm:h-[360px] object-cover"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: FileText, title: 'Institution Reports', desc: 'Performance summaries for police stations, schools, hospitals, and more.' },
                { icon: Award, title: 'Top Performers', desc: 'Institutions that excel get public recognition.' },
                { icon: TrendingUp, title: 'Improvement Stories', desc: 'Case studies of institutions that improved after feedback.' },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1}>
                  <div className="p-8 rounded-2xl bg-surface-50 border border-surface-200">
                    <item.icon className="w-12 h-12 text-forest-600 mb-4" />
                    <h3 className="text-xl font-semibold text-surface-900 mb-2">{item.title}</h3>
                    <p className="text-surface-600">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24 bg-surface-50">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <ScrollReveal>
              <h2 className="text-2xl font-bold text-surface-900 mb-4">Downloadable Reports</h2>
              <p className="text-surface-600 mb-8">
                Sign in to access full reports and downloadable PDFs. Public summaries are available on our Media page.
              </p>
              <Link to="/media">
                <Button variant="outline" icon={Download}>View media & reports</Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
