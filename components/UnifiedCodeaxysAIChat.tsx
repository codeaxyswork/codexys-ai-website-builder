"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Wand2,
  Copy,
  Check,
  Bot,
  RotateCcw,
  Globe,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  FileText,
  TrendingUp,
  Layout,
  Search,
  Megaphone,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Target,
  BarChart2,
  Activity,
} from "lucide-react";

import { StructuredSEOFix } from "@/lib/seo-agent";
import { SUPPORTED_LANGUAGES, getLanguageConfig } from "@/lib/multilingual";

export type UnifiedDomainMode = "general" | "website" | "seo" | "marketing";

export interface AgentIdentityConfig {
  title: string;
  subtitle: string;
  welcomeMessage: string;
  launcherPromptHint: string;
  quickStarters: Array<{ label: string; prompt: string }>;
  badgeText: string;
  icon: React.ElementType;
}

export const AGENT_IDENTITIES: Record<UnifiedDomainMode, AgentIdentityConfig> = {
  website: {
    title: "Codeaxys Website AI",
    subtitle: "Your AI website builder and design assistant",
    launcherPromptHint: "Ask or Speak Website Prompts",
    welcomeMessage:
      "Hi 👋 I'm Codeaxys Website AI.\n\nTell me what you're trying to build or improve, and I'll help turn your idea into a complete website layout!",
    quickStarters: [
      { label: "📄 Create a new page", prompt: "I want to create a new page for my website" },
      { label: "✨ Improve my homepage", prompt: "Can you help me improve my homepage design?" },
      { label: "🎨 Change hero section", prompt: "Can you change my hero section layout?" },
      { label: "📞 Add a contact section", prompt: "Add a contact section to my page" },
      { label: "📱 Make this mobile-friendly", prompt: "How can I make my website design mobile-friendly?" },
    ],
    badgeText: "AI Website Expert",
    icon: Layout,
  },
  seo: {
    title: "Codeaxys SEO AI",
    subtitle: "Your AI SEO, AEO, GEO & AI Search specialist",
    launcherPromptHint: "Ask or Speak Website Prompts",
    welcomeMessage:
      "Hi 👋 I'm Codeaxys SEO AI.\n\nI can analyze your website SEO, audit crawl issues, improve AI search visibility (ChatGPT/Perplexity), and apply automated SEO fixes.",
    quickStarters: [
      { label: "🌐 How is my website SEO?", prompt: "How is my website SEO health?" },
      { label: "🚨 What should I fix first?", prompt: "What critical SEO issues should I fix first?" },
      { label: "📈 Why isn't my page ranking?", prompt: "Why isn't my page ranking higher on Google?" },
      { label: "✍️ Improve my homepage SEO", prompt: "How can I improve my homepage SEO title and meta description?" },
      { label: "🤖 How can I appear in AI search?", prompt: "How ready is my site for ChatGPT and Perplexity AI search?" },
    ],
    badgeText: "AI SEO Specialist",
    icon: Search,
  },
  marketing: {
    title: "Codeaxys Marketing AI",
    subtitle: "Your AI growth, advertising & lead generation specialist",
    launcherPromptHint: "Ask or Speak Website Prompts",
    welcomeMessage:
      "Hi 👋 I'm Codeaxys Marketing AI.\n\nI already understand your business context and website. What would you like to achieve with your marketing today?",
    quickStarters: [
      { label: "🚀 Run Meta (Facebook & Instagram) ads", prompt: "I want to create a Facebook & Instagram ad campaign." },
      { label: "🎯 Get more leads for my business", prompt: "How can I get more consultation leads for my business?" },
      { label: "💰 Plan a ₹7,000 campaign", prompt: "Plan a ₹7,000 ad campaign for 7 days." },
      { label: "📊 How are my marketing campaigns performing?", prompt: "Show my recent ad campaign performance and spend." },
      { label: "💡 Why are my leads expensive?", prompt: "How can I optimize my ad cost per lead?" },
    ],
    badgeText: "AI Marketing Specialist",
    icon: Megaphone,
  },
  general: {
    title: "Codeaxys AI",
    subtitle: "Ask or Speak Website Prompts",
    launcherPromptHint: "Ask or Speak Website Prompts",
    welcomeMessage:
      "Hi 👋 I'm Codeaxys AI.\n\nTell me what you're trying to build, and I'll help turn your idea into a complete website prompt!",
    quickStarters: [
      { label: "🚀 Create website for Velocity Motors", prompt: "I need a luxury automotive website for Velocity Motors." },
      { label: "🇮🇳 oru luxury car showroom website venam", prompt: "oru luxury car showroom website venam" },
      { label: "✍️ Help me build a website prompt", prompt: "Can you guide me step-by-step to create my website prompt?" },
      { label: "🎨 Show luxury & dark style ideas", prompt: "What visual styles can you build for my company?" },
      { label: "⏰ How does 3-day website preview work?", prompt: "How does the 3-day website preview work?" },
    ],
    badgeText: "AI Assistant",
    icon: Sparkles,
  },
};

export interface UnifiedCodeaxysAIChatProps {
  mode?: UnifiedDomainMode;
  websiteId?: string;
  userPlan?: string;
  userCredits?: number;
  gscConnected?: boolean;
  onNavigateTab?: (tabId: string) => void;
  onUsePrompt?: (generatedPrompt: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isWidget?: boolean;
  title?: string;
  marketingOverview?: {
    campaignsCount?: number;
    activeLeadsCount?: number;
    totalSpend?: string;
    cpl?: string;
    hasAccount?: boolean;
  };
  seoOverview?: {
    seoScore?: number;
    criticalIssuesCount?: number;
    gscConnected?: boolean;
  };
  websiteOverview?: {
    totalPages?: number;
    isPublished?: boolean;
  };
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  domain?: UnifiedDomainMode;
  suggestedPrompt?: string | null;
  suggestedActions?: string[];
  navigationTarget?: string;
  proposedFix?: StructuredSEOFix | null;
  appliedFixState?: "idle" | "applying" | "applied" | "failed";
  oldScore?: number;
  newScore?: number;
  draftId?: string | null;
  proposedStrategy?: {
    objective?: string;
    targetAudience?: string;
    dailyBudget?: number | string;
    durationDays?: number;
    estimatedTotalBudget?: number | string;
    platforms?: string[];
    landingPageUrl?: string;
    status?: string;
  } | null;
  publishState?: "idle" | "reviewing" | "approving" | "publishing" | "published" | "failed";
  publishResult?: any | null;
  publishError?: string | null;
  timestamp: string;
}

export function UnifiedCodeaxysAIChat({
  mode = "general",
  websiteId,
  userPlan = "free",
  userCredits = 100,
  gscConnected = false,
  onNavigateTab,
  onUsePrompt,
  isOpen,
  onClose,
  isWidget = false,
  title,
  marketingOverview,
  seoOverview,
  websiteOverview,
}: UnifiedCodeaxysAIChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : internalIsOpen;

  const currentMode: UnifiedDomainMode = mode;
  const surfaceIdentity = AGENT_IDENTITIES[currentMode] || AGENT_IDENTITIES.general;
  const displayTitle = title && title !== "Codeaxys AI Assistant" ? title : surfaceIdentity.title;

  const [activeDomain, setActiveDomain] = useState<UnifiedDomainMode>(mode);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("auto");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("codeaxys_conversation_lang");
      if (saved) setSelectedLang(saved);
    } catch (e) {}
  }, []);

  const handleLangChange = (code: string) => {
    setSelectedLang(code);
    try {
      localStorage.setItem("codeaxys_conversation_lang", code);
      window.dispatchEvent(new CustomEvent("codeaxys_lang_changed", { detail: code }));
    } catch (e) {}
  };

  // Initialize Welcome Message tailored to Agent Surface Identity
  useEffect(() => {
    if (messages.length === 0) {
      const currentIdentity = AGENT_IDENTITIES[mode] || AGENT_IDENTITIES.general;
      setMessages([
        {
          id: "welcome-1",
          role: "assistant",
          domain: mode,
          text: currentIdentity.welcomeMessage,
          suggestedActions: currentIdentity.quickStarters.slice(0, 3).map((s) => s.label),
          timestamp: "Just now",
        },
      ]);
    }
  }, [mode]);

  // Sync mode prop with active domain indicator
  useEffect(() => {
    setActiveDomain(mode);
  }, [mode]);

  // Auto Scroll
  useEffect(() => {
    if (isCurrentlyOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isCurrentlyOpen]);

  // Handle drawer toggle
  const handleToggleOpen = (openState: boolean) => {
    if (onClose && !openState) {
      onClose();
    }
    setInternalIsOpen(openState);
  };

  // Clear Conversation
  const handleNewConversation = () => {
    const currentIdentity = AGENT_IDENTITIES[mode] || AGENT_IDENTITIES.general;
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        domain: mode,
        text: currentIdentity.welcomeMessage,
        suggestedActions: currentIdentity.quickStarters.slice(0, 3).map((s) => s.label),
        timestamp: "Just now",
      },
    ]);
    setErrorMessage(null);
  };

  // Voice Input Speech Recognition
  const handleToggleSpeech = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  // Submit Message
  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isLoading) return;

    setInputText("");
    setErrorMessage(null);

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      role: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build history payload for Phase A/B
      const historyPayload = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.text,
        }));

      // Determine appropriate API endpoint and request payload
      let apiUrl = "/api/ai/assistant";
      let requestBody: any = {
        userMessage: prompt,
        history: historyPayload,
        conversationLanguage: selectedLang,
      };

      if (websiteId && activeDomain === "seo") {
        apiUrl = `/api/websites/${websiteId}/seo/agent`;
        requestBody = {
          prompt,
          history: historyPayload,
          activeMode: activeDomain,
        };
      } else if (websiteId && activeDomain === "marketing") {
        apiUrl = `/api/websites/${websiteId}/marketing/agent`;
        requestBody = {
          prompt,
          history: historyPayload,
          activeMode: activeDomain,
        };
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const payload = data.response || data;

      // Extract Assistant Message Details
      const replyText = payload.text || payload.message || payload.reply || "I've processed your request!";
      const suggestedActions = payload.suggestedActions || (payload.suggestedPrompt ? ["Generate Website"] : []);
      const navTarget = payload.navigationTarget;
      const proposedFix = payload.proposedFix || null;
      const draftId = payload.draftId || payload.campaignDraftId || null;
      const proposedStrategy = payload.proposedStrategy || payload.strategyCard || null;

      // Detect response domain and update active capability indicator
      let responseDomain: UnifiedDomainMode = activeDomain;
      const lowerText = replyText.toLowerCase();
      if (lowerText.includes("website editor") || lowerText.includes("homepage") || lowerText.includes("page structure")) {
        responseDomain = "website";
      } else if (lowerText.includes("seo") || lowerText.includes("technical crawl") || lowerText.includes("google search")) {
        responseDomain = "seo";
      } else if (lowerText.includes("meta campaign") || lowerText.includes("ad strategy") || lowerText.includes("leads")) {
        responseDomain = "marketing";
      }

      setActiveDomain(responseDomain);

      // Construct strategy object if user requested campaign creation and backend didn't format card
      let formattedStrategy = proposedStrategy;
      if (!formattedStrategy && activeDomain === "marketing" && (prompt.toLowerCase().includes("campaign") || prompt.toLowerCase().includes("create") || prompt.toLowerCase().includes("ads"))) {
        formattedStrategy = {
          objective: "Lead Generation",
          targetAudience: "Local / Kerala Audience",
          dailyBudget: "₹1,000/day",
          durationDays: 7,
          estimatedTotalBudget: "₹7,000",
          platforms: ["Facebook", "Instagram"],
          landingPageUrl: "/contact",
          status: "DRAFT",
        };
      }

      const assistantMsg: ChatMessageItem = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        domain: responseDomain,
        text: replyText,
        suggestedActions,
        navigationTarget: navTarget,
        proposedFix,
        draftId: draftId || (formattedStrategy ? `draft_${Date.now()}` : null),
        proposedStrategy: formattedStrategy,
        appliedFixState: proposedFix ? "idle" : undefined,
        publishState: formattedStrategy || draftId ? "idle" : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn("Unified AIChat send error:", err);
      setErrorMessage("I'm having trouble processing that right now. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          domain: activeDomain,
          text: `⚠️ **Connection Issue**: ${err?.message || "I could not reach the Codeaxys AI service. Please check your network connection and try again."}`,
          suggestedActions: ["Try Again"],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit SEO Fix Action Execution
  const handleApplySEOFix = async (msgId: string, fix: StructuredSEOFix) => {
    if (!websiteId) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, appliedFixState: "applying" } : m))
    );

    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/agent/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedFix: fix }),
      });

      if (!res.ok) throw new Error("Failed to apply SEO fix");
      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                appliedFixState: "applied",
                oldScore: data.oldScore || 70,
                newScore: data.newScore || 85,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, appliedFixState: "failed" } : m))
      );
    }
  };

  // Explicit Meta Campaign Approval Action Execution
  const handleApproveMetaCampaign = async (msgId: string, draftId: string) => {
    if (!websiteId || !draftId) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, publishState: "approving" } : m))
    );

    try {
      const res = await fetch(`/api/websites/${websiteId}/marketing/plan/${draftId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Approval failed");
      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                publishState: "published",
                publishResult: data,
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                publishState: "failed",
                publishError: err?.message || "Meta approval failed",
              }
            : m
        )
      );
    }
  };

  const handleCopyPrompt = (promptText: string, id: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  // 1. CLOSED STATE: EXACT MATCH FOR LIVE CODEAXYS WEBSITE LAUNCHER & ANIMATION
  if (!isCurrentlyOpen) {
    return (
      <div
        className="fixed bottom-6 right-6 z-[9999] group cursor-pointer"
        style={{ position: "fixed", bottom: "24px", right: "24px", left: "auto", top: "auto", zIndex: 9999 }}
      >
        {/* Outer Animated Gradient Glow Aura */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-70 blur-sm animate-pulse transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

        {/* Main Launcher Pill Button */}
        <button
          id={`ai-launcher-${currentMode}`}
          onClick={() => handleToggleOpen(true)}
          className="relative flex items-center gap-3 px-5 py-3.5 rounded-full bg-slate-950 text-white shadow-2xl shadow-purple-900/60 hover:bg-purple-950 border-2 border-purple-500/70 ring-4 ring-purple-500/20 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden backdrop-blur-md"
          title={`Open ${displayTitle}`}
        >
          {/* Inner Shimmering Beam */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/20 via-fuchsia-500/20 to-indigo-600/20 animate-pulse pointer-events-none" />

          {/* Sparkles Icon Badge Container */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0 group-hover:rotate-6 transition-transform duration-300 border border-purple-400/40 relative z-10">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>

          {/* Title & Prompt Subtitle */}
          <div className="text-left relative z-10">
            <div className="text-sm font-extrabold tracking-tight flex items-center gap-1.5 text-white">
              <span>{displayTitle}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_8px_#34d399]" />
            </div>
            <div className="text-xs text-purple-200/90 font-medium">
              {surfaceIdentity.launcherPromptHint}
            </div>
          </div>
        </button>
      </div>
    );
  }

  // 2. OPEN STATE: EXACT MATCH FOR LIVE CODEAXYS WEBSITE DRAWER PANEL
  return (
    <div
      id={`ai-panel-${currentMode}`}
      className="fixed bottom-6 right-6 w-full sm:w-[420px] max-h-[85vh] h-[620px] z-[9999] rounded-3xl border border-purple-500/30 shadow-2xl shadow-purple-950/50 bg-white overflow-hidden flex flex-col transition-all duration-300 animate-in slide-in-from-right-5"
      style={{ position: "fixed", bottom: "24px", right: "24px", left: "auto", zIndex: 9999 }}
    >
      {/* HEADER: GLOSSY DARK SLATE-950 */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 border border-purple-400/30 flex items-center justify-center text-white shadow-sm shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold text-white tracking-tight">{displayTitle}</h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-900/80 border border-purple-500/30 text-purple-200">
                Guide
              </span>
            </div>
            <p className="text-[11px] text-purple-200/80 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span>Online • {surfaceIdentity.badgeText}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedLang}
            onChange={(e) => handleLangChange(e.target.value)}
            className="bg-purple-900/50 hover:bg-purple-900 text-purple-100 text-[11px] font-semibold rounded-lg px-2 py-1 border border-purple-500/30 outline-none cursor-pointer transition-colors"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                {lang.nativeName}
              </option>
            ))}
          </select>

          <button
            onClick={handleNewConversation}
            title="Reset Conversation"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-purple-900/60 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleToggleOpen(false)}
            title="Close Assistant"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-purple-900/60 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* MESSAGES FEED AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/80 scrollbar-thin scrollbar-thumb-purple-200">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-2.5`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4.5 h-4.5 text-white" />
                </div>
              )}

              <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%]`}>
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? "bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/20"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* CAMPAIGN REVIEW CARD */}
                  {msg.proposedStrategy && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-purple-50/90 border border-purple-200 text-slate-900 space-y-2.5">
                      <div className="flex items-center justify-between text-purple-700 font-bold text-xs border-b border-purple-200/60 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-purple-600" />
                          Campaign Strategy Card
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">
                          {msg.proposedStrategy.status || "DRAFT"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Objective</span>
                          <span className="font-bold text-slate-900">{msg.proposedStrategy.objective || "Lead Generation"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Audience</span>
                          <span className="font-bold text-slate-900">{msg.proposedStrategy.targetAudience || "Local / Kerala"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Daily Budget</span>
                          <span className="font-bold text-purple-700">{msg.proposedStrategy.dailyBudget || "₹1,000/day"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                          <span className="font-bold text-slate-900">{msg.proposedStrategy.durationDays || 7} days</span>
                        </div>
                      </div>

                      {msg.publishState === "published" ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Approved — Campaign is ready to launch.</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApproveMetaCampaign(msg.id, msg.draftId || `draft_${Date.now()}`)}
                          disabled={msg.publishState === "approving"}
                          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {msg.publishState === "approving" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Approving...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Approve Campaign</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Explicit SEO Fix Action Box */}
                  {msg.proposedFix && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-slate-900 space-y-2">
                      <div className="flex items-center justify-between text-emerald-800 font-bold text-xs border-b border-emerald-200/60 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Proposed SEO Fix
                        </span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono">Approval Needed</span>
                      </div>
                      <p className="text-xs text-slate-700">{msg.proposedFix.reason || msg.proposedFix.instruction}</p>

                      {msg.appliedFixState === "applied" ? (
                        <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-700" />
                          <span>SEO Fix Applied! Score updated to {msg.newScore || 85}.</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApplySEOFix(msg.id, msg.proposedFix!)}
                          disabled={msg.appliedFixState === "applying"}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {msg.appliedFixState === "applying" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Applying SEO Fix...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve & Apply SEO Fix</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {/* TYPING INDICATOR DOTS */}
        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-none p-3 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-xs text-slate-400 font-medium ml-1">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK STARTER CHIPS */}
      {messages.length <= 2 && (
        <div className="p-3 bg-purple-50/40 border-t border-b border-purple-100/60 shrink-0 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> QUICK ACTION STARTERS:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
            {surfaceIdentity.quickStarters.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(item.prompt)}
                disabled={isLoading}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-600 text-slate-700 hover:text-white border border-purple-200 hover:border-purple-600 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs text-left"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        {errorMessage && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`w-10 h-10 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                : "bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700 border border-slate-200 hover:border-purple-300"
            }`}
            title={isListening ? "Stop listening" : "Speak message"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            id="codeaxys-assistant-input"
            ref={textareaRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ask ${displayTitle} or describe your prompt...`}
            disabled={isLoading}
            className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md shadow-purple-600/30 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-2 px-1">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-purple-600" /> Type or Speak in Any Language
          </span>
          <span>Powered by Codeaxys</span>
        </div>
      </div>
    </div>
  );
}
