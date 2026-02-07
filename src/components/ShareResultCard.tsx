import { useMemo } from 'react';

import type { Restaurant } from '@/types';
import { foodCategories } from '@/data/restaurants';

export interface ShareResultCardProps {
  restaurant: Restaurant;
}

const cardWidth = 1080;

function createWheelSvgDataUrl(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.18"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="260" cy="260" r="238" fill="#fff" />
        <path d="M260 260 L260 22 A238 238 0 0 1 466 141 Z" fill="#FF6B6B"/>
        <path d="M260 260 L466 141 A238 238 0 0 1 466 379 Z" fill="#FF9F43"/>
        <path d="M260 260 L466 379 A238 238 0 0 1 260 498 Z" fill="#F4C430"/>
        <path d="M260 260 L260 498 A238 238 0 0 1 54 379 Z" fill="#6BCB77"/>
        <path d="M260 260 L54 379 A238 238 0 0 1 54 141 Z" fill="#4D96FF"/>
        <path d="M260 260 L54 141 A238 238 0 0 1 260 22 Z" fill="#A45EE5"/>
        <path d="M260 260 L260 22 A238 238 0 0 1 466 141 Z" fill="#fff" fill-opacity="0.35"/>
        <circle cx="260" cy="260" r="58" fill="#fff"/>
        <text x="260" y="272" text-anchor="middle" font-size="28" font-weight="700" fill="#F54703" font-family="Arial, sans-serif">SPIN</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ShareResultCard({ restaurant }: ShareResultCardProps) {
  const now = new Date();
  const wheelImage = useMemo(() => createWheelSvgDataUrl(), []);

  const categories = restaurant.category
    .map((categoryId) => foodCategories.find((item) => item.id === categoryId))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .slice(0, 3);

  return (
    <article
      className="overflow-hidden rounded-[28px] border-4 border-[#F7C8AA] bg-[#FFF9F4]"
      style={{
        width: `${cardWidth}px`,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
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
            <img src={wheelImage} alt="Frozen wheel at winner position" className="h-[420px] w-[420px] object-contain" />
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
    </article>
  );
}
