import type { Lang } from '@/i18n/ui';

/** The text-only block that opens the About page. See TextBlock.astro. */
export interface AboutIntro {
  heading: string;
  // Stays in English in both locales, on purpose.
  tagline: string;
  paragraphs: string[];
}

/**
 * One ImageText section. Only the copy lives here — the art (image, colour,
 * reverse, imageSize) stays in the page, since it doesn't vary by locale.
 */
export interface AboutSection {
  title: string;
  paragraphs: string[];
  // Optional — only "who we work with" renders a list. Paragraphs come first,
  // the list after.
  bullets?: string[];
}

/** One column of the About page's two-up team section. See Profiles.astro. */
export interface Profile {
  name: string;
  tagline: string;
  paragraphs: string[];
  image: string;
  // Locale-specific, so it lives here with the rest of the copy.
  imageAlt: string;
}

export const aboutIntro: Record<Lang, AboutIntro> = {
  en: {
    heading: 'creativity + tech = candura',
    tagline: 'Ideas, made real.',
    paragraphs: [
      'Candura is a Creative Tech studio where strategy, creativity, and execution work in sync to transform ideas into systems, brands, and meaningful experiences.',
      'We partner with ambitious projects from strategy to launch, shaping every stage with intention, structure, and thoughtful execution. From brand development and creative direction to digital design, content production, and web experiences, every decision serves a clear vision.',
      "We believe technology expands the creative process. That's why we build processes where ideas don't stay on paper—they're designed, built, and brought to life.",
      "Candura was born from a simple belief: good taste alone isn't enough. Lasting ideas require structure, strategy, and the right people to make them real.",
    ],
  },
  es: {
    heading: 'creatividad + tech = candura',
    tagline: 'Ideas, made real.',
    paragraphs: [
      'Candura es un estudio de Creative Tech donde la estrategia, la creatividad y la ejecución trabajan en sincronía para convertir ideas en sistemas, marcas y experiencias reales.',
      'Acompañamos proyectos desde la estrategia hasta el lanzamiento, construyendo cada etapa con intención, estructura y criterio. Desde el desarrollo de marca y la dirección creativa hasta el diseño digital, la producción de contenido y las experiencias web, cada decisión responde a una visión clara.',
      'Creemos que la tecnología expande los procesos creativos. Por eso desarrollamos procesos donde las ideas no se quedan en el papel: se diseñan, se construyen y se hacen existir.',
      'Candura nace de una convicción sencilla: el buen gusto, por sí solo, no es suficiente. Las ideas que perduran necesitan estructura, estrategia y las personas adecuadas para convertirlas en realidad.',
    ],
  },
};

export const aboutSections: Record<Lang, AboutSection[]> = {
  en: [
    {
      title: 'what we do',
      paragraphs: [
        'We practice digital craftsmanship.',
        'In an industry moving faster than ever, where everything risks looking the same, we champion thoughtful processes, strategic thinking, and exceptional execution. We believe the difference lies in intention, precision, and the care behind every decision.',
        'We build brands that feel consistent across every touchpoint. From strategy and storytelling to visual identity, creative direction, content, web experiences, and digital presence, every element speaks the same language and reflects the essence of the project.',
        "We hold ourselves to the highest standards because trust is built through quality. That's why many of our clients continue growing with us long after the first project.",
      ],
    },
    {
      title: 'who we work with',
      paragraphs: ['We work with people and projects that believe great ideas deserve great execution.'],
      bullets: [
        'Creatives, makers, and visionaries with strong ideas who need the right structure, strategy, and team to bring them to life.',
        'Founders, entrepreneurs, and businesses that value thoughtful design and are looking for a creative-technology partner to help them grow.',
        'Personal brands, artists, and creative projects seeking to define or strengthen their identity, voice, and presence across a multidimensional digital ecosystem.',
        "Projects that feel stuck and need a fresh perspective, renewed momentum, and a clear direction for what's next.",
        'People and brands who value originality, choosing tailored solutions over templates and one-size-fits-all approaches.',
      ],
    },
  ],
  es: [
    {
      title: 'qué hacemos',
      paragraphs: [
        'Practicamos la artesanía digital.',
        'En una industria donde todo sucede cada vez más rápido y las soluciones tienden a verse iguales, apostamos por procesos cuidadosos, pensamiento estratégico y ejecución de alto nivel. Creemos en el valor del criterio, el detalle y la intención detrás de cada decisión.',
        'Construimos marcas coherentes en todos sus puntos de contacto. Desde la conceptualización y la narrativa hasta la identidad visual, la dirección creativa, el contenido, la experiencia web y la presencia digital, todo comunica el mismo lenguaje y responde a la esencia del proyecto.',
        'Trabajamos con los más altos estándares de calidad porque entendemos que la confianza se construye en los detalles. Nuestro mayor indicador de éxito es que quienes trabajan con nosotros vuelven a elegirnos.',
      ],
    },
    {
      title: 'con quiénes trabajamos',
      paragraphs: [
        'Trabajamos con personas y proyectos que entienden que las mejores ideas merecen una buena ejecución.',
      ],
      bullets: [
        'Creativos, creadores y visionarios con ideas potentes que necesitan estructura, estrategia y el equipo adecuado para convertirlas en realidad.',
        'Emprendedores y empresas que valoran el buen diseño, el pensamiento estratégico y buscan un aliado creativo-tecnológico para impulsar su crecimiento.',
        'Marcas personales, artistas y proyectos creativos que quieren descubrir, definir o fortalecer su identidad, su voz y la forma en que se expresan en un ecosistema digital 360°.',
        'Proyectos que se sienten estancados y necesitan una nueva perspectiva, movimiento y una dirección clara para evolucionar.',
        'Personas y marcas que buscan originalidad, valoran los procesos hechos a medida y prefieren soluciones únicas sobre plantillas o fórmulas genéricas.',
      ],
    },
  ],
};

export const aboutProfiles: Record<Lang, Profile[]> = {
  en: [
    {
      name: 'Isabel',
      tagline: 'idea downloader',
      paragraphs: [
        'With over six years of experience leading projects from strategy to execution, Isabel transforms concepts into thoughtful, lasting realities. She is passionate about uncovering the unique DNA of people, brands, and businesses, shaping identities through strategic, visual, and communication-driven direction.',
        'Naturally curious, she is deeply immersed in the digital ecosystem, constantly exploring trends, cultural shifts, and new ways to connect. Content creation, strategic thinking, and helping ideas grow are at the core of her work.',
      ],
      image: '/isabel.jpg',
      imageAlt: 'Isabel',
    },
    {
      name: 'Laura',
      tagline: 'creative technologist',
      paragraphs: [
        "Laura is a multidisciplinary creator whose practice sits at the intersection of art and technology. Holding a Master's degree in Digital Humanities, she combines research, design, programming, and conceptual thinking to shape complex ideas into meaningful experiences. Her work spans data, interaction design, interfaces, and code as a creative medium.",
        'After two years in a research lab, she brings the rigor of academic research into an open, exploratory creative practice. Interested in human-computer interaction, she approaches the digital ecosystem as a living space for research, experimentation, and creation.',
      ],
      image: '/laura.jpg',
      imageAlt: 'Laura',
    },
  ],
  es: [
    {
      name: 'Isabel',
      tagline: 'idea downloader',
      paragraphs: [
        'Con más de seis años de experiencia desarrollando proyectos desde la estrategia hasta la ejecución, Isabel transforma conceptos en realidades sólidas y con intención. Le apasiona descubrir y potenciar el ADN de personas, marcas y proyectos, construyendo identidades con una dirección estratégica, estética y comunicativa auténtica.',
        'Curiosa por naturaleza, vive inmersa en el ecosistema digital, explorando tendencias, narrativas y nuevas formas de conectar. La creación de contenido, el pensamiento estratégico y la expansión de ideas son el hilo conductor de su trabajo.',
      ],
      image: '/isabel.jpg',
      imageAlt: 'Isabel',
    },
    {
      name: 'Laura',
      tagline: 'cretive technologist',
      paragraphs: [
        'Laura es una creadora multidisciplinaria cuya práctica se desarrolla en la intersección entre el arte y la tecnología. Como magíster en Humanidades Digitales, integra investigación, diseño, programación y pensamiento conceptual para dar forma a ideas complejas. Su trabajo transita entre los datos, el diseño de interacción, las interfaces y el código como material creativo.',
        'Tras dos años de experiencia en un laboratorio de investigación, incorpora el rigor del research a una práctica artística y de diseño abierta a la exploración y la experimentación. Interesada en la interacción humano-computador, entiende el ecosistema digital como un espacio vivo para investigar, crear y cuestionar.',
      ],
      image: '/laura.jpg',
      imageAlt: 'Laura',
    },
  ],
};
