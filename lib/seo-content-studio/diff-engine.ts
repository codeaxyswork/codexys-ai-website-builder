import { BeforeAfterDiff } from './types';

export function computeBeforeAfterDiff(
  original: {
    title: string;
    content: string;
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
  },
  proposed: {
    title: string;
    content: string;
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
  }
): BeforeAfterDiff {
  const origClean = original.content || '';
  const propClean = proposed.content || '';

  const origHeadings = (origClean.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || []).map((h) =>
    h.replace(/<[^>]*>/g, '').trim()
  );
  const propHeadings = (propClean.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || []).map((h) =>
    h.replace(/<[^>]*>/g, '').trim()
  );

  const headingChanges: BeforeAfterDiff['heading_changes'] = [];
  propHeadings.forEach((ph) => {
    if (!origHeadings.includes(ph)) {
      headingChanges.push({ type: 'added', heading: ph });
    }
  });
  origHeadings.forEach((oh) => {
    if (!propHeadings.includes(oh)) {
      headingChanges.push({ type: 'removed', heading: oh });
    }
  });

  // Extract internal links
  const extractLinks = (html: string) => {
    const matches = html.match(/href=["']([^"']+)["']/gi) || [];
    return matches.map((m) => m.replace(/href=["']/i, '').replace(/["']$/, ''));
  };
  const origLinks = extractLinks(origClean);
  const propLinks = extractLinks(propClean);

  const addedLinks = propLinks.filter((l) => !origLinks.includes(l));
  const removedLinks = origLinks.filter((l) => !propLinks.includes(l));

  // Compute paragraph / block level diff
  const origBlocks = origClean.split(/(?=<(?:p|h1|h2|h3|ul|ol|blockquote|div))/i).filter(Boolean);
  const propBlocks = propClean.split(/(?=<(?:p|h1|h2|h3|ul|ol|blockquote|div))/i).filter(Boolean);

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  const diffHtmlParts: string[] = [];

  const maxLen = Math.max(origBlocks.length, propBlocks.length);
  for (let i = 0; i < maxLen; i++) {
    const ob = origBlocks[i];
    const pb = propBlocks[i];

    if (ob && !pb) {
      removedCount++;
      diffHtmlParts.push(
        `<div style="background-color: rgba(239, 68, 68, 0.15); border-left: 3px solid #ef4444; padding: 8px 12px; margin: 4px 0; border-radius: 4px;"><span style="color: #ef4444; font-size: 11px; font-weight: bold; text-transform: uppercase;">Removed</span><div style="text-decoration: line-through; opacity: 0.8;">${ob}</div></div>`
      );
    } else if (!ob && pb) {
      addedCount++;
      diffHtmlParts.push(
        `<div style="background-color: rgba(34, 197, 94, 0.15); border-left: 3px solid #22c55e; padding: 8px 12px; margin: 4px 0; border-radius: 4px;"><span style="color: #22c55e; font-size: 11px; font-weight: bold; text-transform: uppercase;">Added</span><div>${pb}</div></div>`
      );
    } else if (ob !== pb) {
      modifiedCount++;
      diffHtmlParts.push(
        `<div style="background-color: rgba(234, 179, 8, 0.15); border-left: 3px solid #eab308; padding: 8px 12px; margin: 4px 0; border-radius: 4px;"><span style="color: #eab308; font-size: 11px; font-weight: bold; text-transform: uppercase;">Modified</span><div style="text-decoration: line-through; opacity: 0.6; font-size: 13px;">${ob}</div><div style="margin-top: 4px; font-weight: 500;">${pb}</div></div>`
      );
    } else {
      diffHtmlParts.push(`<div style="padding: 6px 12px; opacity: 0.7;">${pb}</div>`);
    }
  }

  const metadataChanged =
    original.title !== proposed.title ||
    original.seo_title !== proposed.seo_title ||
    original.meta_description !== proposed.meta_description ||
    original.focus_keyword !== proposed.focus_keyword;

  return {
    before_title: original.title,
    after_title: proposed.title,
    before_seo_title: original.seo_title,
    after_seo_title: proposed.seo_title,
    before_meta_description: original.meta_description,
    after_meta_description: proposed.meta_description,
    before_focus_keyword: original.focus_keyword,
    after_focus_keyword: proposed.focus_keyword,
    added_lines_count: addedCount,
    removed_lines_count: removedCount,
    modified_sections_count: modifiedCount,
    metadata_changed: metadataChanged,
    content_diff_html: diffHtmlParts.join(''),
    heading_changes: headingChanges,
    internal_link_changes: {
      added_links: addedLinks,
      removed_links: removedLinks,
    },
  };
}
