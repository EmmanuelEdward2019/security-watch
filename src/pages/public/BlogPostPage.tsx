import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

const posts: Record<string, { title: string; date: string; content: string }> = {
  'avoid-land-scams': {
    title: 'How to Identify and Avoid Land Fraud in Nigeria',
    date: '2024-03-15',
    content: 'Land fraud remains one of the most prevalent financial crimes in Nigeria. Key warning signs include pricing significantly below market value, sellers unwilling to submit to independent verification, and undue pressure to complete payment before documentation is reviewed. To mitigate risk, prospective buyers should always verify ownership through official land registry channels, insist on authenticated copies of survey plans and title documents, conduct a physical inspection of the property, and engage a professional verification service such as The Security Watch before committing any funds.',
  },
  'private-investigations': {
    title: 'How Private Investigations Work on Our Platform',
    date: '2024-03-10',
    content: 'When a case is submitted through The Security Watch, it undergoes an initial review and is assigned to a qualified professional based on the nature of the matter and the relevant jurisdiction. The assigned investigator examines all submitted evidence, conducts further enquiries as warranted, and works methodically toward resolution. All communications are handled through secure, confidential channels. Clients can monitor case progress in real time through their personalised dashboard. Investigation timelines vary depending on complexity — ranging from days for straightforward enquiries to several weeks for more involved matters. Regular updates are provided at each milestone.',
  },
  'property-verification': {
    title: 'Understanding Our Property Verification Process',
    date: '2024-03-05',
    content: 'The Security Watch conducts independent verification of property ownership by cross-referencing seller claims against official land registry records, examining title deeds, survey plans, and certificates of occupancy for authenticity, and confirming the absence of encumbrances or competing claims. Properties that successfully pass our verification process receive a verified status badge, providing prospective buyers and tenants with an additional layer of confidence. While verification significantly reduces the risk of fraud, it is recommended as one component of a comprehensive due diligence approach.',
  },
  'institutional-transparency': {
    title: 'The Importance of Institutional Transparency',
    date: '2024-02-28',
    content: 'Independent oversight drives measurable improvement in institutional performance. The Security Watch deploys trained media agents to conduct anonymous, on-site evaluations of public and private institutions — assessing punctuality, facility maintenance, staff professionalism, and quality of service delivery. The programme is designed to be constructive rather than punitive: institutions that demonstrate high standards receive public recognition and commendation, while those with identified deficiencies are provided with documented recommendations for improvement. The broader objective is to raise the standard of public services for the benefit of all citizens.',
  },
};

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug && posts[slug] ? posts[slug] : posts['avoid-land-scams'];

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <article className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <Link to="/blog" className="inline-flex items-center gap-2 text-forest-600 hover:underline mb-8">
                <ArrowLeft className="w-4 h-4" /> Back to blog
              </Link>
              <div className="flex items-center gap-2 text-sm text-surface-500 mb-4">
                <Calendar className="w-4 h-4" />
                {post.date}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-6">{post.title}</h1>
              <div className="prose prose-slate max-w-none">
                <p className="text-lg text-surface-600 leading-relaxed">{post.content}</p>
              </div>
            </ScrollReveal>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
