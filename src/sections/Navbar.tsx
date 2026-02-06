import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Menu, X } from 'lucide-react';

interface NavbarProps {
  isPremium: boolean;
  onUpgradeClick: () => void;
}

export function Navbar({ isPremium, onUpgradeClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? 'bg-white/95 backdrop-blur-md shadow-lg py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a
            href="#"
            className="flex items-center gap-2 group"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <span className="text-white font-heading text-lg font-bold">ES</span>
            </div>
            <span className={`font-heading text-xl font-bold transition-colors duration-300 ${
              isScrolled ? 'text-brand-black' : 'text-brand-black'
            }`}>
              EatSpin
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection('app')}
              className={`text-sm font-medium transition-colors duration-200 hover:text-eatspin-orange ${
                isScrolled ? 'text-brand-black' : 'text-brand-black'
              }`}
            >
              Spin Now
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className={`text-sm font-medium transition-colors duration-200 hover:text-eatspin-orange ${
                isScrolled ? 'text-brand-black' : 'text-brand-black'
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className={`text-sm font-medium transition-colors duration-200 hover:text-eatspin-orange ${
                isScrolled ? 'text-brand-black' : 'text-brand-black'
              }`}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className={`text-sm font-medium transition-colors duration-200 hover:text-eatspin-orange ${
                isScrolled ? 'text-brand-black' : 'text-brand-black'
              }`}
            >
              Reviews
            </button>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!isPremium && (
              <Button
                onClick={onUpgradeClick}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-medium px-4 py-2 rounded-full shadow-lg"
              >
                <Crown size={16} className="mr-2" />
                Premium
              </Button>
            )}
            
            <Button
              onClick={() => scrollToSection('app')}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-medium px-5 py-2 rounded-full"
            >
              Start Spinning
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-eatspin-gray-3 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X size={24} className="text-brand-black" />
            ) : (
              <Menu size={24} className="text-brand-black" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t border-eatspin-gray-3 animate-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection('app')}
                className="text-left text-brand-black font-medium hover:text-eatspin-orange transition-colors"
              >
                Spin Now
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-left text-brand-black font-medium hover:text-eatspin-orange transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-left text-brand-black font-medium hover:text-eatspin-orange transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="text-left text-brand-black font-medium hover:text-eatspin-orange transition-colors"
              >
                Reviews
              </button>
              
              <div className="pt-4 border-t border-eatspin-gray-3 space-y-3">
                {!isPremium && (
                  <Button
                    onClick={() => {
                      onUpgradeClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium"
                  >
                    <Crown size={16} className="mr-2" />
                    Upgrade to Premium
                  </Button>
                )}
                
                <Button
                  onClick={() => scrollToSection('app')}
                  className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-medium"
                >
                  Start Spinning
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
