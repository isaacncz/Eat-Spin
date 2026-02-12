import { useEffect, useRef } from 'react';
import {
  Heart,
  Compass,
  Scale,
  Zap,
  User,
  PartyPopper,
  Shield,
  Clock,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Heart,
    title: 'No More Arguments',
    description: 'End the endless "where should we eat" debates. Let the wheel decide fairly!',
  },
  {
    icon: Compass,
    title: 'Discover Hidden Gems',
    description: 'Find amazing local restaurants you never knew existed within walking distance.',
  },
  {
    icon: Scale,
    title: 'Fair & Random',
    description: 'Every spin is completely random. No bias, no favoritism - just pure chance!',
  },
  {
    icon: Zap,
    title: 'Quick & Easy',
    description: 'Get a restaurant recommendation in seconds. No more scrolling through reviews.',
  },
  {
    icon: User,
    title: 'Personalized',
    description: 'Choose your preferred food categories and we\'ll only show relevant options.',
  },
  {
    icon: PartyPopper,
    title: 'Fun & Exciting',
    description: 'The anticipation of the spin makes choosing food fun again!',
  },
  {
    icon: Shield,
    title: 'Only Open Restaurants',
    description: 'We automatically filter out closed restaurants. No more disappointments!',
  },
  {
    icon: Clock,
    title: 'Meal Time Aware',
    description: 'Get breakfast spots in the morning, dinner places in the evening.',
  },
];

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate grid items with stagger
      const items = gridRef.current?.children;
      if (items) {
        gsap.fromTo(
          items,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: gridRef.current,
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
      id="features"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-eatspin-linen"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-black mb-4">
            Why Choose EatSpin?
          </h2>
          <p className="text-eatspin-gray-1 max-w-lg mx-auto">
            We're not just another food app. Here's what makes us special:
          </p>
        </div>

        {/* Features Grid */}
        <div
          ref={gridRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-eatspin-peach rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <feature.icon size={24} className="text-eatspin-orange" />
              </div>

              {/* Content */}
              <h3 className="font-heading text-lg font-bold text-brand-black mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-eatspin-gray-1 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '10,000+', label: 'Happy Users' },
            { value: '500+', label: 'Restaurants' },
            { value: '98%', label: 'Satisfaction' },
            { value: '24/7', label: 'Available' },
          ].map((stat, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white rounded-2xl"
            >
              <p className="font-heading text-3xl font-bold text-brand-orange mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-eatspin-gray-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
