import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#' },
    { label: 'Download App', href: '#' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  support: [
    { label: 'Help Center', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Restaurant Partners', href: '#' },
  ],
};

const socialLinks = [
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
];

export function Footer() {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#') && href.length > 1) {
      const element = document.getElementById(href.substring(1));
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#181818] text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center">
                <span className="text-white font-heading text-lg font-bold">ES</span>
              </div>
              <span className="font-heading text-xl font-bold text-white">
                EatSpin
              </span>
            </div>

            <p className="text-eatspin-gray-2 text-sm leading-relaxed mb-6 max-w-sm">
              The fun way to decide what to eat! Discover amazing restaurants in Penang with our magical roulette wheel. No more "where to eat" arguments.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <a
                href="mailto:hello@eatspin.my"
                className="flex items-center gap-3 text-sm text-eatspin-gray-2 hover:text-white transition-colors"
              >
                <Mail size={16} className="text-eatspin-orange" />
                hello@eatspin.my
              </a>
              <a
                href="tel:+60123456789"
                className="flex items-center gap-3 text-sm text-eatspin-gray-2 hover:text-white transition-colors"
              >
                <Phone size={16} className="text-eatspin-orange" />
                +60 12-345 6789
              </a>
              <div className="flex items-center gap-3 text-sm text-eatspin-gray-2">
                <MapPin size={16} className="text-eatspin-orange" />
                Georgetown, Penang, Malaysia
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-heading font-bold text-white mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollToSection(link.href)}
                    className="text-sm text-eatspin-gray-2 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-heading font-bold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-eatspin-gray-2 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-heading font-bold text-white mb-4">Support</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-eatspin-gray-2 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-eatspin-gray-1/20 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-sm text-eatspin-gray-2">
              © {new Date().getFullYear()} EatSpin. All rights reserved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-eatspin-gray-1/20 flex items-center justify-center hover:bg-eatspin-orange transition-colors"
                >
                  <social.icon size={18} className="text-white" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
