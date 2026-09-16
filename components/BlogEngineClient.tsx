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
  ArrowRight,
  Share2,
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
    <div className="space-y-8">
      {/* Notifications Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-500 hover:text-rose-900 text-base">
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-500 hover:text-emerald-900 text-base">
            ×
          </button>
        </div>
      )}

      {/* VIEW MODE 1: BLOG POSTS LIST DASHBOARD */}
      {viewMode === "list" && (
        <div className="space-y-8">
          {/* Hero Header Command Banner */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                  SEO Content Engine
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Balance: <strong className="text-purple-600 font-mono">{credits}</strong> Credits
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Content & Blog Workspace
              </h2>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                Create, edit, manage, and publish SEO-optimized articles for <strong className="text-slate-800">{website.title}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap w-full md:w-auto shrink-0">
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="flex-1 md:flex-none h-11 sm:h-12 px-5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md shadow-purple-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate with SEO AI</span>
              </button>

              <button
                onClick={handleCreateNew}
                className="flex-1 md:flex-none h-11 sm:h-12 px-5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Article</span>
              </button>
            </div>
          </div>

          {/* Search & Article Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by title or category..."
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                Total: <strong className="text-purple-700">{filteredPosts.length}</strong> article(s)
              </span>
            </div>
          </div>

          {/* Posts Table / Cards Container */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            {filteredPosts.length === 0 ? (
              <div className="p-12 sm:p-16 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto text-purple-600">
                  <Newspaper className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">No Blog Articles Found</h3>
                  <p className="text-sm font-medium text-slate-500 max-w-md mx-auto leading-relaxed">
                    Get started by writing your first article manually or generating a brand new post with Codeaxys SEO AI.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-3">
                  <button
                    onClick={() => setIsAiModalOpen(true)}
                    className="h-11 px-5 bg-purple-600 text-white font-bold text-sm rounded-xl hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate with SEO AI</span>
                  </button>
                  <button
                    onClick={handleCreateNew}
                    className="h-11 px-5 bg-slate-100 text-slate-800 font-bold text-sm rounded-xl hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-slate-600" />
                    <span>Write Manually</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 text-xs font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Title & Slug</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Category</th>
                      <th className="py-4 px-6">Author</th>
                      <th className="py-4 px-6">Updated</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-4 px-6 max-w-sm">
                          <div className="font-bold text-slate-900 text-base line-clamp-1">{post.title}</div>
                          <div className="text-xs font-mono font-semibold text-purple-700 truncate mt-0.5">/blog/{post.slug}</div>
                        </td>
                        <td className="py-4 px-6">
                          {post.status === "published" ? (
                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Published Live
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" /> Draft
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-700">
                          {post.category || "General"}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {post.author || "Admin"}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                          {new Date(post.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTogglePublishState(post)}
                              className={`h-9 px-3.5 rounded-xl font-bold text-xs transition-all border shadow-2xs ${
                                post.status === "published"
                                  ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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
                                className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-purple-700 flex items-center justify-center transition-all shadow-2xs"
                                title="Preview Live Post"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            <button
                              onClick={() => handleEditPost(post)}
                              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                              title="Edit Article"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setShowDeleteModal(post.id)}
                              className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all shadow-2xs"
                              title="Delete Article"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* VIEW MODE 2: ARTICLE EDITOR WORKSPACE */}
      {viewMode === "editor" && (
        <div className="space-y-8">
          {/* Sticky Editor Action Navigation Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-20 z-20 backdrop-blur-md">
            <button
              onClick={() => setViewMode("list")}
              className="h-11 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700 transition-all flex items-center gap-2 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Articles</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                onClick={() => handleSavePost("draft")}
                disabled={isSaving}
                className="flex-1 sm:flex-none h-11 px-5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-all shadow-2xs"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>

              <button
                onClick={() => handleSavePost("published")}
                disabled={isSaving}
                className="flex-1 sm:flex-none h-11 px-5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>Publish Live</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left Column (8 cols): Article Main Editor Workspace */}
            <div className="xl:col-span-8 space-y-8">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow duration-200 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      Article Main Content Editor
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Write and format your article body
                    </p>
                  </div>
                </div>

                {/* Article Title (Prominent Display Field) */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Article Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activePost.title || ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g., Best Used SUVs in Dubai for 2026"
                    className="w-full h-13 px-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xl sm:text-2xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all placeholder:text-slate-400 placeholder:font-bold"
                  />
                </div>

                {/* URL Slug */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    URL Slug Path
                  </label>
                  <div className="flex items-center">
                    <span className="h-11 px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm font-mono text-slate-500 flex items-center shrink-0">
                      /blog/
                    </span>
                    <input
                      type="text"
                      value={activePost.slug || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="best-used-suvs-dubai"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-r-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>
                </div>

                {/* Excerpt / Summary */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Excerpt / Short Summary
                  </label>
                  <textarea
                    rows={2}
                    value={activePost.excerpt || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, excerpt: e.target.value }))}
                    placeholder="Brief 2-sentence summary of the article..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>

                {/* Content Body Editor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Article Body (HTML / Formatted Content)
                  </label>

                  {/* Formatting Toolbar Shortcuts */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-100/90 border border-b-0 border-slate-200/90 rounded-t-xl text-xs flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<h2>Heading 2</h2>\n" }))}
                      className="h-8 px-3 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs shadow-2xs transition-all"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<h3>Heading 3</h3>\n" }))}
                      className="h-8 px-3 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs shadow-2xs transition-all"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<p>Paragraph text here...</p>\n" }))}
                      className="h-8 px-3 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg font-medium text-slate-700 text-xs shadow-2xs transition-all"
                    >
                      Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ul>\n" }))}
                      className="h-8 px-3 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold shadow-2xs transition-all"
                    >
                      Bullet List
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost((prev) => ({ ...prev, content: (prev.content || "") + "<blockquote>Key takeaway quote...</blockquote>\n" }))}
                      className="h-8 px-3 bg-white hover:bg-purple-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold shadow-2xs transition-all"
                    >
                      Quote
                    </button>
                  </div>

                  <textarea
                    rows={16}
                    value={activePost.content || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="<p>Write your article body here...</p>"
                    className="w-full h-[460px] sm:h-[520px] p-4 bg-slate-50/80 border border-slate-200/90 rounded-b-xl font-mono text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
              </div>

              {/* Category, Author, Tags & Featured Image Box */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Folder className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Category, Author & Media
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                    <input
                      type="text"
                      value={activePost.category || "General"}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Author</label>
                    <input
                      type="text"
                      value={activePost.author || "Admin"}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, author: e.target.value }))}
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tags (Comma-separated)</label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="SEO, Dubai, Cars"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Featured Image HTTPS URL</label>
                  <input
                    type="text"
                    value={activePost.featured_image || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, featured_image: e.target.value }))}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): SEO Settings Panel */}
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                      <Search className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Page SEO Settings
                    </h3>
                  </div>
                  <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                    Live Guidance
                  </span>
                </div>

                {/* SEO Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">SEO Title</label>
                    <span className="text-xs font-mono text-slate-400">{(activePost.seo_title || "").length}/60</span>
                  </div>
                  <input
                    type="text"
                    value={activePost.seo_title || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, seo_title: e.target.value }))}
                    placeholder="SEO Title | Brand"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>

                {/* Meta Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Meta Description</label>
                    <span className="text-xs font-mono text-slate-400">{(activePost.meta_description || "").length}/160</span>
                  </div>
                  <textarea
                    rows={3}
                    value={activePost.meta_description || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, meta_description: e.target.value }))}
                    placeholder="Meta description for search engines..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>

                {/* Focus Keyword */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Focus Keyword</label>
                  <input
                    type="text"
                    value={activePost.focus_keyword || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, focus_keyword: e.target.value }))}
                    placeholder="e.g., used cars Dubai"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Canonical URL (Optional)</label>
                  <input
                    type="text"
                    value={activePost.canonical_url || ""}
                    onChange={(e) => setActivePost((prev) => ({ ...prev, canonical_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                  />
                </div>

                {/* Open Graph Social Section */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Social / Open Graph</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">OG Title</label>
                    <input
                      type="text"
                      value={activePost.og_title || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, og_title: e.target.value }))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">OG Description</label>
                    <textarea
                      rows={2}
                      value={activePost.og_description || ""}
                      onChange={(e) => setActivePost((prev) => ({ ...prev, og_description: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg">Delete Blog Article?</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Are you sure you want to delete this blog post? This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                disabled={isDeleting}
                className="h-11 px-5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePost(showDeleteModal)}
                disabled={isDeleting}
                className="h-11 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GENERATE WITH SEO AI */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200/90 bg-gradient-to-r from-purple-50 via-white to-purple-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Generate Article with SEO AI</h3>
                  <p className="text-xs text-slate-500 font-medium">Auto-generate blog post draft using website context</p>
                </div>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {!aiDraft ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800">
                      Enter Article Topic or Target Title
                    </label>
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="e.g., Best Used Luxury SUVs to Buy in Dubai"
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200/90 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">
                      Codeaxys SEO AI will analyze your website context, business prompt, and focus keywords to draft a complete article.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50/80 border border-purple-200/90 rounded-xl text-sm font-bold text-purple-950 flex items-center justify-between">
                    <span>AI Credit Cost: <strong className="text-purple-700 font-mono">5 Credits</strong></span>
                    <span>Your Balance: <strong className="text-purple-700 font-mono">{credits} Credits</strong></span>
                  </div>
                </>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>AI Draft Generated! Review the generated details below.</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">Title:</span>
                      <span className="font-bold text-slate-900 text-base">{aiDraft.title}</span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">Excerpt:</span>
                      <p className="text-slate-600 font-medium">{aiDraft.excerpt}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">SEO Title:</span>
                      <span className="text-purple-700 font-semibold">{aiDraft.seo_title}</span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">Meta Description:</span>
                      <span className="text-slate-600">{aiDraft.meta_description}</span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">Focus Keyword:</span>
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-bold rounded-lg text-xs">{aiDraft.focus_keyword}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-sm font-bold text-slate-700 transition-all"
              >
                Close
              </button>

              {!aiDraft ? (
                <button
                  onClick={handleGenerateAiBlog}
                  disabled={isGeneratingAi || !aiTopic.trim()}
                  className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Article...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Article (5 Credits)</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAiDraft(null)}
                    className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleApplyAiDraft}
                    className="h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-md shadow-purple-600/20 flex items-center gap-2"
                  >
                    <span>Use Content in Editor</span>
                    <ArrowRight className="w-4 h-4" />
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
