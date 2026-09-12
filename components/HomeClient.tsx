"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getAuthRedirectUrl } from "@/utils/supabase/client";
import { Header } from "@/components/Header";
import { LandingView } from "@/components/LandingView";
import { GenerationModal } from "@/components/GenerationModal";
import { LivePreview } from "@/components/LivePreview";
import { RightSidebar } from "@/components/RightSidebar";
import { CodeaxysAIAssistant } from "@/components/CodeaxysAIAssistant";
import { SaveState } from "@/components/SaveStatus";
import { GeneratedFile, WebsitePlan, GenerationResponse, UploadedImage } from "@/lib/types";
import { Sparkles, LogIn, X, ArrowRight, Loader2 } from "lucide-react";

export function HomeClient() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>(
    "Create a premium luxury car showroom website called Velocity Motors."
  );
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [plan, setPlan] = useState<WebsitePlan | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [currentWebsiteId, setCurrentWebsiteId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoadingSavedWebsite, setIsLoadingSavedWebsite] = useState<boolean>(false);
  const [generationStage, setGenerationStage] = useState<
    "idle" | "planning" | "generating" | "complete" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Authentication State & Auth Modal
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  // Track Supabase Auth State & Pending Prompt Execution
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        const currentUser = data?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAndExecutePendingPrompt(currentUser);
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_: any, session: any) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAndExecutePendingPrompt(currentUser);
        }
      });

      return () => {
        listener?.subscription?.unsubscribe();
      };
    } catch (e) {
      // Ignore auth initialization errors
    }
  }, []);

  // Load saved website if ?id=... query parameter exists
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get("id");

    if (idParam && idParam !== currentWebsiteId) {
      loadSavedWebsite(idParam);
    }
  }, []);

  const checkAndExecutePendingPrompt = (authenticatedUser: any) => {
    if (typeof window === "undefined") return;
    const pendingPrompt = sessionStorage.getItem("pending_prompt");
    if (pendingPrompt && pendingPrompt.trim()) {
      sessionStorage.removeItem("pending_prompt");
      setPrompt(pendingPrompt);
      executeGeneration(pendingPrompt, authenticatedUser);
    }
  };

  const loadSavedWebsite = async (id: string) => {
    setIsLoadingSavedWebsite(true);
    setError(null);

    try {
      const response = await fetch(`/api/websites/${id}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Failed to load saved website.");
        return;
      }

      if (data.website) {
        setCurrentWebsiteId(data.website.id);
        setIsPublished(Boolean(data.website.is_published));
        setPublishedSlug(data.website.published_slug || null);
        if (data.prompt) setPrompt(data.prompt);
        if (data.plan) setPlan(data.plan);
        if (data.files && data.files.length > 0) {
          setFiles(data.files);
          setGenerationStage("complete");
          setIsSidebarOpen(true);
        }
      }
    } catch (err: any) {
      console.error("Failed to load saved website:", err);
      setError("Could not load the requested website.");
    } finally {
      setIsLoadingSavedWebsite(false);
    }
  };

  const autoSaveWebsite = async (
    targetFiles: GeneratedFile[],
    targetPlan: WebsitePlan | null,
    targetPrompt: string,
    existingId: string | null
  ) => {
    if (!user) return;
    setSaveState("saving");

    try {
      const response = await fetch("/api/websites/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: existingId || undefined,
          prompt: targetPrompt,
          plan: targetPlan,
          files: targetFiles,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.websiteId) {
        setCurrentWebsiteId(data.websiteId);
        setSaveState("saved");
        if (typeof window !== "undefined") {
          const newUrl = `${window.location.pathname}?id=${data.websiteId}`;
          window.history.replaceState({ path: newUrl }, "", newUrl);
        }
        setTimeout(() => setSaveState("idle"), 2500);
      } else {
        setSaveState("error");
      }
    } catch (e) {
      console.warn("Background auto-save failed:", e);
      setSaveState("error");
    }
  };

  const handleAddImages = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);

    filesArray.forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        const base64 = dataUrl.split(",")[1];
        const newImg: UploadedImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          mimeType: file.type,
          base64: base64,
          dataUrl: dataUrl,
        };

        setUploadedImages((prev) => [...prev, newImg]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const executeGeneration = async (promptToRun: string, overrideUser?: any) => {
    const activeUser = overrideUser || user;

    // STRICT AUTHENTICATION REQUIREMENT BEFORE GENERATION
    if (!activeUser) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_prompt", promptToRun);
      }
      setIsAuthModalOpen(true);
      return;
    }

    if (!promptToRun.trim() || isGenerating || isEditing) return;

    setIsGenerating(true);
    setError(null);
    setGenerationStage("planning");

    try {
      const timer = setTimeout(() => {
        setGenerationStage("generating");
      }, 1800);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToRun,
          images: uploadedImages,
          websiteId: currentWebsiteId || undefined,
        }),
      });

      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 401) {
          setIsAuthModalOpen(true);
          return;
        }
        const cleanMsg = formatCleanErrorMessage(data.error);
        setError(cleanMsg);
        setGenerationStage("error");
        return;
      }

      const res = data as GenerationResponse & { websiteId?: string };
      const newPlan = res.plan || null;
      const newFiles = res.files || [];

      setPlan(newPlan);
      setFiles(newFiles);
      setGenerationStage("complete");
      setIsSidebarOpen(true);

      if (res.websiteId) {
        setCurrentWebsiteId(res.websiteId);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2500);
      } else if (newFiles.length > 0) {
        autoSaveWebsite(newFiles, newPlan, promptToRun, currentWebsiteId);
      }
    } catch (err: any) {
      console.error("Client Generation Error:", err);
      setError(formatCleanErrorMessage(err));
      setGenerationStage("error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    executeGeneration(prompt);
  };

  const handleSelectSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt);
    executeGeneration(samplePrompt);
  };

  const handleGoogleLoginInModal = async () => {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      });
    } catch (err) {
      setGoogleLoading(false);
    }
  };

  const handleEdit = async (instruction: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!instruction.trim() || files.length === 0 || isEditing || isGenerating) return;

    setIsEditing(true);
    setError(null);

    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          instruction,
          images: uploadedImages,
          websiteId: currentWebsiteId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 401) {
          setIsAuthModalOpen(true);
          return;
        }
        setError(formatCleanErrorMessage(data.error));
        return;
      }

      const res = data as GenerationResponse;
      const updatedPlan = res.plan || plan;
      const updatedFiles = res.files && res.files.length > 0 ? res.files : files;

      if (res.plan) setPlan(res.plan);
      if (res.files && res.files.length > 0) setFiles(res.files);

      autoSaveWebsite(updatedFiles, updatedPlan, prompt, currentWebsiteId);
    } catch (err: any) {
      console.error("Client Edit Error:", err);
      setError(formatCleanErrorMessage(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleNewProject = () => {
    setFiles([]);
    setPlan(null);
    setUploadedImages([]);
    setCurrentWebsiteId(null);
    setIsPublished(false);
    setPublishedSlug(null);
    setSaveState("idle");
    setError(null);
    setGenerationStage("idle");

    if (typeof window !== "undefined") {
      window.history.replaceState({ path: "/" }, "", "/");
    }
  };

  function formatCleanErrorMessage(err: any): string {
    let msg = typeof err === "string" ? err : err?.message || "An unexpected error occurred.";
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch (e) {}
    if (msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE")) {
      return "The AI engine is currently experiencing high demand. Please wait a moment and try generating again.";
    }
    if (msg.includes("429") || msg.includes("Quota exceeded")) {
      return "AI Engine rate limit exceeded. Please wait a moment and try again.";
    }
    return msg;
  }

  const hasGeneratedWebsite = files.length > 0;

  return (
    <div className={`flex flex-col bg-white text-slate-900 font-sans relative ${hasGeneratedWebsite ? "h-screen w-screen overflow-hidden" : "min-h-screen w-full"}`}>
      {/* Light SaaS Header Navigation */}
      <Header
        onNewProject={handleNewProject}
        onEditPrompt={() => {
          if (!hasGeneratedWebsite) return;
          setIsSidebarOpen(true);
        }}
        onRegenerate={handleGenerate}
        isGenerating={isGenerating || isEditing}
        hasFiles={hasGeneratedWebsite}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        websiteId={currentWebsiteId}
        isPublished={isPublished}
        publishedSlug={publishedSlug}
        saveState={saveState}
        onPublishStatusChange={(pub, slug) => {
          setIsPublished(pub);
          if (slug) setPublishedSlug(slug);
        }}
      />

      {/* Light Step Loader Modal */}
      <GenerationModal isOpen={isGenerating || isLoadingSavedWebsite} stage={isLoadingSavedWebsite ? "planning" : generationStage} />

      {/* Main Content Workspace */}
      <main className={`flex-1 flex relative bg-white ${hasGeneratedWebsite ? "overflow-hidden" : "w-full"}`}>
        {!hasGeneratedWebsite ? (
          /* Initial Light Landing Hero View */
          <LandingView
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={handleGenerate}
            onSelectSamplePrompt={handleSelectSamplePrompt}
            isGenerating={isGenerating || isLoadingSavedWebsite}
            error={error}
            uploadedImages={uploadedImages}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
          />
        ) : (
          /* Workspace View: Light Preview Canvas + Collapsible White Right Sidebar */
          <>
            <LivePreview files={files} isGenerating={isGenerating || isEditing} />

            <RightSidebar
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen((prev) => !prev)}
              files={files}
              plan={plan}
              onEdit={handleEdit}
              isEditing={isEditing}
              isGenerating={isGenerating}
              uploadedImages={uploadedImages}
              onAddImages={handleAddImages}
              onRemoveImage={handleRemoveImage}
            />
          </>
        )}
      </main>

      {/* Floating Codeaxys AI Personal Guide Assistant */}
      <CodeaxysAIAssistant onUsePrompt={(p) => setPrompt(p)} />

      {/* Customer-Friendly Auth Required Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
            {/* Close Button */}
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header / Branding */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Please log in to create your website
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
                Sign in to generate, customize, and save your AI websites to your dashboard.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              {/* Primary Action: Log in with Google */}
              <button
                onClick={handleGoogleLoginInModal}
                disabled={googleLoading}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-slate-800 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 hover:border-purple-200 transition-all flex items-center justify-center gap-3 shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.3s.7 5.6 1.9 8l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                )}
                <span>Log in with Google</span>
              </button>

              {/* Secondary Action: Email Sign In */}
              <Link
                href="/login"
                onClick={() => setIsAuthModalOpen(false)}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-600/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in with Email</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
