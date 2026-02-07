import type { Restaurant } from '@/types';
import { foodCategories } from '@/data/restaurants';

export interface ShareResultCardProps {
  restaurant: Restaurant;
  wheelImageUrl?: string;
}

const cardWidth = 1080;
const cardHeight = 1350;

export function ShareResultCard({ restaurant, wheelImageUrl }: ShareResultCardProps) {
  const now = new Date();
  const categories = restaurant.category
    .map((categoryId) => foodCategories.find((item) => item.id === categoryId))
    .filter((category) => Boolean(category));

  return (
    <article
      className="relative overflow-hidden"
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        background: 'linear-gradient(180deg, #FFF9F4 0%, #FFF3E8 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at top right, #F54703 0%, transparent 50%)' }} />
      <div className="relative z-10 flex h-full flex-col p-14 text-brand-black">
        <header className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-orange text-3xl text-white shadow-lg">🎰</div>
          <div>
            <p className="text-4xl font-bold text-brand-black">EatSpin</p>
            <p className="text-3xl font-semibold text-eatspin-orange">🎰 Today's Food Destiny!</p>
          </div>
        </header>

        <div className="my-8 h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(90deg, #F54703 0%, #FFC89E 100%)' }} />

        <section className="mb-7 rounded-3xl border border-[#FBD8C2] bg-white/90 p-5 shadow-lg">
          <div className="flex h-[470px] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#F9B386] bg-[#FFF9F4]">
            {wheelImageUrl ? (
              <img src={wheelImageUrl} alt="Frozen roulette wheel" className="h-full w-full object-contain" />
            ) : (
              <div className="text-center text-3xl font-semibold text-[#CF6D38]">
                <p>🎡 Wheel preview unavailable</p>
                <p className="mt-3 text-2xl font-normal">Spin in-app to capture your proof!</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border-[3px] border-eatspin-orange bg-white p-8 shadow-xl">
          <div className="mb-5 inline-flex items-center rounded-full bg-[#3AC66A] px-5 py-2 text-2xl font-semibold text-white shadow-sm">
            Winner!
          </div>

          <h1 className="text-6xl font-extrabold leading-tight text-brand-black">{restaurant.name}</h1>

          <p className="mt-5 text-3xl font-semibold text-[#475467]">
            ⭐ {restaurant.rating.toFixed(1)}/5 • 💰 {restaurant.priceRange}
            {restaurant.distance ? ` • 📍 ${restaurant.distance.toFixed(1)}km away` : ''}
          </p>

          {restaurant.address && <p className="mt-3 text-2xl text-[#667085]">📍 {restaurant.address}</p>}

          {categories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {categories.map((category) => (
                <span
                  key={category!.id}
                  className="rounded-full px-4 py-2 text-2xl font-medium text-white"
                  style={{ backgroundColor: category!.color }}
                >
                  {category!.icon} {category!.name}
                </span>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-auto text-center text-2xl font-medium text-[#7A5138]">
          {now.toLocaleDateString()} • {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 🔗 try it out at eatspin.netlify.com
        </footer>
      </div>
    </article>
  );
}
