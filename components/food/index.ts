/**
 * Kupon food product system.
 *
 * Shared by the vendor menu screens today and ready for the student menu:
 * `FoodProductCard` (student / vendor / compact), the vendor photo uploader and
 * the live preview panel used by the add/edit dish dialog.
 */
export {
  FoodProductCard,
  FoodPrice,
  type FoodProduct,
  type FoodProductCardProps,
  type FoodProductCardVariant,
} from './food-product-card';
export { FoodImage } from './food-image';
export { FoodPhotoPicker } from './food-photo-picker';
export { FoodPreviewPanel } from './food-preview-panel';
export {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_MAX,
  FOOD_DESCRIPTION_MAX,
  FOOD_ILLUSTRATIONS,
  FOOD_IMAGE_URL_MAX,
  FOOD_NAME_MAX,
  FOOD_PHOTOGRAPHY,
  FOOD_PHOTOS,
  FOOD_PRICE_MAX,
  FOOD_PRICE_MIN,
  FOOD_QUANTITY_MAX,
  FOOD_QUICK_PRICES,
  foodPhotoLabel,
  isPresetFoodPhoto,
  isValidFoodImageUrl,
  type FoodPhotoKind,
  type FoodPhotoPreset,
} from './food-data';
