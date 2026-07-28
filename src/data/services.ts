import type { Lang } from '@/i18n/ui';

export interface ServiceCategory {
  // Lowercase, no parens — Service.astro wraps it as "(title)" like Nav does.
  title: string;
  items: string[];
}

export const serviceCategories: Record<Lang, ServiceCategory[]> = {
  en: [
    {
      title: 'research',
      items: [
        'market and trend research',
        'niche trend forecasting',
        'user and audience research',
        'cultural research',
        'brand research and diagnostic',
        'social media diagnostic',
        'web and e-commerce diagnostic',
        'business model consultancy',
      ],
    },
    {
      title: 'strategy',
      items: [
        'brand concept development',
        'brand communication',
        'naming',
        'pricing strategy',
        'digital strategy',
        'new product development',
        'experience development',
        'loyalty strategy',
        'hospitality strategy',
        'artist collab strategy',
        'influencer marketing strategy',
        'creative direction',
      ],
    },
    {
      title: 'design',
      items: [
        'branding',
        'rebranding',
        'mobile app design',
        'website design',
        'e-commerce design',
        'design systems',
        'digital design',
        'information design',
        'editorial design',
        'packaging design',
      ],
    },
    {
      title: 'coding',
      items: [
        'shopify theme development',
        'tailor-made website development',
        'landing page development',
        'interactive data visualization',
      ],
    },
  ],
  es: [
    {
      title: 'investigación',
      items: [
        'investigación de mercado y tendencias',
        'pronóstico de tendencias de nicho',
        'investigación de usuarios y audiencias',
        'investigación cultural',
        'investigación y diagnóstico de marca',
        'diagnóstico de redes sociales',
        'diagnóstico de sitio web y e-commerce',
        'consultoría de modelo de negocio',
      ],
    },
    {
      title: 'estrategia',
      items: [
        'desarrollo de concepto de marca',
        'comunicación de marca',
        'naming',
        'estrategia de precios',
        'estrategia digital',
        'desarrollo de nuevos productos',
        'desarrollo de experiencias',
        'estrategia de fidelización',
        'estrategia de hospitalidad',
        'estrategia de colaboraciones con artistas',
        'estrategia de marketing de influencers',
        'dirección creativa',
      ],
    },
    {
      title: 'diseño',
      items: [
        'branding',
        'rebranding',
        'diseño de apps móviles',
        'diseño de sitios web',
        'diseño de e-commerce',
        'sistemas de diseño',
        'diseño digital',
        'diseño de información',
        'diseño editorial',
        'diseño de packaging',
      ],
    },
    {
      title: 'código',
      items: [
        'desarrollo de temas de shopify',
        'desarrollo de sitios web a la medida',
        'desarrollo de landing pages',
        'visualización de datos interactiva',
      ],
    },
  ],
};

/**
 * Programs bundle services that complement each other. The item lists are
 * still to be written — fill the empty arrays below and the page renders
 * them with no other changes needed.
 */
export const programCategories: Record<Lang, ServiceCategory[]> = {
  en: [
    {
      title: 'brand creation',
      items: [], // ← items go here
    },
    {
      title: 'brand refresh',
      items: [], // ← items go here
    },
    {
      title: 'brand expansion & innovation',
      items: [], // ← items go here
    },
  ],
  es: [
    {
      title: 'creación de marca',
      items: [], // ← los items van aquí
    },
    {
      title: 'renovación de marca',
      items: [], // ← los items van aquí
    },
    {
      title: 'expansión e innovación de marca',
      items: [], // ← los items van aquí
    },
  ],
};
