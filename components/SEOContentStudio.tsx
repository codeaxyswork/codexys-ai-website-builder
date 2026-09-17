'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  ListTree,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileDiff,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Send,
  SlidersHorizontal,
  Eye,
  Save,
  BookOpen,
  Target,
  Layers,
  Search,
} from 'lucide-react';
import { ContentBrief, ContentOutline, ContentQualityAnalysis, ContentRefreshReport, BeforeAfterDiff } from '@/lib/seo-content-studio/types';

interface SEOContentStudioProps {
  websiteId: string;
  initialTopic?: string;
  initialOpportunityId?: string;
}

export function SEOContentStudio({ websiteId, initialTopic, initialOpportunityId }: SEOContentStudioProps) {
  const [activeTab, setActiveTab] = useState<'brief' | 'editor' | 'analysis' | 'refresh' | 'diff'>('brief');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Brief Inputs
  const [topic, setTopic] = useState(initialTopic || '');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywordsStr, setSecondaryKeywordsStr] = useState('');
  const [searchIntent, setSearchIntent] = useState<'informational' | 'transactional' | 'commercial' | 'navigational'>('informational');
  const [targetAudience, setTargetAudience] = useState('Industry Professionals & Customers');
  const [desiredTone, setDesiredTone] = useState('Professional, Authoritative & Engaging');

  // Generated Data
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [outline, setOutline] = useState<ContentOutline | null>(null);
  const [qualityAnalysis, setQualityAnalysis] = useState<ContentQualityAnalysis | null>(null);

  // Editor State
  const [articleTitle, setArticleTitle] = useState('');
  const [articleSlug, setArticleSlug] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleExcerpt, setArticleExcerpt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [category, setCategory] = useState('General');

  // Refresh & Diff State
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [refreshReport, setRefreshReport] = useState<ContentRefreshReport | null>(null);
  const [beforeAfterDiff, setBeforeAfterDiff] = useState<BeforeAfterDiff | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // 1. Fetch Blog Posts for Refresh dropdown
  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch(`/api/websites/${websiteId}/blog`);
        const json = await res.json();
        if (json.posts) {
          setBlogPosts(json.posts);
        }
      } catch (_e) {}
    }
    loadPosts();
  }, [websiteId]);

  // 2. Generate Brief
  const handleGenerateBrief = async () => {
    if (!topic.trim()) {
      setError('Please enter a content topic.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          primary_keyword: primaryKeyword,
          secondary_keywords: secondaryKeywordsStr.split(',').map((s) => s.trim()).filter(Boolean),
          search_intent: searchIntent,
          target_audience: targetAudience,
          desired_tone: desiredTone,
          opportunity_id: initialOpportunityId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate brief');

      setBrief(data.brief);
      setPrimaryKeyword(data.brief.primary_keyword);

      // Auto generate outline
      const outlineRes = await fetch(`/api/websites/${websiteId}/seo/content-studio/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: data.brief }),
      });
      const outlineData = await outlineRes.json();
      if (outlineData.outline) {
        setOutline(outlineData.outline);
      }
      setSuccessMsg('Content brief & outline successfully generated!');
    } catch (err: any) {
      setError(err?.message || 'Error generating brief');
    } finally {
      setLoading(false);
    }
  };

  // 3. Generate AI Article Draft
  const handleGenerateDraft = async () => {
    if (!brief) {
      setError('Please create a content brief first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, outline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI article draft');

      const draft = data.draft;
      setArticleTitle(draft.title);
      setArticleSlug(draft.slug);
      setArticleContent(draft.content);
      setArticleExcerpt(draft.excerpt);
      setSeoTitle(draft.seo_title);
      setMetaDescription(draft.meta_description);
      setFocusKeyword(draft.focus_keyword);
      setCategory(draft.category);

      setActiveTab('editor');
      setSuccessMsg(`AI Article Draft generated! (5 AI credits used)`);

      // Trigger instant quality check
      runQualityCheck(draft.content, draft.title, {
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        focus_keyword: draft.focus_keyword,
      });
    } catch (err: any) {
      setError(err?.message || 'Error generating draft');
    } finally {
      setLoading(false);
    }
  };

  // 4. Run Deterministic Quality Check
  const runQualityCheck = async (contentStr: string, titleStr: string, metadataObj?: any) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentStr,
          title: titleStr,
          seo_metadata: metadataObj || {
            seo_title: seoTitle,
            meta_description: metaDescription,
            focus_keyword: focusKeyword,
          },
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setQualityAnalysis(data.analysis);
      }
    } catch (_e) {}
  };

  // 5. Trigger Content Refresh Analysis
  const handleRunRefresh = async () => {
    if (!selectedPostId) {
      setError('Please select a blog post to analyze for refresh.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: selectedPostId, target_type: 'blog' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run refresh audit');

      setRefreshReport(data.report);

      // Pre-fill editor with selected post for optimization
      const targetPost = blogPosts.find((p) => p.id === selectedPostId);
      if (targetPost) {
        setArticleTitle(targetPost.title);
        setArticleSlug(targetPost.slug);
        setArticleContent(targetPost.content || '');
        setArticleExcerpt(targetPost.excerpt || '');
        setSeoTitle(targetPost.seo_title || targetPost.title);
        setMetaDescription(targetPost.meta_description || '');
        setFocusKeyword(targetPost.focus_keyword || '');

        runQualityCheck(targetPost.content || '', targetPost.title);
      }
      setActiveTab('refresh');
      setSuccessMsg('Content Refresh analysis report completed!');
    } catch (err: any) {
      setError(err?.message || 'Error executing refresh analysis');
    } finally {
      setLoading(false);
    }
  };

  // 6. Compute Diff
  const handleComputeDiff = async () => {
    const targetPost = blogPosts.find((p) => p.id === selectedPostId);
    const orig = {
      title: targetPost?.title || articleTitle,
      content: targetPost?.content || '',
      seo_title: targetPost?.seo_title || '',
      meta_description: targetPost?.meta_description || '',
      focus_keyword: targetPost?.focus_keyword || '',
    };
    const prop = {
      title: articleTitle,
      content: articleContent,
      seo_title: seoTitle,
      meta_description: metaDescription,
      focus_keyword: focusKeyword,
    };

    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: orig, proposed: prop }),
      });
      const data = await res.json();
      if (data.diff) {
        setBeforeAfterDiff(data.diff);
        setActiveTab('diff');
      }
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  // 7. Apply Changes with Explicit User Approval
  const handleApplyChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/content-studio/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: selectedPostId || undefined,
          target_type: 'blog',
          confirm_apply: true,
          title: articleTitle,
          content: articleContent,
          excerpt: articleExcerpt,
          category,
          seo_title: seoTitle,
          meta_description: metaDescription,
          focus_keyword: focusKeyword,
          change_summary: changeSummary || 'Applied changes via SEO Content Studio',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply content changes');

      setShowApplyModal(false);
      setSuccessMsg('Content successfully published/updated with explicit user approval!');
    } catch (err: any) {
      setError(err?.message || 'Error applying changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-slate-50 border border-purple-100/80 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm mb-1">
              <Sparkles className="w-4 h-4" /> SEO Content Studio & Content Refresh
            </div>
            <h2 className="text-2xl font-bold text-slate-900">SEO Writing & Optimization Workspace</h2>
            <p className="text-slate-600 text-sm mt-1">
              Generate data-backed briefs, answer-first outlines, AEO articles, and refresh existing content with explicit before/after review.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {articleTitle && (
              <button
                onClick={() => setShowApplyModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Apply & Publish Content
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'brief' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" /> 1. Brief & Outline
          </button>
          <button
            onClick={() => {
              setActiveTab('editor');
              if (articleContent) runQualityCheck(articleContent, articleTitle);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'editor' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" /> 2. Content Editor & SEO
          </button>
          <button
            onClick={() => {
              setActiveTab('analysis');
              if (articleContent) runQualityCheck(articleContent, articleTitle);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'analysis' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Target className="w-4 h-4" /> 3. Quality & AEO Analysis
          </button>
          <button
            onClick={() => setActiveTab('refresh')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'refresh' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" /> 4. Content Refresh Audit
          </button>
          <button
            onClick={() => {
              handleComputeDiff();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'diff' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileDiff className="w-4 h-4" /> 5. Before vs After Review
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" /> {successMsg}
        </div>
      )}

      {/* TAB 1: BRIEF & OUTLINE */}
      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Brief Input Controls */}
          <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-purple-600" /> Create Content Brief
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Content Topic *</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Luxury Car Maintenance Guide"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Primary Keyword</label>
              <input
                type="text"
                value={primaryKeyword}
                onChange={(e) => setPrimaryKeyword(e.target.value)}
                placeholder="e.g. luxury car maintenance"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Secondary Keywords (comma separated)</label>
              <input
                type="text"
                value={secondaryKeywordsStr}
                onChange={(e) => setSecondaryKeywordsStr(e.target.value)}
                placeholder="e.g. engine care, oil change schedule, brake service"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 placeholder-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Search Intent</label>
                <select
                  value={searchIntent}
                  onChange={(e: any) => setSearchIntent(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                >
                  <option value="informational">Informational</option>
                  <option value="commercial">Commercial</option>
                  <option value="transactional">Transactional</option>
                  <option value="navigational">Navigational</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handleGenerateBrief}
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />} Generate Brief & Outline
              </button>
            </div>
          </div>

          {/* Brief & Outline Output Display */}
          <div className="lg:col-span-7 space-y-6">
            {brief ? (
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wider">Source Recommendations</h4>
                  <div className="mt-2 space-y-2">
                    {brief.source_recommendations.map((rec, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-800">{rec.label}:</span>{' '}
                          <span className="text-slate-600">{rec.details}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {outline && (
                  <div>
                    <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-2">AEO-Optimized Article Outline</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                      <div className="font-bold text-slate-900 text-base">H1: {outline.h1}</div>
                      <div className="text-slate-700 text-xs italic bg-purple-50/60 p-2.5 rounded border border-purple-200/80">
                        <strong className="text-purple-800">AEO Target:</strong> {outline.aeo_direct_answer_target}
                      </div>

                      <div className="space-y-3 pt-2">
                        {outline.sections.map((sec, idx) => (
                          <div key={idx} className="border-l-2 border-purple-600 pl-3 space-y-1">
                            <div className="font-semibold text-slate-900">
                              {sec.heading_level}: {sec.title}
                            </div>
                            <p className="text-xs text-slate-600">{sec.content_goal}</p>
                            {sec.suggested_internal_link && (
                              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                                <ExternalLink className="w-3.5 h-3.5" /> Link to {sec.suggested_internal_link.path} ({sec.suggested_internal_link.anchor})
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {outline.faq_opportunities.length > 0 && (
                        <div className="pt-3 border-t border-slate-200">
                          <strong className="text-xs text-amber-700 uppercase">FAQ Opportunities:</strong>
                          <ul className="mt-1 space-y-1 text-xs text-slate-700">
                            {outline.faq_opportunities.map((faq, fIdx) => (
                              <li key={fIdx} className="flex items-start gap-2">
                                <span className="text-amber-600">•</span> {faq.question}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerateDraft}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate AI Draft (5 Credits)
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-12 text-center text-slate-500">
                <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="font-medium">Enter a topic and click "Generate Brief & Outline" to start.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT EDITOR & SEO METADATA */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" /> Article Editor
              </h3>
              <div className="text-xs text-slate-500">
                Word Count: <span className="text-slate-900 font-bold">{(articleContent.replace(/<[^>]*>/g, ' ').match(/\s+/g) || []).length}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Title</label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">URL Slug</label>
                <input
                  type="text"
                  value={articleSlug}
                  onChange={(e) => setArticleSlug(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">HTML Content Workspace</label>
              <textarea
                value={articleContent}
                onChange={(e) => {
                  setArticleContent(e.target.value);
                  runQualityCheck(e.target.value, articleTitle);
                }}
                rows={16}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-900 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              ></textarea>
            </div>
          </div>

          {/* SEO Metadata Side Panel */}
          <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4">
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Search className="w-4 h-4 text-purple-600" /> SEO & Social Metadata
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-700 font-semibold">SEO Title</span>
                <span className={seoTitle.length >= 40 && seoTitle.length <= 60 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {seoTitle.length}/60 chars
                </span>
              </div>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-700 font-semibold">Meta Description</span>
                <span className={metaDescription.length >= 120 && metaDescription.length <= 160 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {metaDescription.length}/160 chars
                </span>
              </div>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Focus Keyword</label>
              <input
                type="text"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <button
              onClick={() => setShowApplyModal(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Save / Publish Changes
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: QUALITY & AEO ANALYSIS */}
      {activeTab === 'analysis' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          {qualityAnalysis ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Content Quality & AEO Readiness Audit</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Deterministic 0-AI-credit evaluation</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-purple-600">{qualityAnalysis.overall_score}</span>
                  <span className="text-slate-400 text-sm"> / 100</span>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Readability</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{qualityAnalysis.breakdown.readability_score}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Headings</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{qualityAnalysis.breakdown.heading_structure_score}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Question Coverage</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{qualityAnalysis.breakdown.question_coverage_score}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Metadata</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{qualityAnalysis.breakdown.metadata_score}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">Internal Links</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{qualityAnalysis.breakdown.internal_link_score}%</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 font-medium">AEO Readiness</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">{qualityAnalysis.breakdown.aeo_readiness_score}%</div>
                </div>
              </div>

              {/* Audit Findings */}
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Audit Findings & Recommendations</h4>
                {qualityAnalysis.findings.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-start gap-3">
                    {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
                    {item.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                    {item.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-semibold text-slate-900">
                        [{item.category}] {item.message}
                      </div>
                      {item.recommendation && <div className="text-slate-600 mt-1">{item.recommendation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Run quality check in the editor tab to view analysis.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CONTENT REFRESH AUDIT */}
      {activeTab === 'refresh' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-600" /> Content Refresh Audit Workflow
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Select an existing blog post or page to audit for freshness and gaps.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedPostId}
                onChange={(e) => setSelectedPostId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              >
                <option value="">Select Existing Blog Post...</option>
                {blogPosts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.status})
                  </option>
                ))}
              </select>
              <button
                onClick={handleRunRefresh}
                disabled={loading || !selectedPostId}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-xs font-semibold transition shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Audit Refresh
              </button>
            </div>
          </div>

          {refreshReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-medium">Quality Score</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{refreshReport.quality_score} / 100</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-medium">Freshness Status</div>
                  <div className="text-lg font-bold text-amber-600 capitalize mt-1">{refreshReport.metadata_freshness.replace('_', ' ')}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="text-xs text-slate-500 font-medium">AEO Readiness</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">{refreshReport.aeo_readiness_score}%</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Actionable Refresh Recommendations</h4>
                <div className="space-y-3">
                  {refreshReport.recommendations.map((rec) => (
                    <div key={rec.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-700 uppercase">{rec.category}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rec.severity}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{rec.what}</div>
                      <div className="text-slate-600">
                        <strong>Why:</strong> {rec.why}
                      </div>
                      <div className="text-slate-600">
                        <strong>Where:</strong> {rec.where}
                      </div>
                      <div className="text-emerald-700 font-medium pt-1">
                        <strong>Action:</strong> {rec.suggested_action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BEFORE VS AFTER REVIEW */}
      {activeTab === 'diff' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileDiff className="w-5 h-5 text-purple-600" /> Before vs After Content Diff Review
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Review all proposed content & metadata changes before applying them.</p>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-semibold transition shadow-xs flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Approve & Apply
            </button>
          </div>

          {beforeAfterDiff ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Added Sections</div>
                  <div className="text-xl font-bold text-emerald-600">{beforeAfterDiff.added_lines_count}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Modified Sections</div>
                  <div className="text-xl font-bold text-amber-600">{beforeAfterDiff.modified_sections_count}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 font-medium">Removed Sections</div>
                  <div className="text-xl font-bold text-rose-600">{beforeAfterDiff.removed_lines_count}</div>
                </div>
              </div>

              {/* Content Visual Diff */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-800 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: beforeAfterDiff.content_diff_html }}></div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">Click "5. Before vs After Review" to generate diff comparison.</div>
          )}
        </div>
      )}

      {/* EXPLICIT USER APPROVAL MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Explicit User Approval Required
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to apply these content and SEO changes to <strong className="text-slate-900">{articleTitle}</strong>? This action will save a revision record and update the content.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Change Summary</label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Added AEO direct answer section and refreshed metadata"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyChanges}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
