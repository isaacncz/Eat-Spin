import type { Restaurant } from '@/types';
import { foodCategories } from '@/data/restaurants';

export interface ShareResultCardProps {
  restaurant: Restaurant;
  wheelImageUrl?: string;
}

const cardWidth = 1080;
const wedgeColors = ['#FF6B6B', '#FF9F43', '#F4C430', '#6BCB77', '#4D96FF', '#A45EE5'];

function getWedgePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const startRadians = (Math.PI / 180) * startAngle;
  const endRadians = (Math.PI / 180) * endAngle;
  const x1 = cx + radius * Math.cos(startRadians);
  const y1 = cy + radius * Math.sin(startRadians);
  const x2 = cx + radius * Math.cos(endRadians);
  const y2 = cy + radius * Math.sin(endRadians);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

export function ShareResultCard({ restaurant }: ShareResultCardProps) {
  const now = new Date();
  const categories = restaurant.category
    .map((categoryId) => foodCategories.find((item) => item.id === categoryId))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .slice(0, 3);

  return (
    <article
      className="relative overflow-hidden rounded-[28px] border-4 border-[#F7C8AA] bg-[#FFF9F4]"
      style={{
        width: `${cardWidth}px`,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="flex flex-col">
        <header className="border-b-2 border-[#F8D9C3] px-14 py-10">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-orange text-3xl text-white shadow-sm">🍽️</div>
            <p className="text-5xl font-extrabold text-brand-black">EatSpin</p>
          </div>
          <p className="mt-2 pl-[84px] text-4xl font-semibold text-eatspin-orange">🎰 Today's Food Destiny!</p>
        </header>

        <main className="px-14 py-10">
          <div className="rounded-3xl border-2 border-[#F4B892] bg-white p-6 shadow-sm">
            <div className="relative flex h-[520px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#F8C9A9] bg-[#FFF9F4]">
              <div className="absolute left-1/2 top-2 z-10 h-0 w-0 -translate-x-1/2 border-l-[24px] border-r-[24px] border-t-[34px] border-l-transparent border-r-transparent border-t-eatspin-orange" />

              <svg viewBox="0 0 420 420" className="h-[400px] w-[400px] drop-shadow-lg" role="img" aria-label="Frozen wheel at winner position">
                {wedgeColors.map((color, index) => {
                  const angleStep = 360 / wedgeColors.length;
                  const start = -90 + index * angleStep;
                  const end = start + angleStep;
                  return <path key={color} d={getWedgePath(210, 210, 188, start, end)} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />;
                })}
                <path d={getWedgePath(210, 210, 188, -32, 28)} fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth="4" />
                <circle cx="210" cy="210" r="44" fill="white" />
                <text x="210" y="217" textAnchor="middle" fontSize="24" fontWeight="700" fill="#F54703">SPIN</text>
              </svg>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border-2 border-[#F4B892] bg-white px-8 py-7 shadow-sm">
            <h1 className="text-6xl font-extrabold uppercase tracking-tight text-brand-black">✨ {restaurant.name}</h1>
            <p className="mt-4 text-[34px] font-semibold text-[#344054]">
              ⭐ {restaurant.rating.toFixed(1)}/5 • {restaurant.priceRange}
              {restaurant.distance ? ` • 📍 ${restaurant.distance.toFixed(1)} km away` : ''}
            </p>
            {restaurant.address && <p className="mt-3 text-3xl text-[#475467]">📍 {restaurant.address}</p>}

            {categories.length > 0 && (
              <>
                <div className="mt-5 flex flex-wrap gap-4 text-5xl">
                  {categories.map((category) => (
                    <span key={`icon-${category.id}`}>{category.icon}</span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {categories.map((category) => (
                    <span
                      key={category.id}
                      className="rounded-full border border-[#F2C2A3] bg-[#FFF5EE] px-5 py-2 text-2xl font-medium text-[#8A4A28]"
                    >
                      [{category.name}]
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>

        <footer className="border-t-2 border-[#F8D9C3] bg-[#FFF2E7] px-14 py-7 text-[29px] text-[#7A5138]">
          <p>📅 {now.toLocaleDateString()} • 🕐 {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="mt-2">🔗 try it out at eatspin.netlify.com</p>
        </footer>
      </div>
    </article>
  );
}
