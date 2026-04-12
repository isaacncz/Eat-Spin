/**
 * Constructs deep links and web fallback URLs for food ordering platforms.
 * These links open the platform's search with the restaurant's name pre-filled,
 * since we don't have exact restaurant IDs on these platforms.
 */

export interface OrderingLink {
  platform: 'grabfood' | 'foodpanda';
  label: string;
  emoji: string;
  url: string;
}

/**
 * Build ordering platform links for a restaurant.
 * Uses web search URLs (most reliable across devices).
 */
export function getOrderingLinks(restaurantName: string, coordinates?: { lat: number; lng: number }): OrderingLink[] {
  const encodedName = encodeURIComponent(restaurantName);

  const links: OrderingLink[] = [
    {
      platform: 'grabfood',
      label: 'GrabFood',
      emoji: '🟢',
      url: `https://food.grab.com/search?q=${encodedName}`,
    },
    {
      platform: 'foodpanda',
      label: 'foodpanda',
      emoji: '🩷',
      url: `https://www.foodpanda.com/search?q=${encodedName}`,
    },
  ];

  return links;
}
