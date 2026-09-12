import type { ImageSourcePropType } from 'react-native';

/**
 * 感情クエストの背景。
 *
 * One photograph per stage, in the order the water moves: 雨 → 川 → 海 → 雲.
 * The pictures are not decoration bolted on afterwards — each stage asks the
 * person to do the thing its photograph is doing, and seeing rain while
 * writing what is hard is most of what makes the metaphor land.
 *
 * They live beside the stage data rather than inside it because FLOW_STEPS is
 * generated from the preview HTML and must not be hand-edited.
 */
export const FLOW_BACKDROPS: Record<string, ImageSourcePropType> = {
  rain: require('../../assets/flow/rain.jpg'),
  river: require('../../assets/flow/river.jpg'),
  ocean: require('../../assets/flow/ocean.jpg'),
  cloud: require('../../assets/flow/cloud.jpg'),
};

/**
 * How far the photograph is dimmed.
 *
 * Enough that every word on top of it stays readable at a glance, and no
 * further. These are the four moments the product is quietest in; a picture
 * turned down until it is a grey rectangle would have been better left out.
 */
export const FLOW_VEIL = 'rgba(28, 22, 12, 0.52)';
