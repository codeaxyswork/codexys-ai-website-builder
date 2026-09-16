import { ContentBrief, ContentOutline } from './types';

export function generateContentOutline(brief: ContentBrief): ContentOutline {
  const topic = brief.topic;
  const primaryKw = brief.primary_keyword || topic;
  const secondaryKws = brief.secondary_keywords || [];

  const suggestedTitle = `${topic}: The Ultimate Guide for ${new Date().getFullYear()}`;
  const h1 = topic;

  const metaDesc = `Discover key insights about ${primaryKw}. Learn practical strategies, expert advice, and answers to common questions.`;
  const introGoal = `Hook the reader immediately, define ${primaryKw}, and state the primary benefit of reading this guide.`;
  const aeoTarget = `A concise 2-sentence direct answer defining "${primaryKw}" clearly for search engines and AI answer engines.`;

  const kw1 = secondaryKws[0] || 'Key Strategies';
  const kw2 = secondaryKws[1] || 'Best Practices';
  const kw3 = secondaryKws[2] || 'Common Challenges';

  const internalLinks = brief.internal_link_opportunities || [];

  const sections: ContentOutline['sections'] = [
    {
      heading_level: 'H2',
      title: `What is ${primaryKw}?`,
      content_goal: `Provide a clear, authoritative definition and core concepts of ${primaryKw}.`,
      key_points: [
        `Core definition of ${primaryKw}`,
        `Why it matters in modern industry`,
        `Key components and prerequisites`,
      ],
      questions_to_answer: [`What is ${primaryKw}?`, `Why is ${primaryKw} important?`],
      suggested_internal_link: internalLinks[0]
        ? { path: internalLinks[0].target_path, anchor: internalLinks[0].anchor_suggestion }
        : undefined,
    },
    {
      heading_level: 'H2',
      title: `Essential Strategies for ${kw1}`,
      content_goal: `Detail step-by-step actionable advice for implementation.`,
      key_points: [
        `Step 1: Preparation and planning`,
        `Step 2: Execution and best practices`,
        `Step 3: Measuring success and key metrics`,
      ],
      questions_to_answer: [`How do you implement ${kw1} effectively?`],
      suggested_internal_link: internalLinks[1]
        ? { path: internalLinks[1].target_path, anchor: internalLinks[1].anchor_suggestion }
        : undefined,
    },
    {
      heading_level: 'H2',
      title: `Overcoming ${kw3}`,
      content_goal: `Address frequent pitfalls, missteps, and competitor gap topics.`,
      key_points: [
        `Common pitfalls to avoid`,
        `Troubleshooting issues`,
        `Expert tips for long-term consistency`,
      ],
      questions_to_answer: [`What are the biggest mistakes when handling ${kw3}?`],
    },
    {
      heading_level: 'H3',
      title: `${kw2} to Boost Results`,
      content_goal: `Highlight specific tools, frameworks, or techniques.`,
      key_points: [`Recommended framework`, `Practical application checklist`],
      questions_to_answer: [`What tools or techniques work best?`],
    },
    {
      heading_level: 'H2',
      title: 'Conclusion & Next Steps',
      content_goal: 'Summarize key takeaways and provide a clear call to action.',
      key_points: ['Summary of core benefits', 'Actionable next steps', 'CTA to contact or explore more'],
      questions_to_answer: ['Where should I start next?'],
    },
  ];

  const faqOpportunities: ContentOutline['faq_opportunities'] = [
    {
      question: `How long does it take to see results with ${primaryKw}?`,
      answer_guidance: `Explain typical timelines based on scope, consistent effort, and best practices.`,
    },
    {
      question: `Is ${primaryKw} suitable for small businesses?`,
      answer_guidance: `Clarify accessibility, scalability, and resource requirements.`,
    },
    {
      question: `What is the difference between ${primaryKw} and traditional approaches?`,
      answer_guidance: `Highlight key advantages, efficiency gains, and modern standards.`,
    },
  ];

  const internalLinkSummary = internalLinks.map((l) => `${l.anchor_suggestion} -> ${l.target_path}`);

  return {
    suggested_title: suggestedTitle,
    h1,
    meta_description: metaDesc,
    introduction_goal: introGoal,
    aeo_direct_answer_target: aeoTarget,
    sections,
    faq_opportunities: faqOpportunities,
    structured_data_types: ['Article', 'FAQPage'],
    internal_link_summary: internalLinkSummary,
  };
}
