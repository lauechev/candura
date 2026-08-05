export const languages = {
  en: 'en',
  es: 'es',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

// Routes that have a translated version for every locale. The language toggle
// only renders on these — anything else would link to a page that doesn't
// exist yet. Add a path here once you author its `/es/` counterpart.
export const translatedRoutes = ['/', '/about', '/services', '/work'];

export const ui = {
  en: {
    'site.title': 'Candura',
    'home.tagline': 'a creative technology studio & consultancy',
    'nav.about': 'about',
    'nav.services': 'services',
    'nav.work': 'work',
    'nav.contact': 'contact',
    'pinata.alt': 'A brightly colored star-shaped piñata',
    'lang.switch': 'Cambiar a español',
  },
  es: {
    'site.title': 'Candura',
    'home.tagline': 'Un estudio y consultoría de tecnología creativa',
    'nav.about': 'nosotros',
    'nav.services': 'servicios',
    'nav.work': 'proyectos',
    'nav.contact': 'contacto',
    'pinata.alt': 'Una piñata de estrella de colores brillantes',
    'lang.switch': 'Switch to English',
  },
} as const;

export type UIKey = keyof (typeof ui)[typeof defaultLang];

/** Reads the locale off a pathname, e.g. `/es/about` → `es`. Falls back to English. */
export function getLangFromUrl(url: URL): Lang {
  const [, segment] = url.pathname.split('/');
  if (segment in languages) return segment as Lang;
  return defaultLang;
}

/** Returns a `t(key)` lookup for a locale, falling back to English for missing keys. */
export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/** Strips any locale prefix from a pathname, leaving the canonical route. */
export function stripLang(pathname: string): string {
  const [, segment, ...rest] = pathname.split('/');
  if (segment in languages) return '/' + rest.join('/');
  return pathname;
}

/** Builds the URL for a route in a given locale. English stays unprefixed. */
export function localizePath(pathname: string, lang: Lang): string {
  const base = stripLang(pathname).replace(/\/$/, '') || '/';
  if (lang === defaultLang) return base;
  return base === '/' ? '/es/' : `/es${base}`;
}

/** Whether the given route has been translated into every locale. */
export function hasTranslation(pathname: string): boolean {
  const base = stripLang(pathname).replace(/\/$/, '') || '/';
  return translatedRoutes.includes(base);
}
