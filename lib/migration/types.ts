export interface MigrationSEO {
  seoTitle?: string;
  metaDescription?: string;
  focusKeywords?: string[];
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  structuredData?: any;
}

export interface MigrationImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  isLogo?: boolean;
  role?: "hero" | "bg" | "logo" | "content" | "floating" | "icon";
}

export interface MigrationLink {
  text: string;
  href: string;
  isExternal: boolean;
}

export interface MigrationForm {
  action?: string;
  method?: string;
  fieldNames: string[];
  hasSubmitButton: boolean;
}

export interface MigrationSlide {
  index?: number;
  heading?: string;
  subheading?: string;
  text?: string;
  bgImage?: string;
  image?: string;
  foregroundImages?: string[];
  cta?: { text: string; href: string };
  htmlSnippet?: string;
}

export interface MigrationFloatingAction {
  type: "whatsapp" | "phone" | "custom";
  label?: string;
  url: string;
  iconUrl?: string;
}

export interface MigrationSection {
  type: "hero" | "features" | "gallery" | "faq" | "content" | "contact" | "footer" | "header" | "slider" | "unknown";
  classification?: "native" | "imported" | "unsupported";
  unsupportedReason?: string;
  heading?: string;
  subheading?: string;
  paragraphs: string[];
  buttons: { text: string; href: string }[];
  images: MigrationImage[];
  slides?: MigrationSlide[];
  bgImage?: string;
  logoUrl?: string;
  htmlSnippet: string;
  needsReview?: boolean;
}

export interface SourcePage {
  url: string;
  path: string;
  slug: string;
  title: string;
  siteName?: string;
  logoUrl?: string;
  heroBgImage?: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  images: MigrationImage[];
  links: MigrationLink[];
  forms: MigrationForm[];
  sections: MigrationSection[];
  floatingActions?: MigrationFloatingAction[];
  seo: MigrationSEO;
  isBlogPage?: boolean;
}

export interface NavigationItem {
  label: string;
  url: string;
  children?: NavigationItem[];
}

export interface ColorPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface GlobalStyles {
  colors: ColorPalette;
  fonts: string[];
  buttonStyle?: string;
}

export interface PlatformDetectionResult {
  name: "WordPress" | "Elementor" | "Webflow" | "Shopify" | "Custom website" | "Unknown";
  confidence: "high" | "medium" | "low";
  signals: string[];
}

export interface ScanSummary {
  pagesCount: number;
  imagesCount: number;
  navMenusCount: number;
  formsCount: number;
  blogPagesCount: number;
  seoRecordsCount: number;
}

export interface UrlMapping {
  originalUrl: string;
  originalPath: string;
  newSlug: string;
  requiresRedirect: boolean;
}

export interface MigrationWarning {
  type: "unsupported_script" | "unsupported_widget" | "form_needs_setup" | "section_review" | "url_changed";
  message: string;
  details?: string;
}

export interface SourceWebsiteScan {
  targetUrl: string;
  baseUrl: string;
  domain: string;
  siteName?: string;
  logoUrl?: string;
  platform: PlatformDetectionResult;
  pages: SourcePage[];
  navigation: {
    main: NavigationItem[];
    footer: NavigationItem[];
  };
  globalStyles: GlobalStyles;
  summary: ScanSummary;
  urlMappings: UrlMapping[];
  warnings: MigrationWarning[];
}

export type MigrationMode = "exact" | "redesign" | "rebuild";

export interface MigrationSelections {
  content: {
    pages: boolean;
    blogPages: boolean;
    navigation: boolean;
    textContent: boolean;
    images: boolean;
    logo: boolean;
    forms: boolean;
  };
  seo: {
    pageTitles: boolean;
    metaDescriptions: boolean;
    canonicalUrls: boolean;
    openGraph: boolean;
    robotsSettings: boolean;
    structuredData: boolean;
  };
  design: {
    colors: boolean;
    typography: boolean;
    spacing: boolean;
    layout: boolean;
    buttons: boolean;
  };
}

export interface MigrationExecuteRequest {
  targetUrl: string;
  scanResult: SourceWebsiteScan;
  mode: MigrationMode;
  selections: MigrationSelections;
  redesignPrompt?: string;
}

export interface PageBehaviors {
  hasCssAnimations: boolean;
  hasCssTransitions: boolean;
  hasElementorAnimations: boolean;
  hasSliders: boolean;
  hasAutoplaySliders: boolean;
  hasMenuToggle: boolean;
  hasAccordions: boolean;
  hasTabs: boolean;
  hasModals: boolean;
  hasStickyHeader: boolean;
  hasHoverEffects: boolean;
  hasLazyLoading: boolean;
  hasVideoEmbeds: boolean;
  hasDomMutations: boolean;
  detectedAnimationsCount: number;
}

export interface PageInteractions {
  menuInteraction: "PASS" | "FAIL" | "NOT_TESTABLE";
  sliderBehavior: "PASS" | "FAIL" | "NOT_TESTABLE";
  accordionBehavior: "PASS" | "FAIL" | "NOT_TESTABLE";
  tabBehavior: "PASS" | "FAIL" | "NOT_TESTABLE";
  whatsAppButton: "PASS" | "NOT_PRESENT";
  phoneButton: "PASS" | "NOT_PRESENT";
  verificationPassed: boolean;
}

export interface ResourceSummary {
  detected: number;
  localized: number;
  unresolved: number;
  urls?: string[];
  unresolvedUrls?: string[];
}

export interface JsResourceInventoryItem {
  url: string;
  status: number;
  contentType: string;
  sizeBytes: number;
  captured: boolean;
  localized: boolean;
  reasonIfUnresolved?: string;
  category: "elementor" | "jquery" | "swiper" | "slick" | "menu" | "animation" | "popup" | "other";
}

export interface HtmlSizesBreakdown {
  renderedContentSizeBytes: number;
  outerHtmlSizeBytes: number;
  sanitizedSizeBytes: number;
  generatedSizeBytes: number;
}

export interface RuntimeVerificationItem {
  name: string;
  captured: boolean;
  localized: boolean;
  executed: boolean;
  verified: boolean;
}

export interface RuntimeVerificationSummary {
  originalJsExecution: "PASS" | "PARTIAL" | "FAIL";
  elementor: RuntimeVerificationItem;
  jQuery: RuntimeVerificationItem;
  swiperSlick: RuntimeVerificationItem;
  navigation: RuntimeVerificationItem;
  animation: RuntimeVerificationItem;
  popup: RuntimeVerificationItem;
}

export type BehaviorSource = "ORIGINAL_LOCALIZED" | "ORIGINAL_EXTERNAL" | "CODEAXYS_FALLBACK" | "UNRESOLVED";

export interface PageCaptureManifest {
  sourceUrl: string;
  finalUrl: string;
  path: string;
  status: "PASS" | "FAIL" | "WARNING";
  startTime: number;
  endTime: number;
  durationMs: number;
  htmlSizeBytes: number;
  css: ResourceSummary;
  js: ResourceSummary;
  images: ResourceSummary;
  fonts: ResourceSummary;
  media: { videoCount: number; iframeCount: number };
  inline: { styleCount: number; scriptCount: number };
  errors: { consoleErrors: string[]; pageErrors: string[]; networkFailures: string[] };
  behaviors: PageBehaviors;
  interactions: PageInteractions;
  unresolvedResources: string[];
  jsInventory?: JsResourceInventoryItem[];
  htmlSizes?: HtmlSizesBreakdown;
  runtimeVerification?: RuntimeVerificationSummary;
  behaviorSource?: {
    overall: BehaviorSource;
    menu: BehaviorSource;
    slider: BehaviorSource;
    accordion: BehaviorSource;
  };
  migrationStatusLabel?: "Exact Migration" | "Partial Exact Migration" | "Functional Migration";
}

export type MigrationJobStatus =
  | "QUEUED"
  | "DISCOVERING"
  | "CAPTURING"
  | "IMPORTING_ASSETS"
  | "FINALIZING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED"
  | "RUNNING"
  | "CAPTURING_PAGE"
  | "CAPTURING_ASSETS";

export interface MigrationFailureDetails {
  stage: string;
  step: string;
  pageUrl?: string;
  errorMessage: string;
  retryCount: number;
  timestamp: string;
}

export interface MigrationPageDiagnostic {
  url: string;
  path: string;
  pageNumber: number;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  durationMs: number;
  error: string | null;
  retryCount: number;
  timestamp?: string;
}

export interface MigrationJobRecord {
  jobId: string;
  websiteId: string;
  userId?: string;
  targetUrl: string;
  cleanSlug: string;
  mode: MigrationMode;
  selections: MigrationSelections;
  redesignPrompt?: string;
  status: MigrationJobStatus;
  currentStage: string;
  progress: number;
  currentPage: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  pagesToMigrate?: SourcePage[];
  capturedPages?: { path: string; html_content: string; css_content: string; manifest?: PageCaptureManifest }[];
  storedPagesList?: string[];
  pageDiagnostics: MigrationPageDiagnostic[];
  failureDetails?: MigrationFailureDetails | null;
  error?: string | null;
  result?: MigrationExecuteResult | null;
  startTime: string;
  updatedAt: string;
  lastHeartbeatAt?: string;
  workerInstanceId?: string;
}

export interface MigrationExecuteResult {
  success: boolean;
  websiteId: string;
  draftSlug: string;
  title: string;
  summary: ScanSummary;
  warnings: MigrationWarning[];
  urlMappings: UrlMapping[];
  capturedPages?: { path: string; html_content: string; css_content: string; manifest?: PageCaptureManifest }[];
  manifests?: PageCaptureManifest[];
}

