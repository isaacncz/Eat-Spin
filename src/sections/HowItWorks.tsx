import { useEffect, useRef } from 'react';
import { Users, RefreshCw, Utensils } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    icon: Users,
    title: 'Create or Join a Group Room',
    description:
      'Start with Group Spin: everyone joins one room, builds one shared restaurant list, and the host/co-host keeps the session moving.',
    color: '#F54703',
  },
  {
    icon: RefreshCw,
    title: 'Spin Once, Sync for Everyone',
    description:
      'When the host or co-host spins, everyone sees the same synchronized winner instantly across devices and browsers.',
    color: '#E74C3C',
  },
  {
    icon: Utensils,
    title: 'Head Out Together',
    description:
      'Celebrate the final pick, open the restaurant details, and go eat with confidence—no more back-and-forth debates.',
    color: '#F39C12',
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-4">
            How It Works
          </h2>
          <p className="text-eatspin-gray-1 max-w-lg mx-auto">
            Three simple steps to decide together and end your "what to eat" dilemma
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid md:grid-cols-3 gap-8"
        >
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group text-center"
            >
              <div className="bg-eatspin-linen rounded-3xl p-8 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-2 flex flex-col items-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center font-heading font-bold text-brand-orange">
                  {index + 1}
                </div>

                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${step.color}20` }}
                >
                  <step.icon size={32} style={{ color: step.color }} />
                </div>

                <h3 className="font-heading text-xl font-bold text-brand-black mb-3 text-center">
                  {step.title}
                </h3>
                <p className="text-eatspin-gray-1 text-sm leading-relaxed text-center max-w-xs">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-eatspin-peach">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-eatspin-peach" />
                </div>
              )}
            </div>
          ))}
        </div>

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
