import { X, Crown, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

export function SubscriptionModal({ isOpen, onClose, onSubscribe }: SubscriptionModalProps) {
  if (!isOpen) return null;

  const features = [
    'Unlimited spins per meal time',
    'Access to premium restaurants',
    'Save favorite restaurants',
    'Advanced filtering options',
    'Priority customer support',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-eatspin-gray-3 transition-colors"
        >
          <X size={20} className="text-eatspin-gray-1" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-ring">
            <Crown size={40} className="text-white" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-brand-black mb-2">
            Go Premium
          </h2>
          <p className="text-eatspin-gray-1 text-sm">
            Unlock unlimited spins and discover more amazing food!
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-eatspin-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-eatspin-success" />
              </div>
              <span className="text-sm text-brand-black">{feature}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="bg-eatspin-linen rounded-2xl p-4 mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-eatspin-gray-1 text-lg">RM</span>
            <span className="font-heading text-4xl font-bold text-brand-orange">9.90</span>
            <span className="text-eatspin-gray-1 text-sm">/month</span>
          </div>
          <p className="text-center text-xs text-eatspin-gray-2 mt-1">
            Cancel anytime. No hidden fees.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onSubscribe}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-heading text-lg font-bold py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <Sparkles size={20} className="mr-2" />
            Subscribe Now
          </Button>
          
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-eatspin-gray-3 text-eatspin-gray-1 hover:bg-eatspin-gray-3"
          >
            Maybe Later
          </Button>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-eatspin-gray-2">
          <span className="flex items-center gap-1">
            <Check size={12} className="text-eatspin-success" />
            Secure Payment
          </span>
          <span className="flex items-center gap-1">
            <Check size={12} className="text-eatspin-success" />
            7-Day Free Trial
          </span>
        </div>
      </div>
    </div>
  );
}
