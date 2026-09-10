"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { LandingView } from "@/components/LandingView";
import { GenerationModal } from "@/components/GenerationModal";
import { LivePreview } from "@/components/LivePreview";
import { RightSidebar } from "@/components/RightSidebar";
import { SaveState } from "@/components/SaveStatus";
import { GeneratedFile, WebsitePlan, GenerationResponse, UploadedImage } from "@/lib/types";

export default function Home() {
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

  // Load saved website if ?id=... query parameter exists in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get("id");

    if (idParam && idParam !== currentWebsiteId) {
      loadSavedWebsite(idParam);
    }
  }, []);

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

  const executeGeneration = async (promptToRun: string) => {
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

  const handleEdit = async (instruction: string) => {
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

  const handleDownloadSingleFile = (fileName: string, content: string) => {
    if (!content) return;
    const mimeType = fileName.endsWith(".html")
      ? "text/html"
      : fileName.endsWith(".css")
      ? "text/css"
      : fileName.endsWith(".json")
      ? "application/json"
      : "application/javascript";

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllFiles = () => {
    if (files.length === 0) return;
    files.forEach((f) => {
      handleDownloadSingleFile(f.path, f.content);
    });
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
        onDownloadAll={handleDownloadAllFiles}
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
              onDownloadSingleFile={handleDownloadSingleFile}
              onDownloadAllFiles={handleDownloadAllFiles}
              uploadedImages={uploadedImages}
              onAddImages={handleAddImages}
              onRemoveImage={handleRemoveImage}
            />
          </>
        )}
      </main>
    </div>
  );
}
