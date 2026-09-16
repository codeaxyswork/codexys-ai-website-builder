import { ContentQualityAnalysis, ContentQualityBreakdown } from './types';

export function analyzeContentQuality(
  contentHtml: string,
  title: string,
  seoMetadata?: {
    seo_title?: string;
    meta_description?: string;
    focus_keyword?: string;
  }
): ContentQualityAnalysis {
  const cleanText = (contentHtml || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleanText ? cleanText.split(/\s+/) : [];
  const wordCount = words.length;

  // Headings analysis
  const h1Match = contentHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Match = contentHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const h3Match = contentHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
  const totalHeadings = h1Match.length + h2Match.length + h3Match.length;

  // Paragraphs analysis
  const pMatch = contentHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphCount = pMatch.length;

  // Question & FAQ coverage
  const questionMarks = (cleanText.match(/\?/g) || []).length;
  const hasFaqBlock = /class=["'][^"']*faq[^"']*["']|id=["'][^"']*faq[^"']*["']|<dl|<dt/i.test(contentHtml);
  const questionHeadingCount = [...h2Match, ...h3Match].filter((h) => h.includes('?')).length;

  // Internal Links
  const linkMatches = contentHtml.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi) || [];
  const internalLinkCount = linkMatches.filter((link) => {
    const hrefMatch = link.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    return href.startsWith('/') || href.includes('localhost') || href.includes(title.toLowerCase().replace(/\s+/g, ''));
  }).length;

  // Scoring
  // 1. Heading structure score (0 - 100)
  let headingScore = 50;
  if (h2Match.length >= 2) headingScore += 30;
  if (h3Match.length >= 1) headingScore += 10;
  if (h1Match.length <= 1) headingScore += 10;

  // 2. Readability & Length score (0 - 100)
  let readabilityScore = 40;
  if (wordCount >= 300) readabilityScore += 20;
  if (wordCount >= 600) readabilityScore += 20;
  if (wordCount >= 1000) readabilityScore += 20;
  if (paragraphCount >= 4) readabilityScore = Math.min(100, readabilityScore + 10);

  // 3. Question & FAQ score
  let questionScore = 30;
  if (questionMarks >= 2) questionScore += 20;
  if (questionHeadingCount >= 1) questionScore += 30;
  if (hasFaqBlock) questionScore += 20;
  questionScore = Math.min(100, questionScore);

  // 4. Metadata score
  const seoTitle = seoMetadata?.seo_title || title || '';
  const metaDesc = seoMetadata?.meta_description || '';
  const focusKw = (seoMetadata?.focus_keyword || '').toLowerCase();

  let metaScore = 40;
  if (seoTitle.length >= 30 && seoTitle.length <= 65) metaScore += 20;
  if (metaDesc.length >= 100 && metaDesc.length <= 165) metaScore += 20;
  if (focusKw && (seoTitle.toLowerCase().includes(focusKw) || cleanText.toLowerCase().includes(focusKw))) {
    metaScore += 20;
  }
  metaScore = Math.min(100, metaScore);

  // 5. Internal Link score
  let linkScore = 30;
  if (internalLinkCount >= 1) linkScore += 35;
  if (internalLinkCount >= 3) linkScore += 35;
  linkScore = Math.min(100, linkScore);

  // 6. AEO Readiness score
  let aeoScore = 40;
  if (questionHeadingCount >= 1) aeoScore += 20;
  if (hasFaqBlock) aeoScore += 20;
  if (/ direct-answer | answer-box | key-takeaway | bullet-list |<ul>|<ol>/i.test(contentHtml)) aeoScore += 20;
  aeoScore = Math.min(100, aeoScore);

  const breakdown: ContentQualityBreakdown = {
    word_count: wordCount,
    paragraph_count: paragraphCount,
    heading_count: totalHeadings,
    readability_score: Math.min(100, readabilityScore),
    heading_structure_score: Math.min(100, headingScore),
    question_coverage_score: questionScore,
    topic_coverage_score: Math.min(100, Math.round((wordCount / 800) * 100)),
    internal_link_score: linkScore,
    metadata_score: metaScore,
    aeo_readiness_score: aeoScore,
  };

  const overallScore = Math.round(
    breakdown.readability_score * 0.2 +
      breakdown.heading_structure_score * 0.2 +
      breakdown.question_coverage_score * 0.15 +
      breakdown.metadata_score * 0.15 +
      breakdown.internal_link_score * 0.15 +
      breakdown.aeo_readiness_score * 0.15
  );

  const findings: ContentQualityAnalysis['findings'] = [];

  if (wordCount < 400) {
    findings.push({
      type: 'warning',
      category: 'Content Length',
      message: `Content length is low (${wordCount} words). Comprehensive coverage usually requires 600+ words.`,
      recommendation: 'Expand key sections with supporting examples and detailed steps.',
    });
  } else {
    findings.push({
      type: 'success',
      category: 'Content Length',
      message: `Good depth with ${wordCount} words.`,
    });
  }

  if (h2Match.length < 2) {
    findings.push({
      type: 'error',
      category: 'Heading Hierarchy',
      message: 'Missing section subheadings (H2).',
      recommendation: 'Add at least 2 to 3 H2 headings to divide the article logically.',
    });
  }

  if (questionHeadingCount === 0) {
    findings.push({
      type: 'warning',
      category: 'AEO / Search Intent',
      message: 'No question-based headings found for answer engines.',
      recommendation: 'Include question headings like "How does X work?" or "What are the benefits of Y?"',
    });
  }

  if (!metaDesc) {
    findings.push({
      type: 'error',
      category: 'SEO Metadata',
      message: 'Meta description is empty.',
      recommendation: 'Provide a compelling 140-160 character meta description containing your target keyword.',
    });
  }

  if (internalLinkCount === 0) {
    findings.push({
      type: 'warning',
      category: 'Internal Links',
      message: 'No internal links detected in the body content.',
      recommendation: 'Add relevant internal links to related website pages or blog posts.',
    });
  }

  return {
    overall_score: Math.min(100, Math.max(0, overallScore)),
    breakdown,
    findings,
  };
}
