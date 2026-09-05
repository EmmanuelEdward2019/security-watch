import { Link } from 'react-router-dom';
import { AppStoreBadges } from './AppStoreBadges';
import { Mail, Phone } from 'lucide-react';

const footerLinks = {
  Services: [
    { to: '/services/investigations', label: 'Investigations' },
    { to: '/services/property', label: 'Property Verification' },
    { to: '/services/transparency', label: 'Institutional Transparency' },
    { to: '/fountain-source', label: 'Fountain Source Security' },
  ],
  Company: [
    { to: '/about', label: 'About Us' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/partners', label: 'Partners' },
    { to: '/contact', label: 'Contact' },
  ],
  Resources: [
    { to: '/property', label: 'Property Listings' },
    { to: '/media', label: 'Media & Reports' },
    { to: '/blog', label: 'Blog' },
    { to: '/faqs', label: 'FAQs' },
  ],
  Legal: [
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/terms', label: 'Terms of Service' },
    { to: '/disclaimer', label: 'Disclaimer' },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-surface-900 text-surface-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src="/assets/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
              <div>
                <span className="font-semibold text-white">The Security Watch</span>
                <p className="text-xs text-surface-500">...your concern</p>
              </div>
            </Link>
            <p className="text-sm text-surface-400 mb-4 max-w-xs">
              Justice, transparency, and verified property transactions. Trusted across Africa and beyond.
            </p>
            <div className="space-y-2 text-sm">
              <a href="mailto:hello@thesecuritywatch.com" className="flex items-center gap-2 hover:text-white">
                <Mail className="w-4 h-4" /> hello@thesecuritywatch.com
              </a>
              <a href="tel:+2348000000000" className="flex items-center gap-2 hover:text-white">
                <Phone className="w-4 h-4" /> +234 800 000 0000
              </a>
            </div>

            {/* Placeholders until the listings are live — see AppStoreBadges
                for why these are not the official store lockups. */}
            <AppStoreBadges className="mt-6" tone="dark" />
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-3">
                {links.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-sm hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-surface-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-surface-500">
            © {new Date().getFullYear()} The Security Watch. All rights reserved.
          </p>
          <p className="text-xs text-surface-600">
            We are not law enforcement. Users are responsible for their actions.
          </p>
        </div>
      </div>
    </footer>
  );
}
