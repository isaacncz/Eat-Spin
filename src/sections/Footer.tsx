import { BrandMark } from '@/components/BrandMark';

const footerLinks = {
  product: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'What You Can Do', href: '#features' },
  ],
};

export function Footer() {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#') && href.length > 1) {
      const element = document.getElementById(href.substring(1));
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-brand-ink border-t-4 border-brand-black text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex size-11 items-center justify-center rounded-xl border-2 border-white bg-arcade-yellow">
                <BrandMark className="size-10" />
              </div>
              <span className="font-heading text-xl font-bold text-white">
                EatSpin
              </span>
            </div>

            <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-sm">
              A wheel to help choose your next meal, with nearby options, personal lists and shared Group rooms.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-heading font-bold text-white mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollToSection(link.href)}
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t-2 border-white/20 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-sm text-white/80">
              © {new Date().getFullYear()} EatSpin. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
