import type { ImageSourcePropType } from 'react-native';

/**
 * Floors shown on the Floorplans page, swiped left/right in this order.
 *
 * To show a real plan, drop the file in assets/images/ and set
 * `image: require('@/assets/images/<file>.png')`.
 */
export interface Floor {
  id: string;
  name: string;
  image?: ImageSourcePropType;
}

export const FLOORS: Floor[] = [
  { id: 'ground', name: 'Ground floor' },
  { id: 'upstairs', name: 'Upstairs' },
];
