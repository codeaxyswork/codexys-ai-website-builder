"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Newspaper,
  Plus,
  Wand2,
  Edit3,
  Trash2,
  Globe,
  Eye,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  FileText,
  Tag,
  Folder,
  User,
  Image as ImageIcon,
  Sliders,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

export interface BlogPost {
  id: string;
  website_id: string;
  user_id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  status: "draft" | "published";
  featured_image?: string | null;
  author?: string | null;
  category?: string | null;
  tags?: string[];
  seo_title?: string | null;
  meta_description?: string | null;
  focus_keyword?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  robots_config?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface BlogEngineClientProps {
  website: any;
  initialPosts: BlogPost[];
  userCredits: number;
}

export function BlogEngineClient({ website, initialPosts, userCredits }: BlogEngineClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [credits, setCredits] = useState<number>(userCredits);
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");

  // Active Post for Editing
  const [activePost, setActivePost] = useState<Partial<BlogPost>>({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    status: "draft",
    featured_image: "",
    author: "Admin",
    category: "General",
    tags: [],
    seo_title: "",
    meta_description: "",
    focus_keyword: "",
    canonical_url: "",
    og_title: "",
    og_description: "",
    og_image: "",
    robots_config: "index, follow",
  });

  const [tagInput, setTagInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Status & Loaders
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Content Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiDraft, setAiDraft] = useState<any | null>(null);

  // Preview Modal
  const [previewPost, setPreviewPost] = useState<BlogPost | null>(null);

  // -------------------------------------------------------------
  // HANDLERS: Navigation & Form Controls
  // -------------------------------------------------------------
  const handleCreateNew = () => {
    setActivePost({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      status: "draft",
      featured_image: "",
      author: "Admin",
      category: "General",
      tags: [],
      seo_title: "",
      meta_description: "",
      focus_keyword: "",
      canonical_url: "",
      og_title: "",
      og_description: "",
      og_image: "",
      robots_config: "index, follow",
    });
    setTagInput("");
    setViewMode("editor");
  };

  const handleEditPost = (post: BlogPost) => {
    setActivePost(post);
    setTagInput((post.tags || []).join(", "));
    setViewMode("editor");
  };

  const handleTitleChange = (val: string) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setActivePost((prev) => ({
      ...prev,
      title: val,
      slug: prev.slug && prev.slug !== "" ? prev.slug : autoSlug,
      seo_title: prev.seo_title || val,
      og_title: prev.og_title || val,
    }));
  };

  // -------------------------------------------------------------
  // HANDLERS: Save & Delete API Calls
  // -------------------------------------------------------------
  const handleSavePost = async (targetStatus?: "draft" | "published") => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const status = targetStatus || activePost.status || "draft";
      const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);

      const payload = {
        ...activePost,
        status,
        tags,
      };

      const isUpdate = Boolean(activePost.id);
      const url = isUpdate
        ? `/api/websites/${website.id}/blog/${activePost.id}`
        : `/api/websites/${website.id}/blog`;

      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save blog post.");
      }

      if (data.post) {
        setPosts((prev) => {
          const filtered = prev.filter((p) => p.id !== data.post.id);
          return [data.post, ...filtered];
        });
        setActivePost(data.post);
      }

      setSuccessMessage(`Blog post ${status === "published" ? "published live" : "saved as draft"} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setViewMode("list");
      router.refresh();
    } catch (err: any) {
      console.error("Save Post Error:", err);
      setErrorMessage(err.message || "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublishState = async (post: BlogPost) => {
    try {
      setErrorMessage(null);
      const newStatus = post.status === "published" ? "draft" : "published";

      const res = await fetch(`/api/websites/${website.id}/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle status.");

      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
      setSuccessMessage(`Post updated to ${newStatus}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to toggle status.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${website.id}/blog/${postId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete post.");

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setShowDeleteModal(null);
      setSuccessMessage("Blog post deleted successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete post.");
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS: AI Blog Content Generation
  // -------------------------------------------------------------
  const handleGenerateAiBlog = async () => {
    if (!aiTopic.trim()) return;
    try {
      setIsGeneratingAi(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${website.id}/blog/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Generation failed.");

      if (data.draft) {
        setAiDraft(data.draft);
      }
      if (typeof data.remainingCredits === "number") {
        setCredits(data.remainingCredits);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate AI content.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiDraft = () => {
    if (!aiDraft) return;

    setActivePost((prev) => ({
      ...prev,
      title: aiDraft.title || prev.title,
      slug: aiDraft.slug || prev.slug,
      excerpt: aiDraft.excerpt || prev.excerpt,
      content: aiDraft.content || prev.content,
      category: aiDraft.category || prev.category,
      tags: aiDraft.tags || prev.tags,
      seo_title: aiDraft.seo_title || aiDraft.title,
      meta_description: aiDraft.meta_description || aiDraft.excerpt,
      focus_keyword: aiDraft.focus_keyword || prev.focus_keyword,
    }));

    if (Array.isArray(aiDraft.tags)) {
      setTagInput(aiDraft.tags.join(", "));
    }

    setIsAiModalOpen(false);
    setAiDraft(null);
    setAiTopic("");
    setViewMode("editor");
  };

  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-500 hover:text-rose-900">
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-500 hover:text-emerald-900">
            ×
          </button>
        </div>
      )}

      {/* VIEW MODE 1: BLOG POSTS LIST */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Content & Blog Articles</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create and manage SEO-optimized blog posts for {website.title}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="flex-1 sm:flex-none py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate with SEO AI</span>
              </button>

              <button
                onClick={handleCreateNew}
                className="flex-1 sm:flex-none py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Article</span>
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by title or category..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total: {filteredPosts.length} article(s)
            </span>
          </div>

          {/* Posts Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {filteredPosts.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Newspaper className="w-10 h-10 text-purple-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No Blog Posts Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Get started by creating your first article manually or generating a brand post with SEO AI.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setIsAiModalOpen(true)}
                    className="px-3.5 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700"
                  >
                    Generate with SEO AI
                  </button>
                  <button
                    onClick={handleCreateNew}
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
                  >
                    Write Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-bold">
                      <th className="py-3 px-4">Title & Slug</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Author</th>
                      <th className="py-3 px-4">Updated</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{post.title}</div>
                          <div className="text-[11px] font-mono text-purple-700 truncate">/blog/{post.slug}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {post.status === "published" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Published
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {post.category || "General"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {post.author || "Admin"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(post.updated_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleTogglePublishState(post)}
                              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all border ${
                                post.status === "published"
                                  ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              {post.status === "published" ? "Unpublish" : "Publish"}
                            </button>

                            {post.status === "published" && website.published_slug && (
                              <a
                                href={`/site/${website.published_slug}/blog/${post.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                                title="Preview Live Post"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              onClick={() => handleEditPost(post)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-purple-700"
                              title="Edit Article"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setShowDeleteModal(post.id)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-rose-600"
                              title="Delete Article"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: ARTICLE EDITOR & SEO PANEL */}
      {viewMode === "editor" && (
        <div className="space-y-6">
          {/* Top Back Navigation Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Articles</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSavePost("draft")}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>

              <button
                onClick={() => handleSavePost("published")}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span>Publish Live</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 cols): Article Editor */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Article Content</span>
                </h3>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Article Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activePost.title || ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g., Best Used SUVs in Dubai for 2026"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Slug
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-xs font-mono text-slate-500">
                      /blog/
                    </span>
                    <input
                      type="text"
                      value={activePost.slug || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="best-used-suvs-dubai"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-r-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Excerpt / Short Summary
                  </label>
                  <textarea
                    rows={2}
                    value={activePost.excerpt || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, excerpt: e.target.value }))}
                    placeholder="Brief 2-sentence summary of the article..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Content Editor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Article Body (HTML / Formatted Content)
                  </label>

                  {/* Formatting Toolbar Shortcuts */}
                  <div className="flex items-center gap-1.5 p-2 bg-slate-100 border border-b-0 border-slate-200 rounded-t-xl text-xs flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<h2>Heading 2</h2>\n" }))}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded font-bold text-slate-700 text-[11px]"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<h3>Heading 3</h3>\n" }))}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded font-bold text-slate-700 text-[11px]"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<p>Paragraph text here...</p>\n" }))}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded font-medium text-slate-700 text-[11px]"
                    >
                      Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ul>\n" }))}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded text-slate-700 text-[11px]"
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<blockquote>Key takeaway quote...</blockquote>\n" }))}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded text-slate-700 text-[11px]"
                    >
                      Quote
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={activePost.content || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="<p>Write your article body here...</p>"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-b-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 leading-relaxed"
                  />
                </div>
              </div>

              {/* Taxonomy & Author Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-600" />
                  <span>Category, Tags & Author</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={activePost.category || "General"}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Author</label>
                    <input
                      type="text"
                      value={activePost.author || "Admin"}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="SEO, Dubai, Cars"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Featured Image HTTPS URL</label>
                  <input
                    type="text"
                    value={activePost.featured_image || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, featured_image: e.target.value }))}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Right Column (1 col): SEO Settings Panel */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-purple-600" />
                    <span>Page SEO Settings</span>
                  </span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Live Guidance
                  </span>
                </h3>

                {/* SEO Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">SEO Title</label>
                    <span className="text-[10px] text-slate-400">{(activePost.seo_title || "").length}/60</span>
                  </div>
                  <input
                    type="text"
                    value={activePost.seo_title || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, seo_title: e.target.value }))}
                    placeholder="SEO Title | Brand"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Meta Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Meta Description</label>
                    <span className="text-[10px] text-slate-400">{(activePost.meta_description || "").length}/160</span>
                  </div>
                  <textarea
                    rows={3}
                    value={activePost.meta_description || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, meta_description: e.target.value }))}
                    placeholder="Meta description for search engines..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Focus Keyword */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Focus Keyword</label>
                  <input
                    type="text"
                    value={activePost.focus_keyword || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, focus_keyword: e.target.value }))}
                    placeholder="e.g., used cars Dubai"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Canonical URL (Optional)</label>
                  <input
                    type="text"
                    value={activePost.canonical_url || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, canonical_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Open Graph Meta */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">Social / Open Graph</h4>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">OG Title</label>
                    <input
                      type="text"
                      value={activePost.og_title || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, og_title: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">OG Description</label>
                    <textarea
                      rows={2}
                      value={activePost.og_description || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, og_description: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DELETE CONFIRMATION */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Blog Article?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete this article? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePost(showDeleteModal)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Article"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GENERATE WITH SEO AI */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-purple-50 via-white to-purple-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Generate Article with SEO AI</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {!aiDraft ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Enter Topic or Blog Title
                    </label>
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="e.g., Best Used Luxury SUVs to Buy in Dubai"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      SEO AI will analyze your website context, business prompt, and focus keywords to draft a high-quality article.
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
                    <span>AI Credit Cost: <strong>5 Credits</strong></span>
                    <span>Your Balance: <strong>{credits} Credits</strong></span>
                  </div>
                </>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>AI Draft Generated! Review the content below before adding to your editor.</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">Title:</span>
                    <span className="font-bold text-slate-900">{aiDraft.title}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">Excerpt:</span>
                    <p className="text-slate-600">{aiDraft.excerpt}</p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">SEO Title:</span>
                    <span className="text-purple-700 font-semibold">{aiDraft.seo_title}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">Meta Description:</span>
                    <span className="text-slate-600">{aiDraft.meta_description}</span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">Focus Keyword:</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-semibold rounded">{aiDraft.focus_keyword}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                Close
              </button>

              {!aiDraft ? (
                <button
                  onClick={handleGenerateAiBlog}
                  disabled={isGeneratingAi || !aiTopic.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Article...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Article (5 Credits)</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAiDraft(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleApplyAiDraft}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm"
                  >
                    Use This Content
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
