export interface TechnicalCrawlConfig {
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  maxResponseBodyBytes: number;
}

export interface CrawledPageData {
  url: string;
  normalizedUrl: string;
  depth: number;
  statusCode: number;
  contentType: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  wordCount: number;
  canonical: string | null;
  robotsDirectives: string | null;
  isNoindex: boolean;
  isNofollow: boolean;
  isDisallowedByRobots: boolean;
  redirectTarget: string | null;
  redirectChain?: string[];
  isRedirectChain: boolean;
  isRedirectLoop: boolean;
  responseTimeMs: number;
  outboundLinks: string[];
  inboundLinksCount: number;
  imageIssues: {
    totalImages: number;
    missingAltCount: number;
    brokenImagesCount: number;
  };
  schemaIssues: {
    hasSchema: boolean;
    validJsonLd: boolean;
    typesFound: string[];
    syntaxError?: string;
  };
  securityIssues: {
    isHttps: boolean;
    hasMixedContent: boolean;
  };
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface TechnicalCrawlIssue {
  id?: string;
  issue_type: string;
  url: string;
  category: 'crawlability' | 'indexability' | 'status_codes' | 'redirects' | 'canonicals' | 'sitemap' | 'robots' | 'links' | 'structured_data' | 'page_quality' | 'security';
  severity: IssueSeverity;
  explanation: string;
  evidence?: string;
  recommended_action: string;
}

export interface TechnicalBreakdownScores {
  crawlability: number;
  indexability: number;
  statusCodes: number;
  redirects: number;
  canonicals: number;
  sitemap: number;
  robots: number;
  links: number;
  structuredData: number;
  pageQuality: number;
}

export interface TechnicalCrawlResult {
  runId?: string;
  technicalScore: number;
  totalUrlsCrawled: number;
  totalIssuesCount: number;
  statusCounts: {
    ok2xx: number;
    redirect3xx: number;
    clientError4xx: number;
    serverError5xx: number;
    blocked: number;
    noindex: number;
    orphans: number;
  };
  breakdownScores: TechnicalBreakdownScores;
  crawlGraph: {
    nodes: Array<{ url: string; depth: number; statusCode: number; title: string; isOrphan: boolean }>;
    edges: Array<{ source: string; target: string }>;
  };
  issues: TechnicalCrawlIssue[];
  robotsTxtAnalysis?: {
    exists: boolean;
    disallowedPathsCount: number;
    sitemapsDeclared: string[];
  };
  sitemapAnalysis?: {
    exists: boolean;
    totalUrls: number;
    sitemapVsCrawlMismatchesCount: number;
  };
}
