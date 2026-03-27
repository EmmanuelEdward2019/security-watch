import { Link, useLocation } from 'react-router-dom';
import { PublicNav, PublicFooter, ScrollReveal } from '@/components/public';

const legalContent: Record<string, { title: string; content: string }> = {
  privacy: {
    title: 'Privacy Policy',
    content: `
We respect your privacy. This policy explains how we collect, use, and protect your information.

**Information We Collect**
- Account details (name, email, phone)
- Case and property information you submit
- Usage data to improve our platform

**How We Use It**
- To provide our services
- To match you with investigators or properties
- To communicate with you
- To improve our platform

**Data Protection**
We use encryption and secure storage. We do not sell your data to third parties.

**Your Rights**
You can access, correct, or delete your data. Contact us for any privacy requests.

Last updated: March 2024
    `,
  },
  terms: {
    title: 'Terms of Service',
    content: `
By using The Security Watch, you agree to these terms.

**Eligibility**
You must be 18+ and provide accurate information. You are responsible for your account.

**Services**
We connect users with investigators and facilitate property transactions. We are a platform—not law enforcement or a real estate agency.

**User Conduct**
You agree not to misuse the platform, submit false information, or harm others. Violations may result in account suspension.

**Limitation of Liability**
We are not liable for outcomes of investigations or property transactions. Users engage professionals at their own discretion.

**Changes**
We may update these terms. Continued use means acceptance.

Last updated: March 2024
    `,
  },
  disclaimer: {
    title: 'Disclaimer',
    content: `
**Important Notice**

The Security Watch is a technology platform that connects users with verified investigators and facilitates property verification. We are:

- **NOT** law enforcement
- **NOT** a government agency
- **NOT** a licensed real estate agency
- **NOT** responsible for outcomes of investigations or transactions

**User Responsibility**
Users are solely responsible for their actions on the platform. We verify agents and properties to the best of our ability, but we cannot guarantee results.

**No Legal Advice**
Nothing on this platform constitutes legal advice. Consult a lawyer for legal matters.

**Use at Your Own Risk**
By using our services, you acknowledge these limitations and use the platform at your own risk.

Last updated: March 2024
    `,
  },
};

export default function LegalPage() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const type = pathParts[pathParts.length - 1] || pathParts[0] || 'privacy';
  const page = legalContent[type] || legalContent.privacy;

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <main className="pt-16 lg:pt-20">
        <section className="py-16 lg:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <h1 className="text-3xl font-bold text-surface-900 mb-8">{page.title}</h1>
              <div className="prose prose-slate max-w-none">
                {page.content.split('\n').map((para, i) => {
                  if (para.startsWith('**') && para.endsWith('**')) {
                    return <h2 key={i} className="text-lg font-semibold text-surface-900 mt-6 mb-2">{para.replace(/\*\*/g, '')}</h2>;
                  }
                  if (para.trim()) {
                    return <p key={i} className="text-surface-600 mb-4">{para.trim()}</p>;
                  }
                  return null;
                })}
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="mt-12 pt-8 border-t border-surface-200">
                <Link to="/" className="text-forest-600 hover:underline">← Back to home</Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
