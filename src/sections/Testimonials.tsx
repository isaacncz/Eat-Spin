import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    id: 1,
    name: 'Azura Hamid',
    role: 'Food Blogger',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    rating: 5,
    text: 'EatSpin has completely changed how my family decides on dinner! No more 30-minute debates about where to eat. We just spin and go!',
  },
  {
    id: 2,
    name: 'Raj Kumar',
    role: 'Software Engineer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    rating: 5,
    text: 'As someone who spends way too much time deciding what to eat, this app is a lifesaver. Found so many great spots I never knew existed!',
  },
  {
    id: 3,
    name: 'Mei Ling Tan',
    role: 'Marketing Manager',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    rating: 5,
    text: 'The fact that it only shows open restaurants is genius. I\'ve lost count of how many times I\'ve been disappointed by Google Maps showing closed places.',
  },
  {
    id: 4,
    name: 'Ahmad Hassan',
    role: 'Restaurant Owner',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    rating: 5,
    text: 'Since being listed on EatSpin, we\'ve seen a 40% increase in walk-in customers! It\'s amazing how the app helps small businesses like mine.',
  },
];

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const nextTestimonial = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(nextTestimonial, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
    >
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-3">
            What Our Users Say
          </h2>
          <p className="text-lg text-eatspin-gray-1 max-w-lg mx-auto leading-relaxed">
            Don't just take our word for it — hear from our happy food explorers
          </p>
        </div>

        {/* Testimonial Card */}
        <div
          ref={cardRef}
          className="relative bg-eatspin-linen rounded-3xl p-8 md:p-12"
        >
          {/* Quote Icon */}
          <div className="absolute top-6 left-6 opacity-20">
            <Quote size={60} className="text-eatspin-orange" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Stars */}
            <div className="flex items-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={20}
                  className={
                    i < currentTestimonial.rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-eatspin-gray-3'
                  }
                />
              ))}
            </div>

            {/* Testimonial Text */}
            <p className="text-lg md:text-xl text-brand-black leading-relaxed mb-8 min-h-[80px]">
              "{currentTestimonial.text}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-4">
              <img
                src={currentTestimonial.avatar}
                alt={currentTestimonial.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-eatspin-orange"
              />
              <div>
                <p className="font-heading font-bold text-brand-black">
                  {currentTestimonial.name}
                </p>
                <p className="text-sm text-eatspin-gray-1">
                  {currentTestimonial.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-eatspin-peach">
            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-eatspin-orange w-8'
                      : 'bg-eatspin-gray-3 hover:bg-eatspin-gray-2'
                  }`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevTestimonial}
                disabled={isAnimating}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-eatspin-peach transition-colors disabled:opacity-50"
              >
                <ChevronLeft size={20} className="text-brand-black" />
              </button>
              <button
                onClick={nextTestimonial}
                disabled={isAnimating}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-eatspin-peach transition-colors disabled:opacity-50"
              >
                <ChevronRight size={20} className="text-brand-black" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
