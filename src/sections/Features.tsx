import { useEffect, useRef } from 'react';
import {
  Users,
  Radio,
  ShieldCheck,
  ListPlus,
  Share2,
  Compass,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Compass,
    title: 'Nearby Places',
    description: 'Find places around your location or a chosen area. Adjust the radius and food filters on Spin. Results depend on available place data.',
  },
  {
    icon: ListPlus,
    title: 'Your Own Lists',
    description: 'Add place names, organize multiple lists, and spin from your picks. Personal lists are saved in this browser; export a backup to keep a separate copy.',
  },
  {
    icon: Share2,
    title: 'Share a List',
    description: 'Choose a list to share as a fixed snapshot. Friends can save independent copies; later edits do not update the shared version. Links expire after seven days.',
  },
  {
    icon: Users,
    title: 'Shared Room List',
    description: 'Create a Group room or join with a code or link. Connected participants can see the room list. Group rooms require an internet connection.',
  },
  {
    icon: Radio,
    title: 'Synchronized Spin Result',
    description: 'The host or a co-host starts a room spin. Connected participants receive the same winner. Returning participants can see the latest result while the room is available.',
  },
  {
    icon: ShieldCheck,
    title: 'Host & Co-host Controls',
    description: 'The host can assign co-hosts. Hosts and co-hosts manage the room list and start spins.',
  },
];

export function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
      className="py-20 px-4 sm:px-6 lg:px-8 bg-arcade-yellow"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-black mb-4">
            What You Can Do
          </h2>
          <p className="text-eatspin-gray-1 max-w-lg mx-auto">
            Find nearby options, keep your own picks, or decide with a group.
          </p>
        </div>

        <div
          ref={gridRef}
          className="grid gap-6"
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl border-2 border-brand-ink shadow-pop p-6 transition-all duration-300 hover:shadow-pop-lg hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-arcade-yellow border-2 border-brand-ink rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <feature.icon size={24} className="text-brand-ink" />
              </div>

              <h3 className="font-heading text-lg font-bold text-brand-black mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-eatspin-gray-1 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
