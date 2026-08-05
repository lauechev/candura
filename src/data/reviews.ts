import type { Lang } from '@/i18n/ui';

export interface Review {
  // Empty string renders a blank receipt — the placeholder state.
  quote: string;
  // Rendered two lines below the quote; Review.astro adds the leading dash.
  author: string;
}

/**
 * Four per locale, same order in both. The Spanish entries are the originals as
 * the clients wrote them; the English ones are translations of those. The last
 * two are placeholders until more come in — fill the strings and the row
 * renders them with no other changes needed.
 */
export const reviews: Record<Lang, Review[]> = {
  en: [
    {
      quote:
        'They knew how to capture everything I wanted. They understood my language, the concept and the vibe of my brand. They managed to land all the information that was loose and disorganized, perfectly!! I loved doing all of this with you',
      author: 'laura, orbita',
    },
    {
      quote:
        'I really liked that they took the time to understand my brand, my goals and my values, and that they used design strategically and practically to help me reach them.',
      author: 'sebastian, second order',
    },
    { quote: '', author: '' },
    { quote: '', author: '' },
  ],
  es: [
    {
      quote:
        'Supieron plasmar todo lo que yo quería. Entendieron mi lenguaje, el concepto y la vibra de mi marca. Pudieron aterrizar la información que estaba suelta y sin orden perfectamente!! Me encantó hacer todo con ustedes',
      author: 'laura, orbita',
    },
    {
      quote:
        'Me gustó mucho que se tomaran el tiempo de entender mi marca, mis objetivos y mis valores, y que utilizaran el diseño de forma estratégica y práctica para ayudarme a alcanzarlos.',
      author: 'sebastian, second order',
    },
    { quote: '', author: '' },
    { quote: '', author: '' },
  ],
};
