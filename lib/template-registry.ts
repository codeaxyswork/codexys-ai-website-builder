/**
 * Centralized Template Registry
 *
 * Single source of truth for all 20 curated Codeaxys templates.
 * Safe for server components, route handlers, client components, and test suites.
 */

export interface TemplateItem {
  id: string;
  folderName: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
}

export const TEMPLATES_DATA: TemplateItem[] = [
  {
    id: "accounting-firm",
    folderName: "Accounting Firm",
    name: "Accounting Firm",
    category: "Finance & Advisory",
    description: "Apex Partners — Corporate accounting, tax planning, and advisory services.",
    thumbnail: "/template-thumbnails/accounting-firm.jpg",
  },
  {
    id: "architecture",
    folderName: "Architecture",
    name: "Architecture",
    category: "Design & Construction",
    description: "FORMA Studio — Modern architectural design, blueprints, and portfolio.",
    thumbnail: "/template-thumbnails/architecture.jpg",
  },
  {
    id: "beauty-salon",
    folderName: "Beauty Salon",
    name: "Beauty Salon",
    category: "Beauty & Wellness",
    description: "Lumière — Premium salon styling, aesthetics, treatments, and bookings.",
    thumbnail: "/template-thumbnails/beauty-salon.jpg",
  },
  {
    id: "creative-agency",
    folderName: "Creative Agency",
    name: "Creative Agency",
    category: "Digital Agency",
    description: "AETERNA — Branding, creative direction, mobile design, and digital innovation.",
    thumbnail: "/template-thumbnails/creative-agency.jpg",
  },
  {
    id: "digital-marketing-agency",
    folderName: "Digital Marketing agency",
    name: "Digital Marketing Agency",
    category: "Marketing & Growth",
    description: "ApexGrowth — Performance marketing, SEO, paid ads, and brand analytics.",
    thumbnail: "/template-thumbnails/digital-marketing-agency.jpg",
  },
  {
    id: "financial-services-and-bank",
    folderName: "Financial Services and bank",
    name: "Financial Services & Bank",
    category: "Banking & Wealth",
    description: "Aurelia Finance — Wealth management, corporate banking, and investments.",
    thumbnail: "/template-thumbnails/financial-services-and-bank.jpg",
  },
  {
    id: "hotel",
    folderName: "Hotel",
    name: "Hotel",
    category: "Hospitality & Resort",
    description: "AURA Resort & Spa — Luxury hospitality sanctuary, suites, ocean villas, and amenities.",
    thumbnail: "/template-thumbnails/hotel.jpg",
  },
  {
    id: "it-company",
    folderName: "IT Company",
    name: "IT Company",
    category: "Technology & Software",
    description: "SaaSify — Enterprise cloud software, intelligent tools, and SaaS solutions.",
    thumbnail: "/template-thumbnails/it-company.jpg",
  },
  {
    id: "interior-design",
    folderName: "Interior Design",
    name: "Interior Design",
    category: "Interior & Living",
    description: "SAVOYE — Luxury residential interiors, bespoke furniture, and styling.",
    thumbnail: "/template-thumbnails/interior-design.jpg",
  },
  {
    id: "jewellery",
    folderName: "Jewellery",
    name: "Jewellery",
    category: "Luxury & Retail",
    description: "Valenza — Handcrafted bespoke fine jewellery, diamonds, and collections.",
    thumbnail: "/template-thumbnails/jewellery.jpg",
  },
  {
    id: "ngo",
    folderName: "NGO",
    name: "NGO",
    category: "Nonprofit & Charity",
    description: "HopeRise — Global charity foundation, volunteer campaigns, and impact.",
    thumbnail: "/template-thumbnails/ngo.jpg",
  },
  {
    id: "restaurant",
    folderName: "Restaurant",
    name: "Restaurant",
    category: "Food & Dining",
    description: "Thandoor Rajas — Royal Indian culinary artistry, heritage spices, and fine dining.",
    thumbnail: "/template-thumbnails/restaurant.jpg",
  },
  {
    id: "solar-company",
    folderName: "Solar Company",
    name: "Solar Company",
    category: "Renewable Energy",
    description: "Premium Solar — Clean renewable energy, residential and industrial solar.",
    thumbnail: "/template-thumbnails/solar-company.jpg",
  },
  {
    id: "spa-and-wellness",
    folderName: "Spa and Wellness",
    name: "Spa & Wellness",
    category: "Wellness & Spa",
    description: "Serenity Spa — Holistic therapy, relaxation sanctuary, and wellness packages.",
    thumbnail: "/template-thumbnails/spa-and-wellness.jpg",
  },
  {
    id: "travel-tourism",
    folderName: "Travel-Tourism",
    name: "Travel & Tourism",
    category: "Travel & Expeditions",
    description: "WanderLuxe — Bespoke travel itineraries, luxury getaways, and world expeditions.",
    thumbnail: "/template-thumbnails/travel-tourism.jpg",
  },
  {
    id: "dancer",
    folderName: "dancer",
    name: "Dancer",
    category: "Performing Arts",
    description: "Elena Rostova — Soloist contemporary dancer portfolio, tours, and media.",
    thumbnail: "/template-thumbnails/dancer.jpg",
  },
  {
    id: "fitness",
    folderName: "fitness",
    name: "Fitness",
    category: "Fitness & Training",
    description: "APEX Performance — Elite athletic conditioning, sports gym, and recovery.",
    thumbnail: "/template-thumbnails/fitness.jpg",
  },
  {
    id: "insurance",
    folderName: "insurance",
    name: "Insurance",
    category: "Insurance & Risk",
    description: "Aegis Crest — Institutional risk protection, family, and health coverage.",
    thumbnail: "/template-thumbnails/insurance.jpg",
  },
  {
    id: "photography",
    folderName: "photography",
    name: "Photography",
    category: "Photography & Arts",
    description: "SJ Photography — High-fashion editorial photography, shoots, and gallery.",
    thumbnail: "/template-thumbnails/photography.jpg",
  },
  {
    id: "yoga",
    folderName: "yoga",
    name: "Yoga",
    category: "Mindfulness & Yoga",
    description: "Aria Veda — Somatic yoga, guided meditation, and holistic retreat studio.",
    thumbnail: "/template-thumbnails/yoga.jpg",
  },
];

export function getTemplateById(id?: string | null): TemplateItem | null {
  if (!id || typeof id !== "string") return null;
  const cleanId = id.trim().toLowerCase();
  return TEMPLATES_DATA.find((t) => t.id === cleanId) || null;
}

