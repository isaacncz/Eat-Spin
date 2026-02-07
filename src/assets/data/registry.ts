import type { JsonRestaurant, UserLocation } from '@/types';

export type AreaRegion = 'island' | 'mainland';

export const AREA_REGISTRY = {
  island: [
    'georgetown',
    'pulau-tikus',
    'tanjung-bungah',
    'air-itam',
    'gelugor',
    'bayan-lepas',
    'balik-pulau',
  ],
  mainland: [
    'butterworth',
    'seberang-jaya',
    'bukit-mertajam',
    'juru',
    'batu-kawan',
    'nibong-tebal',
  ],
} as const;

export type AreaName = (typeof AREA_REGISTRY)[AreaRegion][number];

const loaders = import.meta.glob<JsonRestaurant[]>('./{island,mainland}/*.json', { import: 'default' });

export const PENANG_DIVIDER_LONGITUDE = 100.37;

export const getRegionFromLongitude = (lng: number): AreaRegion => (
  lng < PENANG_DIVIDER_LONGITUDE ? 'island' : 'mainland'
);

export const getNearbyRegions = (location: Pick<UserLocation, 'lng'>): AreaRegion[] => {
  const primary = getRegionFromLongitude(location.lng);
  if (Math.abs(location.lng - PENANG_DIVIDER_LONGITUDE) <= 0.02) {
    return ['island', 'mainland'];
  }

  return [primary];
};

const loadAreaData = async (region: AreaRegion, area: AreaName): Promise<JsonRestaurant[]> => {
  const filePath = `./${region}/${area}.json`;
  const importer = loaders[filePath];
  if (!importer) return [];
  return importer();
};

export const loadRestaurantsForRegions = async (regions: AreaRegion[]): Promise<JsonRestaurant[]> => {
  const uniqueRegions = [...new Set(regions)];
  const areaLoads = uniqueRegions.flatMap((region) =>
    AREA_REGISTRY[region].map((area) => loadAreaData(region, area))
  );

  const dataByArea = await Promise.all(areaLoads);
  return dataByArea.flat();
};
