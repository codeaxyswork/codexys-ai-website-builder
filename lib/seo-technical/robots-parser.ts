export interface RobotsTxtData {
  exists: boolean;
  content: string;
  disallowedRules: string[];
  allowedRules: string[];
  sitemaps: string[];
}

export async function fetchAndParseRobotsTxt(baseUrl: string): Promise<RobotsTxtData> {
  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(robotsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { exists: false, content: '', disallowedRules: [], allowedRules: [], sitemaps: [] };
    }

    const text = await res.text();
    const disallowedRules: string[] = [];
    const allowedRules: string[] = [];
    const sitemaps: string[] = [];

    const lines = text.split('\n');
    let currentUserAgent = '*';

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const [key, ...valParts] = line.split(':');
      const value = valParts.join(':').trim();
      const lowerKey = key.toLowerCase().trim();

      if (lowerKey === 'user-agent') {
        currentUserAgent = value;
      } else if (lowerKey === 'disallow' && value && (currentUserAgent === '*' || currentUserAgent.includes('*'))) {
        disallowedRules.push(value);
      } else if (lowerKey === 'allow' && value && (currentUserAgent === '*' || currentUserAgent.includes('*'))) {
        allowedRules.push(value);
      } else if (lowerKey === 'sitemap' && value) {
        sitemaps.push(value);
      }
    }

    return {
      exists: true,
      content: text,
      disallowedRules,
      allowedRules,
      sitemaps,
    };
  } catch (_e) {
    return { exists: false, content: '', disallowedRules: [], allowedRules: [], sitemaps: [] };
  }
}

export function isPathDisallowed(path: string, disallowedRules: string[]): boolean {
  if (!path || disallowedRules.length === 0) return false;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return disallowedRules.some((rule) => {
    if (rule === '/') return true;
    const cleanRule = rule.replace(/\*/g, '');
    return cleanPath.startsWith(cleanRule);
  });
}
