/**
 * Shared food product data used by the vendor menu screens and the food cards.
 *
 * These are deliberately plain constants (no server imports) so the same list can
 * be rendered by a client dialog, a preview screen or a future student menu.
 */

export type FoodPhotoKind = 'photo' | 'illustration';

export type FoodPhotoPreset = {
  src: string;
  label: string;
  kind: FoodPhotoKind;
};

/**
 * Real dish photos supplied for the Kupon demo. Optimised to <= 1000px
 * progressive JPEGs in `public/food/photos` so a whole menu still loads on a
 * slow campus connection. Purely local files — no external image hosts.
 */
export const FOOD_PHOTOGRAPHY: FoodPhotoPreset[] = [
  { src: '/food/photos/pilau-nyama.jpg', label: 'Pilau nyama', kind: 'photo' },
  { src: '/food/photos/ndizi-nyama.jpg', label: 'Ndizi nyama', kind: 'photo' },
  { src: '/food/photos/grilled-chicken.jpg', label: 'Grilled chicken', kind: 'photo' },
  { src: '/food/photos/chicken-platter.jpg', label: 'Chicken platter', kind: 'photo' },
  { src: '/food/photos/burger.jpg', label: 'Burger', kind: 'photo' },
  { src: '/food/photos/spaghetti.jpg', label: 'Spaghetti', kind: 'photo' },
  { src: '/food/photos/garlic-bread.jpg', label: 'Garlic bread', kind: 'photo' },
];

/**
 * The Kupon food illustration set. Every file is a local SVG in `public/food`,
 * drawn on the same warm plate system, so illustrations and photos can sit next
 * to each other on the menu without looking out of place.
 */
export const FOOD_ILLUSTRATIONS: FoodPhotoPreset[] = [
  { src: '/food/ugali-nyama.svg', label: 'Ugali & nyama', kind: 'illustration' },
  { src: '/food/chips-mayai.svg', label: 'Chips mayai', kind: 'illustration' },
  { src: '/food/chipsi.svg', label: 'Chipsi', kind: 'illustration' },
  { src: '/food/pilau-beef.svg', label: 'Pilau beef', kind: 'illustration' },
  { src: '/food/pilau-kuku.svg', label: 'Pilau kuku', kind: 'illustration' },
  { src: '/food/wali-maharage.svg', label: 'Wali maharage', kind: 'illustration' },
  { src: '/food/wali-dagaa.svg', label: 'Wali dagaa', kind: 'illustration' },
  { src: '/food/chapati-mchicha.svg', label: 'Chapati & mchicha', kind: 'illustration' },
  { src: '/food/kuku-chipsi.svg', label: 'Kuku & chipsi', kind: 'illustration' },
  { src: '/food/mishkaki.svg', label: 'Mishkaki', kind: 'illustration' },
  { src: '/food/samaki.svg', label: 'Samaki', kind: 'illustration' },
  { src: '/food/ndizi-nyama.svg', label: 'Ndizi nyama', kind: 'illustration' },
  { src: '/food/mandazi.svg', label: 'Mandazi', kind: 'illustration' },
  { src: '/food/chai.svg', label: 'Chai', kind: 'illustration' },
  { src: '/food/soda.svg', label: 'Soda', kind: 'illustration' },
  { src: '/food/juice.svg', label: 'Juice', kind: 'illustration' },
];

/** Every photo preset the vendor can pick from, photos first. */
export const FOOD_PHOTOS: FoodPhotoPreset[] = [...FOOD_PHOTOGRAPHY, ...FOOD_ILLUSTRATIONS];

export const FOOD_CATEGORIES = [
  'Main',
  'Popular',
  'Light meal',
  'Snack',
  'Drink',
  'Special',
] as const;

/** Common campus prices — one tap instead of typing on a phone keypad. */
export const FOOD_QUICK_PRICES = [1000, 1500, 2000, 2500, 3000, 5000];

export const FOOD_PRICE_MIN = 500;
export const FOOD_PRICE_MAX = 100_000;
export const FOOD_NAME_MAX = 80;
export const FOOD_DESCRIPTION_MAX = 160;
export const FOOD_CATEGORY_MAX = 30;
export const FOOD_IMAGE_URL_MAX = 500;
export const FOOD_QUANTITY_MAX = 10;

/** Photo links must be a local `/food/...` path or a secure https URL. */
export function isValidFoodImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /^(https?:\/\/|\/)/i.test(trimmed);
}

/** Human label for the photo currently attached to a dish. */
export function foodPhotoLabel(imageUrl: string | null | undefined): string | null {
  const value = imageUrl?.trim();
  if (!value) return null;
  return FOOD_PHOTOS.find((photo) => photo.src === value)?.label ?? 'Custom photo';
}

export function isPresetFoodPhoto(imageUrl: string | null | undefined): boolean {
  const value = imageUrl?.trim();
  if (!value) return false;
  return FOOD_PHOTOS.some((photo) => photo.src === value);
}

