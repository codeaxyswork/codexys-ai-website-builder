"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Header } from "@/components/Header";
import { LandingView } from "@/components/LandingView";
import { GenerationModal } from "@/components/GenerationModal";
import { LivePreview } from "@/components/LivePreview";
import { RightSidebar } from "@/components/RightSidebar";
import { CodeaxysAIAssistant } from "@/components/CodeaxysAIAssistant";
import { SaveState } from "@/components/SaveStatus";
import { GeneratedFile, WebsitePlan, GenerationResponse, UploadedImage } from "@/lib/types";
import { isValidTemplateId } from "@/lib/auth-redirect";
import { AutoSaveEngine, getLocalDraft, clearLocalDraft } from "@/lib/autosave-manager";

export function HomeClient() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>("");
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

  // Authentication State
  const [user, setUser] = useState<any>(null);

  // AutoSave Engine Reference
  const autoSaveEngineRef = useRef<AutoSaveEngine | null>(null);

  useEffect(() => {
    autoSaveEngineRef.current = new AutoSaveEngine({
      onStatusChange: (status) => setSaveState(status),
      onSaveSuccess: ({ websiteId }) => {
        setCurrentWebsiteId(websiteId);
        if (typeof window !== "undefined") {
          const newUrl = `${window.location.pathname}?id=${websiteId}`;
          window.history.replaceState({ path: newUrl }, "", newUrl);
        }
      },
    });

    return () => {
      autoSaveEngineRef.current?.destroy();
    };
  }, []);

  function autoSaveWebsite(
    targetFiles: GeneratedFile[],
    targetPlan: WebsitePlan | null,
    targetPrompt: string,
    existingId: string | null,
    immediate: boolean = true
  ) {
    autoSaveEngineRef.current?.triggerSave(
      targetFiles,
      targetPlan,
      targetPrompt,
      existingId,
      immediate
    );
  }

  async function loadTemplate(templateId: string) {
    setIsLoadingSavedWebsite(true);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(templateId)}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Failed to load selected template.");
        return;
      }

      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        setPlan(data.plan || null);
        const promptText = data.template?.name
          ? `Template: ${data.template.name} (${data.template.category})`
          : "Selected Template";
        setPrompt(promptText);
        setGenerationStage("complete");
        setIsSidebarOpen(true);

        // Immediately buffer in local draft and trigger background save
        autoSaveWebsite(data.files, data.plan || null, promptText, null, false);
      }
    } catch (err: unknown) {
      console.error("Failed to load selected template:", err);
      setError("Could not load the selected template.");
    } finally {
      setIsLoadingSavedWebsite(false);
    }
  }

  async function loadSavedWebsite(id: string) {
    setIsLoadingSavedWebsite(true);
    setError(null);

    try {
      const response = await fetch(`/api/websites/${id}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        // Fallback: check local draft if network failed
        const localDraft = getLocalDraft(id);
        if (localDraft && localDraft.files && localDraft.files.length > 0) {
          setCurrentWebsiteId(id);
          if (localDraft.prompt) setPrompt(localDraft.prompt);
          if (localDraft.plan) setPlan(localDraft.plan);
          setFiles(localDraft.files);
          setGenerationStage("complete");
          setIsSidebarOpen(true);
          setSaveState("offline");
          return;
        }
        setError(data.error || "Failed to load saved website.");
        return;
      }

      if (data.website) {
        setCurrentWebsiteId(data.website.id);
        setIsPublished(Boolean(data.website.is_published));
        setPublishedSlug(data.website.published_slug || null);
        if (data.prompt) setPrompt(data.prompt);
        if (data.plan) setPlan(data.plan);

        // Check if there is a newer local un-synced draft
        const localDraft = getLocalDraft(data.website.id);
        const serverUpdatedAt = new Date(data.website.updated_at || 0).getTime();

        if (localDraft && localDraft.timestamp > serverUpdatedAt && localDraft.files?.length > 0) {
          console.log("[Autosave] Restoring newer un-synced local draft...");
          setFiles(localDraft.files);
          if (localDraft.plan) setPlan(localDraft.plan);
          if (localDraft.prompt) setPrompt(localDraft.prompt);
        } else if (data.files && data.files.length > 0) {
          setFiles(data.files);
        }

        setGenerationStage("complete");
        setIsSidebarOpen(true);
      }
    } catch (err: unknown) {
      console.error("Failed to load saved website:", err);
      // Fallback: try local draft
      const localDraft = getLocalDraft(id);
      if (localDraft && localDraft.files && localDraft.files.length > 0) {
        setCurrentWebsiteId(id);
        if (localDraft.prompt) setPrompt(localDraft.prompt);
        if (localDraft.plan) setPlan(localDraft.plan);
        setFiles(localDraft.files);
        setGenerationStage("complete");
        setIsSidebarOpen(true);
        setSaveState("offline");
        return;
      }
      setError("Could not load the requested website.");
    } finally {
      setIsLoadingSavedWebsite(false);
    }
  }

  function checkAndRestorePendingPrompt() {
    if (typeof window === "undefined") return;

    // Check pending template first
    const pendingTemplate = sessionStorage.getItem("pending_template");
    if (pendingTemplate && isValidTemplateId(pendingTemplate)) {
      sessionStorage.removeItem("pending_template");
      loadTemplate(pendingTemplate);
      return;
    }

    const pendingPrompt = sessionStorage.getItem("pending_prompt");
    if (pendingPrompt && pendingPrompt.trim()) {
      sessionStorage.removeItem("pending_prompt");
      setPrompt(pendingPrompt);
    }
  }

  // Track Supabase Auth State & Restore Pending Prompt Upon Login Return
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        const currentUser = data?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAndRestorePendingPrompt();
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_: any, session: any) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAndRestorePendingPrompt();
        }
      });

      return () => {
        listener?.subscription?.unsubscribe();
      };
    } catch (e) {
      // Ignore auth initialization errors
    }
  }, []);

  // Load saved website if ?id=... query parameter exists, or load template if ?template=... exists, or restore local draft
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get("id");
    const templateParam = urlParams.get("template");

    if (idParam && idParam !== currentWebsiteId) {
      loadSavedWebsite(idParam);
    } else if (templateParam && isValidTemplateId(templateParam)) {
      loadTemplate(templateParam);
    } else if (!idParam && !templateParam && files.length === 0) {
      // Check for recoverable draft
      const draft = getLocalDraft();
      if (draft && draft.files && draft.files.length > 0) {
        console.log("[Autosave] Restoring unsaved local project session...");
        setFiles(draft.files);
        if (draft.plan) setPlan(draft.plan);
        if (draft.prompt) setPrompt(draft.prompt);
        if (draft.websiteId) setCurrentWebsiteId(draft.websiteId);
        setGenerationStage("complete");
        setIsSidebarOpen(true);
      }
    }
  }, [currentWebsiteId, files.length]);

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

  const executeGeneration = async (promptToRun: string, conversationLangParam?: string, overrideUser?: any) => {
    const activeUser = overrideUser || user;

    // DIRECT REDIRECT TO LOGIN IF LOGGED OUT
    if (!activeUser) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_prompt", promptToRun);
      }
      router.push("/login?reason=generation_required");
      return;
    }

    if (!promptToRun.trim() || isGenerating || isEditing) return;

    setIsGenerating(true);
    setError(null);
    setGenerationStage("planning");

    const activeLang = conversationLangParam || (typeof window !== "undefined" ? localStorage.getItem("codeaxys_conversation_lang") : null) || "auto";

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
          conversationLanguage: activeLang,
        }),
      });

      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 401) {
          router.push("/login?reason=generation_required");
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
    } catch (err: unknown) {
      console.error("Client Generation Error:", err);
      setError(formatCleanErrorMessage(err));
      setGenerationStage("error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = (conversationLang?: string) => {
    executeGeneration(prompt, conversationLang);
  };

  const handleSelectSamplePrompt = (samplePrompt: string) => {
    setPrompt(samplePrompt);
    executeGeneration(samplePrompt);
  };

  const handleEdit = async (instruction: string, conversationLangParam?: string) => {
    if (!user) {
      router.push("/login?reason=generation_required");
      return;
    }

    if (!instruction.trim() || files.length === 0 || isEditing || isGenerating) return;

    setIsEditing(true);
    setError(null);

    const activeLang = conversationLangParam || (typeof window !== "undefined" ? localStorage.getItem("codeaxys_conversation_lang") : null) || "auto";

    try {
      // Pre-upload attached refinement images to Supabase Storage to get clean public HTTPS URLs
      let processedImages = uploadedImages;

      if (uploadedImages.length > 0) {
        processedImages = await Promise.all(
          uploadedImages.map(async (img) => {
            if (img.publicUrl) return img;
            try {
              const res = await fetch(img.dataUrl);
              const blob = await res.blob();
              const formData = new FormData();
              formData.append("file", blob, img.name);
              if (currentWebsiteId) {
                formData.append("websiteId", currentWebsiteId);
              }

              const uploadRes = await fetch("/api/media/upload", {
                method: "POST",
                body: formData,
              });

              const uploadData = await uploadRes.json();
              if (uploadRes.ok && uploadData.asset?.public_url) {
                return {
                  ...img,
                  publicUrl: uploadData.asset.public_url,
                };
              }
            } catch (upErr) {
              console.warn("Pre-upload of refinement image failed:", upErr);
            }
            return img;
          })
        );
      }

      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          plan,
          instruction,
          images: processedImages,
          websiteId: currentWebsiteId || undefined,
          conversationLanguage: activeLang,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        if (response.status === 401) {
          router.push("/login?reason=generation_required");
          return;
        }
        setError(formatCleanErrorMessage(data.error));
        return;
      }

      setError(null);
      const res = data as GenerationResponse;
      const updatedPlan = res.plan || plan;
      const updatedFiles = res.files && res.files.length > 0 ? res.files : files;

      if (res.plan) setPlan(res.plan);
      if (res.files && res.files.length > 0) setFiles(res.files);

      autoSaveWebsite(updatedFiles, updatedPlan, prompt, currentWebsiteId);
    } catch (err: unknown) {
      console.error("Client Edit Error:", err);
      setError(formatCleanErrorMessage(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleNewProject = () => {
    clearLocalDraft(currentWebsiteId);
    clearLocalDraft(null);
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
    if (msg.includes("WEBSITE_LIMIT_REACHED") || msg.includes("website limit")) {
      return "You've reached the website limit for your current plan. Your Free plan includes 1 website. You can continue editing your existing website from your Dashboard, or upgrade your plan to create more websites.";
    }
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
        files={files}
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
              error={error}
              websiteId={currentWebsiteId}
              isPublished={isPublished}
              publishedSlug={publishedSlug}
              saveState={saveState}
              onPublishStatusChange={(pub, slug) => {
                setIsPublished(pub);
                if (slug) setPublishedSlug(slug);
              }}
            />
          </>
        )}
      </main>

      {/* Floating Codeaxys AI Personal Guide Assistant */}
      <CodeaxysAIAssistant onUsePrompt={(p) => setPrompt(p)} />
    </div>
  );
}
