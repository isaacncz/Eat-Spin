import { useEffect, useRef } from 'react';
import { RefreshCw, MapPin, Utensils } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: RefreshCw,
    title: 'Spin the Wheel',
    description:
      'Select your food preferences and tap the spin button. Our magical wheel will start rotating with all eligible restaurants.',
    color: '#F54703',
  },
  {
    icon: MapPin,
    title: 'Get Matched',
    description:
      'We find restaurants within 1-2km that match your preferences and are currently open. No more "closed restaurant" disappointments!',
    color: '#E74C3C',
  },
  {
    icon: Utensils,
    title: 'Enjoy Your Meal',
    description:
      'The wheel picks your perfect match! Get restaurant details, directions, and enjoy your meal. It\'s that simple!',
    color: '#F39C12',
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate cards on scroll
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 100, opacity: 0, scale: 0.9 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.2,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 bg-eatspin-peach text-eatspin-orange text-sm font-medium rounded-full mb-4">
            Simple Process
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-4">
            How It Works
          </h2>
          <p className="text-eatspin-gray-1 max-w-lg mx-auto">
            Three simple steps to end your "what to eat" dilemma forever
          </p>
        </div>

        {/* Steps */}
        <div
          ref={cardsRef}
          className="grid md:grid-cols-3 gap-8"
        >
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group text-center"
            >
              {/* Card */}
              <div className="bg-eatspin-linen rounded-3xl p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-2 flex flex-col items-center">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center font-heading font-bold text-brand-orange">
                  {index + 1}
                </div>

                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${step.color}20` }}
                >
                  <step.icon size={32} style={{ color: step.color }} />
                </div>

                {/* Content */}
                <h3 className="font-heading text-xl font-bold text-brand-black mb-3 text-center">
                  {step.title}
                </h3>
                <p className="text-eatspin-gray-1 text-sm leading-relaxed text-center max-w-xs">
                  {step.description}
                </p>
              </div>

              {/* Connecting line (except for last card) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-eatspin-peach">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-eatspin-peach" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-eatspin-gray-1 mb-4">
            Ready to end your food decision fatigue?
          </p>
          <button
            onClick={() => {
              const appSection = document.getElementById('app');
              appSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-white font-heading font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Try It Now
            <span className="text-xl">🎯</span>
          </button>
        </div>
      </div>
    </section>
  );
}
