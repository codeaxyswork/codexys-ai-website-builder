"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Megaphone,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Search,
  Save,
  Building2,
  Camera,
  Sparkles,
  ChevronRight,
  Check,
  Target,
  DollarSign,
  FileText,
  Layers,
  Send,
  Palette,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  UploadCloud,
  ImageIcon,
  Plus,
} from "lucide-react";
import { MarketingAgentChat } from "@/components/MarketingAgentChat";

interface MarketingClientProps {
  website: any;
}

export function MarketingClient({ website }: MarketingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [isSavingSelection, setIsSavingSelection] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const hasAutoDiscoveredRef = useRef<boolean>(false);

  // Phase 3 States
  // Phase 3 & 4 States
  const [userGoal, setUserGoal] = useState<string>("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [missingQuestions, setMissingQuestions] = useState<string[]>([]);
  const [dailyBudgetInput, setDailyBudgetInput] = useState<string>("");
  const [durationInput, setDurationInput] = useState<string>("");
  const [planStrategy, setPlanStrategy] = useState<any>(null);
  const [activeAdTab, setActiveAdTab] = useState<number>(0);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

  // Campaign Editor Flow States: "strategy" | "editor" | "review" | "success"
  const [editorStep, setEditorStep] = useState<"strategy" | "editor" | "review" | "success">("strategy");
  const [editorValidationError, setEditorValidationError] = useState<string | null>(null);

  const [editorData, setEditorData] = useState<{
    campaignName: string;
    objective: string;
    specialAdCategory: string;
    buyingType: string;
    location: string;
    ageRange: string;
    gender: string;
    dailyBudget: number;
    durationDays: number;
    startDate: string;
    endDate: string;
    placements: string;
    audienceSummary: string;
    recommendedPage: string;
    selectedPage: string;
    leadDestination: string;
    selectedAdCopyIndex: number;
    adCopyVariations: Array<{
      headline: string;
      primaryText: string;
      description: string;
      cta: string;
      style?: string;
      targetPersona?: string;
    }>;
    selectedImageUrl: string;
  }>({
    campaignName: "Book Consultation - Best Naturopathy Centre Campaign",
    objective: "OUTCOME_LEADS",
    specialAdCategory: "NONE",
    buyingType: "AUCTION",
    location: "Kerala, India",
    ageRange: "21–55",
    gender: "All",
    dailyBudget: 1000,
    durationDays: 7,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    placements: "Automatic Placements (Recommended)",
    audienceSummary: "People interested in Naturopathy, Holistic Healthcare & Wellness in Kerala",
    recommendedPage: "/contact",
    selectedPage: "/contact",
    leadDestination: "Meta On-Facebook Instant Lead Form",
    selectedAdCopyIndex: 0,
    adCopyVariations: [
      {
        headline: "Book Consultation - Best Naturopathy Centre & Hosp",
        primaryText: "Transform your well-being with personalized Naturopathy & Holistic Healthcare Hospital services at Best Naturopathy Centre & Hospital in Kerala. Book your consultation today.",
        description: "Book your appointment.",
        cta: "Book Now",
        style: "Direct Response / High Intent",
        targetPersona: "Health & Wellness Seekers",
      },
      {
        headline: "Holistic Naturopathy Care in Kerala",
        primaryText: "Experience natural healing and wellness with expert naturopathy practitioners. Schedule your personalized health consultation today.",
        description: "Trusted naturopathy clinic.",
        cta: "Learn More",
        style: "Value & Benefit Focused",
        targetPersona: "Lifestyle & Preventive Care",
      },
      {
        headline: "Start Your Wellness Journey Today",
        primaryText: "Discover holistic treatments for chronic wellness challenges. Our naturopathy experts are here to guide your recovery.",
        description: "Instant appointment booking.",
        cta: "Contact Us",
        style: "Urgency & Outcome Focused",
        targetPersona: "Patients Seeking Natural Solutions",
      },
    ],
    selectedImageUrl: "",
  });

  // Media Asset Selector Modal States
  const [showMediaSelectorModal, setShowMediaSelectorModal] = useState<boolean>(false);
  const [isFetchingMedia, setIsFetchingMedia] = useState<boolean>(false);
  const [mediaAssetsList, setMediaAssetsList] = useState<Array<{
    id: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    storage_path: string;
    public_url: string;
    created_at: string;
  }>>([]);
  const [mediaSearchQuery, setMediaSearchQuery] = useState<string>("");
  const [tempSelectedAssetId, setTempSelectedAssetId] = useState<string>("");
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  // Phase 4 Publishing States
  const [draftId, setDraftId] = useState<string>("");
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState<boolean>(false);
  const [executionRecord, setExecutionRecord] = useState<any>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishingStepText, setPublishingStepText] = useState<string>("Preparing campaign...");
  const [publishResult, setPublishResult] = useState<any>(null);
  const [isSyncingStatus, setIsSyncingStatus] = useState<boolean>(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  // Phase 5 Lead Inbox & Phase 6 Analytics States
  const [activeSection, setActiveSection] = useState<"campaigns" | "leads" | "performance">("campaigns");
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<any | null>(null);
  const [leadNotesInput, setLeadNotesInput] = useState<string>("");

  // Phase 6 Analytics & AI Optimization States
  const [analyticsReport, setAnalyticsReport] = useState<any>(null);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState<boolean>(false);
  const [datePresetFilter, setDatePresetFilter] = useState<string>("last_30d");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [approvingRecId, setApprovingRecId] = useState<string | null>(null);

  const [metaStatus, setMetaStatus] = useState<{
    isConnected: boolean;
    connection: {
      provider: string;
      status: string;
      metaUserId: string | null;
      metaUserName: string | null;
      metaUserEmail: string | null;
      grantedScopes: string[];
      lastSyncedAt?: string;
      tokenExpiresAt?: number;
    } | null;
  }>({
    isConnected: false,
    connection: null,
  });

  const [assetData, setAssetData] = useState<{
    adAccounts: Array<{ id: string; name: string; accountStatus: number; currency: string; timezone: string; isSelected: boolean }>;
    pages: Array<{ id: string; name: string; category: string; accessStatus: string; isSelected: boolean }>;
    instagramAccounts: Array<{ id: string; username: string; name?: string; facebookPageId?: string; isSelected: boolean }>;
    selectedAdAccount: any;
    selectedPage: any;
    selectedInstagramAccount: any;
  } | null>(null);

  const [selectedAdId, setSelectedAdId] = useState<string>("");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedIgId, setSelectedIgId] = useState<string>("");

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/status`);
      const data = await res.json();

      if (res.ok && data.success) {
        const isConn = Boolean(data.isConnected);
        setMetaStatus({
          isConnected: isConn,
          connection: data.connection || null,
        });

        if (isConn) {
          setErrorMsg(null);
          await fetchAssets();
        }
      } else if (data.error) {
        setErrorMsg("Meta integration is temporarily unavailable.");
      }
    } catch (err: any) {
      console.error("Failed to fetch marketing status:", err);
      setErrorMsg("Meta integration is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/meta/selection`);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setAssetData(data.data);
        if (data.data.selectedAdAccount) {
          setSelectedAdId(data.data.selectedAdAccount.id);
        } else if (data.data.adAccounts?.length > 0) {
          setSelectedAdId(data.data.adAccounts[0].id);
        }

        if (data.data.selectedPage) {
          setSelectedPageId(data.data.selectedPage.id);
        } else if (data.data.pages?.length > 0) {
          setSelectedPageId(data.data.pages[0].id);
        }

        if (data.data.selectedInstagramAccount) {
          setSelectedIgId(data.data.selectedInstagramAccount.id);
        } else if (data.data.instagramAccounts?.length > 0) {
          setSelectedIgId(data.data.instagramAccounts[0].id);
        }

        // Fallback: If Meta is connected but no ad accounts exist in DB yet, trigger discovery once
        if (
          (!data.data.adAccounts || data.data.adAccounts.length === 0) &&
          !hasAutoDiscoveredRef.current
        ) {
          hasAutoDiscoveredRef.current = true;
          handleDiscoverAssets();
        }
      }
    } catch (err) {
      console.error("Failed to load Meta asset selections:", err);
    }
  };

  useEffect(() => {
    hasAutoDiscoveredRef.current = false;
    fetchStatus();
    fetchDraft();

    const connectedParam = searchParams.get("connected");
    const errorParam = searchParams.get("error");

    if (connectedParam === "true") {
      setSuccessMsg("Meta Ads account connected successfully!");
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else if (errorParam && connectedParam !== "true") {
      setErrorMsg("Meta integration is temporarily unavailable.");
    }
  }, [website.id, searchParams]);

  const handleConnectMeta = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/connect`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setErrorMsg("Meta integration is temporarily unavailable.");
        setIsConnecting(false);
      }
    } catch (err: any) {
      console.error("Meta connect error:", err);
      setErrorMsg("Meta integration is temporarily unavailable.");
      setIsConnecting(false);
    }
  };

  const handleDisconnectMeta = async () => {
    if (isDisconnecting) return;
    if (!confirm("Are you sure you want to disconnect Meta Ads from this website?")) return;

    setIsDisconnecting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/status`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMetaStatus({ isConnected: false, connection: null });
        setAssetData(null);
        setSelectedAdId("");
        setSelectedPageId("");
        setSelectedIgId("");
        setSuccessMsg("Meta Ads account disconnected successfully.");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg("Failed to disconnect Meta account.");
      }
    } catch (err: any) {
      console.error("Meta disconnect error:", err);
      setErrorMsg("Failed to disconnect Meta account.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDiscoverAssets = async () => {
    if (isDiscovering) return;
    setIsDiscovering(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/meta/discover`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setAssetData(data.data);
        if (data.data.selectedAdAccount) {
          setSelectedAdId(data.data.selectedAdAccount.id);
        }
        if (data.data.selectedPage) {
          setSelectedPageId(data.data.selectedPage.id);
        }
        if (data.data.selectedInstagramAccount) {
          setSelectedIgId(data.data.selectedInstagramAccount.id);
        }
        setSuccessMsg("Meta accounts and pages discovered successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        if (data.reauthRequired) {
          setErrorMsg("Your Meta connection needs attention. Reconnect your Meta account to continue.");
        } else {
          setErrorMsg(data.error || "Failed to discover Meta assets.");
        }
      }
    } catch (err: any) {
      console.error("Discover assets error:", err);
      setErrorMsg("Network error while discovering Meta assets.");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSaveSelection = async () => {
    if (isSavingSelection) return;
    setIsSavingSelection(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/meta/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAdAccountId: selectedAdId || null,
          selectedPageId: selectedPageId || null,
          selectedInstagramAccountId: selectedIgId || null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setAssetData(data.data);
        if (data.data.selectedAdAccount) {
          setSelectedAdId(data.data.selectedAdAccount.id);
        }
        if (data.data.selectedPage) {
          setSelectedPageId(data.data.selectedPage.id);
        }
        if (data.data.selectedInstagramAccount) {
          setSelectedIgId(data.data.selectedInstagramAccount.id);
        }
        setSuccessMsg("Meta asset selection saved successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error || "Failed to save Meta asset selection.");
      }
    } catch (err: any) {
      console.error("Save selection error:", err);
      setErrorMsg("Network error while saving asset selection.");
    } finally {
      setIsSavingSelection(false);
    }
  };

  const populateEditorFromStrategy = (strat: any) => {
    if (!strat) return;
    const budget = strat.budgetRecommendation || {};
    const audience = strat.targetAudience || {};
    const landing = strat.landingPageRecommendation || {};
    const lead = strat.leadDestinationRecommendation || {};
    const copyVars = Array.isArray(strat.adCopyVariations) && strat.adCopyVariations.length > 0
      ? strat.adCopyVariations.map((v: any) => ({
          headline: v.headline || "Book Consultation - Best Naturopathy Centre & Hosp",
          primaryText: v.primaryText || "Transform your well-being with personalized Naturopathy & Holistic Healthcare Hospital services at Best Naturopathy Centre & Hospital in Kerala. Book your consultation today.",
          description: v.description || "Book your appointment.",
          cta: v.cta || "Book Now",
          style: v.style || "Direct Response / High Intent",
          targetPersona: v.targetPersona || "Health & Wellness Seekers",
        }))
      : editorData.adCopyVariations;

    const defaultCampaignName = strat.userGoal
      ? `Meta Campaign - ${strat.userGoal.slice(0, 30)}`
      : "Book Consultation - Best Naturopathy Centre Campaign";

    const dailyB = Number(budget.dailyBudgetAmount) || 1000;
    const durD = Number(budget.recommendedDurationDays) || 7;

    setEditorData((prev) => ({
      ...prev,
      campaignName: defaultCampaignName,
      objective: strat.platformStrategy?.objective || "OUTCOME_LEADS",
      location: audience.location || "Kerala, India",
      ageRange: typeof audience.ageRange === "string" ? audience.ageRange : "21–55",
      dailyBudget: dailyB,
      durationDays: durD,
      audienceSummary: audience.demographicsSummary || "People interested in Naturopathy, Holistic Healthcare & Wellness in Kerala",
      recommendedPage: landing.path || "/contact",
      selectedPage: landing.path || "/contact",
      leadDestination: lead.details || "Meta On-Facebook Instant Lead Form",
      adCopyVariations: copyVars,
      selectedAdCopyIndex: activeAdTab < copyVars.length ? activeAdTab : 0,
      selectedImageUrl: prev.selectedImageUrl || strat.creativeBrief?.recommendedImages?.[0] || "",
    }));
  };

  const fetchExecutionStatus = async (targetDraftId?: string) => {
    try {
      const dId = targetDraftId || draftId || "latest";
      const res = await fetch(`/api/websites/${website.id}/marketing/plan/${dId}/status`);
      const data = await res.json();
      if (res.ok && data.hasExecution) {
        setExecutionRecord(data.approvalSnapshot || data);
        if (data.status === "published" || data.publishingStep === "completed") {
          setPublishResult({
            executionId: data.executionId,
            status: data.status,
            metaCampaignId: data.metaCampaignId,
            metaAdsetId: data.metaAdsetId,
            metaCreativeId: data.metaCreativeId,
            metaAdId: data.metaAdId,
            campaignStatus: data.campaignStatus || "PAUSED",
            adsetStatus: data.adsetStatus || "PAUSED",
            adStatus: data.adStatus || "PAUSED",
            updatedAt: data.updatedAt,
          });
          setEditorStep("success");
        }
      }
    } catch (err) {
      console.error("Failed to load campaign execution status:", err);
    }
  };

  const handleRefreshStatus = async () => {
    if (isSyncingStatus) return;
    setIsSyncingStatus(true);
    setSyncWarning(null);

    try {
      const targetDraftId = draftId || "latest";
      const res = await fetch(`/api/websites/${website.id}/marketing/plan/${targetDraftId}/status`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && (data.success || data.metaCampaignId)) {
        setPublishResult((prev: any) => ({
          ...prev,
          metaCampaignId: data.metaCampaignId || prev?.metaCampaignId,
          metaAdsetId: data.metaAdsetId || prev?.metaAdsetId,
          metaCreativeId: data.metaCreativeId || prev?.metaCreativeId,
          metaAdId: data.metaAdId || prev?.metaAdId,
          campaignStatus: data.campaignStatus || prev?.campaignStatus || "PAUSED",
          adsetStatus: data.adsetStatus || prev?.adsetStatus || "PAUSED",
          adStatus: data.adStatus || prev?.adStatus || "PAUSED",
          lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
        }));
        if (data.warning) {
          setSyncWarning(data.warning);
        } else {
          setSuccessMsg("Meta campaign status refreshed successfully.");
          setTimeout(() => setSuccessMsg(null), 4000);
        }
      } else {
        setSyncWarning(data.warning || "Unable to refresh Meta status. Showing the last known status.");
      }
    } catch (err) {
      console.error("Status sync error:", err);
      setSyncWarning("Unable to refresh Meta status. Showing the last known status.");
    } finally {
      setIsSyncingStatus(false);
    }
  };

  const fetchDraft = async () => {
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/plan`);
      const data = await res.json();
      if (res.ok && data.success && data.draft) {
        const fetchedDraftId = data.draft.draftId || data.draft.id;
        if (fetchedDraftId) {
          setDraftId(fetchedDraftId);
          fetchExecutionStatus(fetchedDraftId);
        }
        if (data.draft.strategy) {
          setPlanStrategy(data.draft.strategy);
          populateEditorFromStrategy(data.draft.strategy);
        }
      } else {
        fetchExecutionStatus("latest");
      }
    } catch (err) {
      console.error("Failed to load campaign draft:", err);
      fetchExecutionStatus("latest");
    }
  };

  const handleGeneratePlan = async () => {
    if (isGeneratingPlan) return;
    if (!userGoal || userGoal.trim().length < 3) {
      setErrorMsg("Please enter a valid marketing goal (e.g. 'I want more consultations from people in Kerala').");
      return;
    }

    setIsGeneratingPlan(true);
    setErrorMsg(null);
    setApprovalNotice(null);
    setShowLaunchConfirm(false);
    setPublishResult(null);

    try {
      const missingInputsObj: any = {};
      if (dailyBudgetInput) missingInputsObj.dailyBudget = Number(dailyBudgetInput);
      if (durationInput) missingInputsObj.durationDays = Number(durationInput);

      const res = await fetch(`/api/websites/${website.id}/marketing/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userGoal,
          missingInputs: Object.keys(missingInputsObj).length > 0 ? missingInputsObj : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.needsMoreInfo) {
          setMissingQuestions(data.missingQuestions || []);
        } else if (data.strategy) {
          setMissingQuestions([]);
          const genDraftId = data.draftId || data.id || data.strategy.id;
          if (genDraftId) setDraftId(genDraftId);
          setPlanStrategy(data.strategy);
          populateEditorFromStrategy(data.strategy);
          setEditorStep("strategy");
          setSuccessMsg("AI Campaign Plan & Ad Variations generated successfully!");
          setTimeout(() => setSuccessMsg(null), 5000);
        }
      } else {
        setErrorMsg(data.error || "Failed to generate AI campaign plan.");
      }
    } catch (err: any) {
      console.error("Generate plan error:", err);
      setErrorMsg("Network error while generating AI campaign plan.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleEnterEditor = () => {
    if (planStrategy) {
      populateEditorFromStrategy(planStrategy);
    }
    setEditorStep("editor");
    setApprovalNotice("Campaign Strategy Approved. Proceed to Campaign Setup.");
  };

  const handleOpenMediaSelector = async () => {
    setMediaSearchQuery("");
    setMediaUploadError(null);
    setShowMediaSelectorModal(true);
    setIsFetchingMedia(true);

    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (res.ok && data.assets) {
        // Filter image assets with valid, usable public URLs only
        const imageAssets = data.assets.filter(
          (a: any) =>
            (!a.mime_type || a.mime_type.startsWith("image/")) &&
            typeof a.public_url === "string" &&
            a.public_url.trim().startsWith("http")
        );
        setMediaAssetsList(imageAssets);

        // Pre-select asset matching committed editorData.selectedImageUrl
        if (editorData.selectedImageUrl) {
          const match = imageAssets.find(
            (a: any) => a.public_url === editorData.selectedImageUrl
          );
          setTempSelectedAssetId(match ? match.id : "");
        } else {
          setTempSelectedAssetId("");
        }
      } else {
        setMediaAssetsList([]);
        setTempSelectedAssetId("");
      }
    } catch (err) {
      console.error("Failed to fetch media assets:", err);
      setMediaUploadError("Failed to fetch media assets library.");
      setMediaAssetsList([]);
      setTempSelectedAssetId("");
    } finally {
      setIsFetchingMedia(false);
    }
  };

  const handleCancelMediaSelection = () => {
    setTempSelectedAssetId("");
    setMediaSearchQuery("");
    setMediaUploadError(null);
    setShowMediaSelectorModal(false);
  };

  const handleUploadMediaAsset = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setMediaUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      setMediaUploadError("File size exceeds maximum limit of 5 MB.");
      return;
    }

    setIsUploadingMedia(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (website?.id) {
        formData.append("websiteId", website.id);
      }

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setMediaUploadError(data.message || data.error || "Failed to upload image.");
        return;
      }

      if (data.asset && data.asset.public_url) {
        setMediaAssetsList((prev) => [data.asset, ...prev]);
        setTempSelectedAssetId(data.asset.id);
      }
    } catch (err: any) {
      console.error("Media upload error:", err);
      setMediaUploadError("An error occurred during image upload.");
    } finally {
      setIsUploadingMedia(false);
      if (mediaFileInputRef.current) mediaFileInputRef.current.value = "";
    }
  };

  const handleConfirmMediaSelection = () => {
    if (!tempSelectedAssetId) {
      setMediaUploadError("Please click an image to select it before applying.");
      return;
    }

    const selectedAsset = mediaAssetsList.find((a) => a.id === tempSelectedAssetId);
    const selectedUrl = selectedAsset?.public_url || "";

    if (!selectedUrl) {
      setMediaUploadError("The selected asset does not have a valid image URL.");
      return;
    }

    setEditorData((prev) => ({ ...prev, selectedImageUrl: selectedUrl }));
    setTempSelectedAssetId("");
    setMediaSearchQuery("");
    setMediaUploadError(null);
    setShowMediaSelectorModal(false);
  };

  const handleApprovePlan = async (customEditorData?: typeof editorData): Promise<boolean> => {
    if (isApproving || !planStrategy) return false;
    setIsApproving(true);
    setErrorMsg(null);
    setEditorValidationError(null);

    const payloadData = customEditorData || editorData;
    const currentAdCopy = payloadData.adCopyVariations[payloadData.selectedAdCopyIndex] || payloadData.adCopyVariations[0];

    try {
      const targetDraftId = draftId || planStrategy.id || "latest";
      const res = await fetch(`/api/websites/${website.id}/marketing/plan/${targetDraftId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAdCopyIndex: payloadData.selectedAdCopyIndex,
          campaignName: payloadData.campaignName,
          dailyBudgetAmount: payloadData.dailyBudget,
          durationDays: payloadData.durationDays,
          totalBudgetAmount: payloadData.dailyBudget * payloadData.durationDays,
          headline: currentAdCopy.headline,
          primaryText: currentAdCopy.primaryText,
          description: currentAdCopy.description,
          cta: currentAdCopy.cta,
          location: payloadData.location,
          landingPagePath: payloadData.selectedPage,
          landingPageUrl: `https://${website.custom_domain || "website.com"}${payloadData.selectedPage}`,
          leadDestination: payloadData.leadDestination,
          objective: payloadData.objective,
          audienceSummary: payloadData.audienceSummary,
          selectedImageUrl: payloadData.selectedImageUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExecutionRecord(data.snapshot || data);
        setApprovalNotice("Phase 3 Strategy Approved! Immutable Launch Snapshot created.");
        return true;
      } else {
        setErrorMsg(data.error || "Failed to approve campaign strategy for launch.");
        return false;
      }
    } catch (err: any) {
      console.error("Approve plan error:", err);
      setErrorMsg("Network error while approving campaign strategy.");
      return false;
    } finally {
      setIsApproving(false);
    }
  };

  const handleContinueToReview = async () => {
    const currentVar = editorData.adCopyVariations[editorData.selectedAdCopyIndex] || editorData.adCopyVariations[0];
    if (!editorData.campaignName || !editorData.campaignName.trim()) {
      setEditorValidationError("Campaign Name is required.");
      return;
    }
    if (!editorData.dailyBudget || Number(editorData.dailyBudget) <= 0) {
      setEditorValidationError("Daily Budget must be greater than ₹0.");
      return;
    }
    if (!editorData.durationDays || Number(editorData.durationDays) <= 0) {
      setEditorValidationError("Campaign Duration must be at least 1 day.");
      return;
    }
    if (!currentVar.headline || !currentVar.headline.trim()) {
      setEditorValidationError("Ad Headline is required.");
      return;
    }
    if (!currentVar.primaryText || !currentVar.primaryText.trim()) {
      setEditorValidationError("Ad Primary Text is required.");
      return;
    }
    setEditorValidationError(null);

    const ok = await handleApprovePlan(editorData);
    if (ok) {
      setEditorStep("review");
    }
  };

  const updateActiveCopyField = (field: "headline" | "primaryText" | "description" | "cta", value: string) => {
    setEditorData((prev) => {
      const newVars = [...prev.adCopyVariations];
      const idx = prev.selectedAdCopyIndex;
      if (newVars[idx]) {
        newVars[idx] = { ...newVars[idx], [field]: value };
      }
      return { ...prev, adCopyVariations: newVars };
    });
  };

  const handlePublishCampaign = async () => {
    if (isPublishing || !planStrategy) return;
    setIsPublishing(true);
    setErrorMsg(null);
    setPublishingStepText("Validating Meta connection & permissions...");

    try {
      const targetDraftId = draftId || planStrategy.id || "latest";
      setPublishingStepText("Creating Meta Campaign & Ad Objects (PAUSED)...");

      const res = await fetch(`/api/websites/${website.id}/marketing/plan/${targetDraftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mockMode: false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPublishResult(data);
        setEditorStep("success");
        setSuccessMsg("Meta Campaign created and published in PAUSED safety mode!");
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        setErrorMsg(data.error || "Campaign publishing encountered an error.");
      }
    } catch (err: any) {
      console.error("Publish campaign error:", err);
      setErrorMsg("Campaign publishing failed. Please check Meta status.");
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const url = `/api/websites/${website.id}/marketing/leads?source=${sourceFilter}&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setLeadsList(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to fetch marketing leads:", err);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (activeSection === "leads") {
      fetchLeads();
    }
  }, [website.id, activeSection, sourceFilter, statusFilter]);

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.lead) {
        setLeadsList((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLeadDetail?.id === leadId) setSelectedLeadDetail(data.lead);
        setSuccessMsg("Lead status updated successfully!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Update lead status error:", err);
    }
  };

  const handleSaveLeadNotes = async (leadId: string) => {
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: leadNotesInput }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.lead) {
        setLeadsList((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        setSelectedLeadDetail(data.lead);
        setSuccessMsg("Lead notes saved!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Save lead notes error:", err);
    }
  };

  const handleExportLeadsCSV = () => {
    if (!leadsList || leadsList.length === 0) return;
    const headers = ["ID", "Name", "Email", "Phone", "Source", "Campaign / Form", "Landing Page", "Status", "Date", "Notes"];
    const rows = leadsList.map((l) => [
      l.id,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.email || "").replace(/"/g, '""')}"`,
      `"${(l.phone || "").replace(/"/g, '""')}"`,
      l.source || "unknown",
      `"${(l.campaign_name || l.form_name || "").replace(/"/g, '""')}"`,
      `"${(l.landing_page || l.form_id || "").replace(/"/g, '""')}"`,
      l.status || "new",
      l.created_at || "",
      `"${(l.notes || l.message || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marketing-leads-${website.id.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Phase 6 API Helpers
  const fetchAnalytics = async (preset = datePresetFilter) => {
    setIsFetchingAnalytics(true);
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/analytics?preset=${preset}`);
      const data = await res.json();
      if (res.ok && data.success && data.report) {
        setAnalyticsReport(data.report);
      }
    } catch (err) {
      console.error("Failed to fetch marketing analytics:", err);
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeSection === "performance") {
      fetchAnalytics(datePresetFilter);
    }
  }, [website.id, activeSection, datePresetFilter]);

  const handleRunAIAnalysis = async () => {
    setIsAnalyzingAI(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/analysis`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success && data.analysis) {
        setAiAnalysis(data.analysis);
        setSuccessMsg("AI Performance Analysis completed & optimization proposals generated!");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error || "Failed to generate AI performance analysis.");
      }
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setErrorMsg("Failed to run AI performance analysis.");
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleApproveOptimization = async (recommendationId: string) => {
    setApprovingRecId(recommendationId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/websites/${website.id}/marketing/optimization/${recommendationId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Optimization approved and executed successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
        fetchAnalytics(datePresetFilter);
        if (aiAnalysis && aiAnalysis.recommendations) {
          setAiAnalysis((prev: any) => ({
            ...prev,
            recommendations: prev.recommendations.map((r: any) =>
              r.id === recommendationId ? { ...r, status: "executed" } : r
            ),
          }));
        }
      } else {
        setErrorMsg(data.error || "Failed to approve optimization recommendation.");
      }
    } catch (err: any) {
      console.error("Approve optimization error:", err);
      setErrorMsg("Failed to execute optimization approval.");
    } finally {
      setApprovingRecId(null);
    }
  };

  const setupComplete = Boolean(selectedAdId && selectedPageId);
  const plan = website.design_plan || {};

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top SaaS Header & Sub-Navigation (Shared Shell) */}
      <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <Link
            href={`/dashboard/websites/${website.id}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-2xs shrink-0"
            title="Return to Website Dashboard Hub"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Website Hub</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[180px] sm:max-w-md">
              {website.title} — AI Marketing Agent
            </h1>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <Link
              href={`/dashboard/websites/${website.id}`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Overview
            </Link>
            <Link
              href={`/dashboard/websites/${website.id}/seo`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              SEO Control Center
            </Link>
            <Link
              href={`/dashboard/websites/${website.id}/blog`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Blog Engine
            </Link>
            <span className="px-3.5 py-1.5 rounded-lg bg-white text-purple-700 font-extrabold text-xs shadow-2xs">
              Marketing Agent
            </span>
            <Link
              href={`/dashboard/websites/${website.id}/domain`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Domain
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Dashboard Content Container (Max-W-7xl matching Reference A) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Notifications */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {errorMsg && !metaStatus.isConnected && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={fetchStatus}
              className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-[11px] text-amber-900 hover:bg-amber-100 font-bold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Outer Single Workspace Card (Matching WebsiteWorkspace in Reference A) */}
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md relative overflow-hidden transition-all">
          {/* Decorative background ambient glows */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Card Header */}
          <div className="relative z-10 mb-6 border-b border-slate-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold tracking-wide uppercase mb-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Growth Engine</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                AI MARKETING AGENT
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Turn your website into a growth engine with AI-powered advertising, lead generation and campaign intelligence.
              </p>
            </div>

            {/* Phase 5 Section Navigator */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveSection("campaigns")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSection === "campaigns"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Campaigns & Publisher
              </button>
              <button
                onClick={() => setActiveSection("leads")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSection === "leads"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>Unified Lead Inbox</span>
                {leadsList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-purple-950 text-[10px] font-black">
                    {leadsList.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection("performance")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSection === "performance"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>Performance & AI Optimization</span>
                <span className="px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-black uppercase">
                  Phase 6
                </span>
              </button>
            </div>
          </div>

          {/* Action Groups Grid (Matching Reference A Card Layout) */}
          {activeSection === "campaigns" && (
            <>
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GROUP 1: META ADS */}
            <div className="flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Meta Advertising
                  </h3>
                </div>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                ) : setupComplete ? (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Setup Complete
                  </span>
                ) : metaStatus.isConnected ? (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Not connected
                  </span>
                )}
              </div>

              {/* Meta Card Content */}
              <div className="group bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Meta Ads
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                    Facebook & Instagram Campaigns
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Connect your Meta Business account to manage advertising from Codeaxys.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Official Meta OAuth. Your Meta credentials are securely handled server-side.
                  </p>
                </div>

                {metaStatus.isConnected && metaStatus.connection && (
                  <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Account:</span>
                      <span className="font-bold text-slate-800">{metaStatus.connection.metaUserName || "Meta Business"}</span>
                    </div>
                    {metaStatus.connection.metaUserEmail && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Email:</span>
                        <span className="font-mono text-slate-600 text-[11px]">{metaStatus.connection.metaUserEmail}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {!metaStatus.isConnected ? (
                    <button
                      onClick={handleConnectMeta}
                      disabled={isConnecting || loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-between transition-all shadow-2xs active:scale-98 cursor-pointer"
                    >
                      {isConnecting ? (
                        <>
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connecting...</span>
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>Connect Meta Ads</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-3">
                      <button
                        onClick={handleConnectMeta}
                        disabled={isConnecting}
                        className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reconnect</span>
                      </button>

                      <button
                        onClick={handleDisconnectMeta}
                        disabled={isDisconnecting}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                      >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GROUP 2: GOOGLE ADS */}
            <div className="flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Google Search Advertising
                  </h3>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Shared Integration
                </span>
              </div>

              {/* Google Ads Card Content */}
              <div className="group bg-white hover:bg-purple-50/40 border border-slate-200 hover:border-purple-300 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Search className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Google Ads
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-900 transition-colors">
                    Search Advertising & Keyword Intelligence
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Uses your existing Google Ads connection from SEO Center for keyword demand intelligence and paid search strategy.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                  <Link
                    href={`/dashboard/websites/${website.id}/seo`}
                    className="w-full flex items-center justify-between hover:text-indigo-900 transition-colors"
                  >
                    <span>Manage Google Ads Connection</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* META ASSET DISCOVERY & SELECTION SECTION (When Connected) */}
          {metaStatus.isConnected && (
            <div className="relative z-10 mt-6 flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Meta Advertising Assets
                  </h3>
                </div>
                {setupComplete ? (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Setup Complete
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Selection Pending
                  </span>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Select Campaign Assets
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure the Ad Account, Facebook Page, and Instagram Account for your AI campaigns.
                    </p>
                  </div>

                  <button
                    onClick={handleDiscoverAssets}
                    disabled={isDiscovering}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    {isDiscovering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span>Discovering...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Refresh Meta Assets</span>
                      </>
                    )}
                  </button>
                </div>

                {!assetData && !isDiscovering && (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-3">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-600 font-medium">
                      Discover your advertising assets to continue setup.
                    </p>
                    <button
                      onClick={handleDiscoverAssets}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Discover Meta Assets Now
                    </button>
                  </div>
                )}

                {isDiscovering && (
                  <div className="p-6 rounded-xl bg-purple-50/50 border border-purple-200/80 text-center space-y-2">
                    <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-purple-950">Discovering Meta Ad Accounts, Facebook Pages & Instagram Accounts...</p>
                  </div>
                )}

                {assetData && !isDiscovering && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* 1. Ad Account */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-purple-600" />
                          <span>1. Meta Ad Account</span>
                        </label>
                        {assetData.adAccounts && assetData.adAccounts.length > 0 ? (
                          <select
                            value={selectedAdId}
                            onChange={(e) => setSelectedAdId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                          >
                            <option value="">-- Select Ad Account --</option>
                            {assetData.adAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.id})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                            No Meta ad accounts found.
                          </div>
                        )}
                      </div>

                      {/* 2. Facebook Page */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Share2 className="w-3.5 h-3.5 text-purple-600" />
                          <span>2. Facebook Page</span>
                        </label>
                        {assetData.pages && assetData.pages.length > 0 ? (
                          <select
                            value={selectedPageId}
                            onChange={(e) => setSelectedPageId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                          >
                            <option value="">-- Select Facebook Page --</option>
                            {assetData.pages.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                            No Facebook Pages found.
                          </div>
                        )}
                      </div>

                      {/* 3. Instagram Account */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-purple-600" />
                          <span>3. Instagram Account</span>
                        </label>
                        {assetData.instagramAccounts && assetData.instagramAccounts.length > 0 ? (
                          <select
                            value={selectedIgId}
                            onChange={(e) => setSelectedIgId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                          >
                            <option value="">-- None / Select Instagram Account --</option>
                            {assetData.instagramAccounts.map((ig) => (
                              <option key={ig.id} value={ig.id}>
                                @{ig.username}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium">
                            No Instagram Professional Account is currently connected to the selected Facebook Page.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Selection Summary */}
                    {setupComplete && (
                      <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5 mr-1">
                          <Check className="w-4 h-4 text-emerald-600" />
                          Active Assets:
                        </span>
                        {selectedAdId && assetData.adAccounts && (
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-bold text-slate-800 text-[11px] shadow-2xs">
                            Ad Account: {assetData.adAccounts.find((a) => a.id === selectedAdId)?.name || selectedAdId}
                          </span>
                        )}
                        {selectedPageId && assetData.pages && (
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-bold text-slate-800 text-[11px] shadow-2xs">
                            Page: {assetData.pages.find((p) => p.id === selectedPageId)?.name || selectedPageId}
                          </span>
                        )}
                        {selectedIgId && assetData.instagramAccounts && (
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-bold text-slate-800 text-[11px] shadow-2xs">
                            Instagram: @{assetData.instagramAccounts.find((ig) => ig.id === selectedIgId)?.username || selectedIgId}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleSaveSelection}
                        disabled={isSavingSelection}
                        className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
                      >
                        {isSavingSelection ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Asset Selection</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PHASE 3 & CAMPAIGN EDITOR SECTION */}
          {metaStatus.isConnected && (
            <div className="relative z-10 mt-6 flex flex-col gap-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Phase 3 — AI Campaign Planner & Campaign Setup Editor
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    editorStep === "strategy"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : editorStep === "editor"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : editorStep === "review"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {editorStep === "strategy" && "Step 1: Strategy"}
                    {editorStep === "editor" && "Step 2: Campaign Setup"}
                    {editorStep === "review" && "Step 3: Review & Create"}
                    {editorStep === "success" && "Created (PAUSED)"}
                  </span>
                </div>
              </div>

              {/* STEP INDICATOR HEADER */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
                    <div className={`flex items-center gap-2 text-xs font-extrabold shrink-0 ${editorStep === "strategy" ? "text-purple-600" : "text-slate-500"}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${editorStep === "strategy" ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"}`}>1</span>
                      <span>Strategy</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className={`flex items-center gap-2 text-xs font-extrabold shrink-0 ${editorStep === "editor" ? "text-purple-600" : editorStep === "review" || editorStep === "success" ? "text-emerald-600" : "text-slate-400"}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${editorStep === "editor" ? "bg-purple-600 text-white" : editorStep === "review" || editorStep === "success" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>2</span>
                      <span>Campaign Setup</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className={`flex items-center gap-2 text-xs font-extrabold shrink-0 ${editorStep === "review" ? "text-purple-600" : editorStep === "success" ? "text-emerald-600" : "text-slate-400"}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${editorStep === "review" ? "bg-purple-600 text-white" : editorStep === "success" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>3</span>
                      <span>Review & Create</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 shrink-0">
                    Step {editorStep === "strategy" ? "1 of 3" : editorStep === "editor" ? "2 of 3" : "3 of 3"}
                  </span>
                </div>

                {/* STEP 1: AI CAMPAIGN PLANNER VIEW */}
                {editorStep === "strategy" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h4 className="font-extrabold text-slate-900 text-base">
                          AI Campaign Planner
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        What business result do you want to achieve? AI will analyze your business context, recommend landing pages, and build 3 ad copy variations.
                      </p>
                    </div>

                    {!setupComplete && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Select and save a Meta Ad Account and Facebook Page above to enable AI campaign planning.</span>
                      </div>
                    )}

                    {/* Input Prompt Box */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-800">
                        What business result do you want to achieve?
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={userGoal}
                          onChange={(e) => setUserGoal(e.target.value)}
                          placeholder="e.g. I want more consultations from people in Kerala."
                          disabled={!setupComplete || isGeneratingPlan}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                        />
                        <button
                          onClick={handleGeneratePlan}
                          disabled={!setupComplete || isGeneratingPlan || !userGoal.trim()}
                          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer"
                        >
                          {isGeneratingPlan ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Generating Strategy...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Generate Campaign Plan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Missing Questions Prompt */}
                    {missingQuestions.length > 0 && (
                      <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-3">
                        <div className="flex items-center gap-2 text-purple-950 font-bold">
                          <HelpCircle className="w-4 h-4 text-purple-600" />
                          <span>AI Planner Needs 1-2 Quick Details:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Daily Budget (₹)</label>
                            <input
                              type="number"
                              value={dailyBudgetInput}
                              onChange={(e) => setDailyBudgetInput(e.target.value)}
                              placeholder="e.g. 1000"
                              className="w-full px-3 py-1.5 rounded-lg border border-purple-200 bg-white text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">Campaign Duration (Days)</label>
                            <input
                              type="number"
                              value={durationInput}
                              onChange={(e) => setDurationInput(e.target.value)}
                              placeholder="e.g. 7"
                              className="w-full px-3 py-1.5 rounded-lg border border-purple-200 bg-white text-xs font-medium"
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleGeneratePlan}
                          disabled={isGeneratingPlan}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                        >
                          Continue Strategy Generation
                        </button>
                      </div>
                    )}

                    {/* REVIEWABLE CAMPAIGN STRATEGY CARD */}
                    {planStrategy && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase mb-1">
                              <Check className="w-3 h-3 text-purple-600" />
                              <span>Review Ready Strategy</span>
                            </div>
                            <h5 className="font-extrabold text-slate-900 text-base">
                              {planStrategy.userGoal}
                            </h5>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 block">Estimated Budget</span>
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-sm font-black text-slate-900">₹{planStrategy.budgetRecommendation.totalBudgetAmount}</span>
                              <span className="text-[10px] font-bold text-slate-500">({planStrategy.budgetRecommendation.recommendedDurationDays} days @ ₹{planStrategy.budgetRecommendation.dailyBudgetAmount}/day)</span>
                            </div>
                          </div>
                        </div>

                        {/* Audience & Strategy Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Target className="w-4 h-4 text-purple-600" />
                              <span>Target Audience</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                              {planStrategy.targetAudience.demographicsSummary}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">📍 {planStrategy.targetAudience.location}</span>
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">👥 Age: {planStrategy.targetAudience.ageRange}</span>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-purple-600" />
                              <span>Platform & Destination</span>
                            </div>
                            <div className="space-y-1 text-slate-700">
                              <div><strong>Recommended Page:</strong> {planStrategy.landingPageRecommendation.title} (<code>{planStrategy.landingPageRecommendation.path}</code>)</div>
                              <div><strong>Lead Destination:</strong> {planStrategy.leadDestinationRecommendation.details}</div>
                              <p className="text-slate-500 text-[11px] mt-1">{planStrategy.landingPageRecommendation.rationale}</p>
                            </div>
                          </div>
                        </div>

                        {/* 3 Ad Copy Variations */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h6 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span>3 Generated Ad Copy Variations</span>
                            </h6>
                            <div className="flex gap-1">
                              {planStrategy.adCopyVariations.map((v: any, idx: number) => (
                                <button
                                  key={v.variationId || idx}
                                  onClick={() => setActiveAdTab(idx)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeAdTab === idx
                                      ? "bg-purple-600 text-white shadow-2xs"
                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  }`}
                                >
                                  Var #{idx + 1}
                                </button>
                              ))}
                            </div>
                          </div>

                          {planStrategy.adCopyVariations[activeAdTab] && (
                            <div className="p-4 rounded-xl bg-white border border-purple-200 space-y-3 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  {planStrategy.adCopyVariations[activeAdTab].style}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500">
                                  Target: {planStrategy.adCopyVariations[activeAdTab].targetPersona}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Headline</span>
                                  <p className="font-extrabold text-slate-900 text-sm">
                                    {planStrategy.adCopyVariations[activeAdTab].headline}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Primary Text</span>
                                  <p className="text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans">
                                    {planStrategy.adCopyVariations[activeAdTab].primaryText}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Description</span>
                                    <span className="text-slate-600 font-medium">{planStrategy.adCopyVariations[activeAdTab].description}</span>
                                  </div>
                                  <span className="px-3 py-1 bg-purple-600 text-white font-bold rounded-lg text-xs">
                                    CTA: {planStrategy.adCopyVariations[activeAdTab].cta}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Creative Brief */}
                        <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Palette className="w-4 h-4 text-purple-600" />
                            <span>Creative Brief & Brand Direction</span>
                          </div>
                          <p className="text-slate-600">{planStrategy.creativeBrief.visualConcept}</p>
                          <p className="text-slate-500 text-[11px]">{planStrategy.creativeBrief.formatGuidelines}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Zero ad spend occurs until explicit launch approval in Step 3.
                          </span>

                          <button
                            onClick={handleEnterEditor}
                            className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-98 cursor-pointer"
                          >
                            <span>Approve & Continue to Launch Setup</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: CAMPAIGN EDITOR VIEW */}
                {editorStep === "editor" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="font-black text-slate-900 text-lg">Meta Campaign Editor</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Review and edit your campaign settings before creating the campaign in Meta.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-extrabold self-start sm:self-auto">
                        2. Campaign Setup
                      </span>
                    </div>

                    {editorValidationError && (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{editorValidationError}</span>
                      </div>
                    )}

                    {/* Two-Column Responsive Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* LEFT COLUMN: EDITABLE CONTROLS (Span 2) */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* 1. CAMPAIGN SETTINGS */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Building2 className="w-4 h-4 text-purple-600" />
                            <span>Campaign Settings</span>
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="font-bold text-slate-700 block">Campaign Name</label>
                              <input
                                type="text"
                                value={editorData.campaignName}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, campaignName: e.target.value }))}
                                placeholder="Enter campaign name..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Objective</label>
                              <select
                                value={editorData.objective}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, objective: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
                              >
                                <option value="OUTCOME_LEADS">OUTCOME_LEADS (Lead Generation)</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Special Ad Category</label>
                              <select
                                value={editorData.specialAdCategory}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, specialAdCategory: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-none shadow-2xs cursor-not-allowed"
                                disabled
                              >
                                <option value="NONE">NONE (Standard Business)</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Buying Type</label>
                              <input
                                type="text"
                                value={editorData.buyingType}
                                disabled
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. AD SET SETTINGS */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Target className="w-4 h-4 text-purple-600" />
                            <span>Ad Set & Budget Settings</span>
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="font-bold text-slate-700 block">Audience Demographics & Interests</label>
                              <textarea
                                rows={2}
                                value={editorData.audienceSummary}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, audienceSummary: e.target.value }))}
                                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Location</label>
                              <input
                                type="text"
                                value={editorData.location}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, location: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Age Range</label>
                              <input
                                type="text"
                                value={editorData.ageRange}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, ageRange: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Gender</label>
                              <select
                                value={editorData.gender}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, gender: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              >
                                <option value="All">All Genders</option>
                                <option value="Male">Men</option>
                                <option value="Female">Women</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Placements</label>
                              <input
                                type="text"
                                value={editorData.placements}
                                disabled
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-not-allowed"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Daily Budget (₹/day)</label>
                              <input
                                type="number"
                                min="100"
                                step="100"
                                value={editorData.dailyBudget}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, dailyBudget: Number(e.target.value) }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Duration (Days)</label>
                              <input
                                type="number"
                                min="1"
                                max="90"
                                value={editorData.durationDays}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, durationDays: Number(e.target.value) }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            {/* DYNAMIC TOTAL MAX SPEND RECALCULATION BADGE */}
                            <div className="sm:col-span-2 p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-purple-950 block">Dynamic Total Maximum Spend</span>
                                <span className="text-[11px] text-purple-700">
                                  ₹{editorData.dailyBudget.toLocaleString()} / day × {editorData.durationDays} days
                                </span>
                              </div>
                              <span className="text-base font-black text-purple-900 bg-white px-3 py-1 rounded-lg border border-purple-200 shadow-2xs">
                                ₹{(editorData.dailyBudget * editorData.durationDays).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. DESTINATION & LEAD SETTINGS */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Layers className="w-4 h-4 text-purple-600" />
                            <span>Destination & Lead Settings</span>
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Recommended Website Page</label>
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-800 font-bold">
                                {editorData.recommendedPage}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 block">Selected Destination Page</label>
                              <input
                                type="text"
                                value={editorData.selectedPage}
                                onChange={(e) => setEditorData((prev) => ({ ...prev, selectedPage: e.target.value }))}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="font-bold text-slate-700 block">Lead Destination</label>
                              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 font-bold text-purple-900 flex items-center justify-between">
                                <span>{editorData.leadDestination}</span>
                                <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-950 text-[10px] font-black uppercase">
                                  Native Instant Form
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 4. IDENTITY & ASSETS */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Share2 className="w-4 h-4 text-purple-600" />
                            <span>Identity & Assets</span>
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Meta Ad Account</span>
                              <span className="font-extrabold text-slate-900 block truncate">
                                {assetData?.selectedAdAccount?.name || "Codeaxys Ads"}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Facebook Page</span>
                              <span className="font-extrabold text-slate-900 block truncate">
                                {assetData?.selectedPage?.name || "Codeaxys Marketing Test"}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Instagram Account</span>
                              {assetData?.selectedInstagramAccount ? (
                                <span className="font-extrabold text-slate-900 block truncate">
                                  @{assetData.selectedInstagramAccount.username}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-medium leading-tight block">
                                  No Instagram Professional Account is currently connected to the selected Facebook Page.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 5. AD CREATIVE / COPY EDITOR */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span>Ad Creative & Copy Variations</span>
                            </h5>

                            {/* Variation Tab Selector */}
                            <div className="flex gap-1">
                              {editorData.adCopyVariations.map((v, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setEditorData((prev) => ({ ...prev, selectedAdCopyIndex: idx }))}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    editorData.selectedAdCopyIndex === idx
                                      ? "bg-purple-600 text-white shadow-2xs"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                >
                                  Variation #{idx + 1}
                                </button>
                              ))}
                            </div>
                          </div>

                          {editorData.adCopyVariations[editorData.selectedAdCopyIndex] && (
                            <div className="space-y-4 text-xs">
                              <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-50 text-purple-900 font-medium">
                                <span>Style: <strong>{editorData.adCopyVariations[editorData.selectedAdCopyIndex].style || "Direct Response"}</strong></span>
                                <span>Target: <strong>{editorData.adCopyVariations[editorData.selectedAdCopyIndex].targetPersona || "General Audience"}</strong></span>
                              </div>

                              <div className="space-y-1.5">
                                <label className="font-bold text-slate-700 block">Headline</label>
                                <input
                                  type="text"
                                  value={editorData.adCopyVariations[editorData.selectedAdCopyIndex].headline}
                                  onChange={(e) => updateActiveCopyField("headline", e.target.value)}
                                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="font-bold text-slate-700 block">Primary Text</label>
                                <textarea
                                  rows={4}
                                  value={editorData.adCopyVariations[editorData.selectedAdCopyIndex].primaryText}
                                  onChange={(e) => updateActiveCopyField("primaryText", e.target.value)}
                                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-sans text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs leading-relaxed"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="font-bold text-slate-700 block">Description</label>
                                  <input
                                    type="text"
                                    value={editorData.adCopyVariations[editorData.selectedAdCopyIndex].description}
                                    onChange={(e) => updateActiveCopyField("description", e.target.value)}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="font-bold text-slate-700 block">Call To Action (CTA)</label>
                                  <select
                                    value={editorData.adCopyVariations[editorData.selectedAdCopyIndex].cta}
                                    onChange={(e) => updateActiveCopyField("cta", e.target.value)}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
                                  >
                                    <option value="Book Now">Book Now</option>
                                    <option value="Learn More">Learn More</option>
                                    <option value="Contact Us">Contact Us</option>
                                    <option value="Sign Up">Sign Up</option>
                                    <option value="Get Offer">Get Offer</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 6. CREATIVE / IMAGE */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h5 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              <Palette className="w-4 h-4 text-purple-600" />
                              <span>Ad Creative Image</span>
                            </h5>

                            <div className="flex items-center gap-2">
                              {editorData.selectedImageUrl ? (
                                <>
                                  <button
                                    onClick={handleOpenMediaSelector}
                                    className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Change Image</span>
                                  </button>
                                  <button
                                    onClick={() => setEditorData((prev) => ({ ...prev, selectedImageUrl: "" }))}
                                    className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all cursor-pointer"
                                  >
                                    <span>Remove Image</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={handleOpenMediaSelector}
                                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Select Image</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {editorData.selectedImageUrl ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-2 max-w-md">
                              <img
                                src={editorData.selectedImageUrl}
                                alt="Campaign Creative Preview"
                                className="w-full h-48 object-cover rounded-lg shadow-2xs"
                              />
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-600 px-1">
                                <span className="font-mono text-[11px] truncate max-w-[220px]">
                                  {editorData.selectedImageUrl}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Selected Creative
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mx-auto">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">No ad creative image selected yet.</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Select an image asset from your website media library or upload a new custom ad image.
                                </p>
                              </div>
                              <button
                                onClick={handleOpenMediaSelector}
                                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Select Image from Library</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT COLUMN: STICKY SUMMARY & AD PREVIEW (Span 1) */}
                      <div className="space-y-6 lg:sticky lg:top-20 self-start">
                        {/* LIVE STICKY CAMPAIGN SUMMARY CARD */}
                        <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-lg space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h5 className="font-black text-sm text-white flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-purple-400" />
                              <span>Live Campaign Summary</span>
                            </h5>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-900 text-purple-200">
                              Real-Time
                            </span>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">Campaign Name</span>
                              <span className="font-bold text-white truncate block">{editorData.campaignName || "Untitled Campaign"}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Objective</span>
                                <span className="font-medium text-purple-300">{editorData.objective}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Location</span>
                                <span className="font-medium text-white">{editorData.location}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Daily Budget</span>
                                <span className="font-extrabold text-emerald-400">₹{editorData.dailyBudget.toLocaleString()}/day</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Duration</span>
                                <span className="font-medium text-white">{editorData.durationDays} Days</span>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">Maximum Planned Spend</span>
                              <span className="text-sm font-black text-emerald-300">
                                ₹{(editorData.dailyBudget * editorData.durationDays).toLocaleString()} INR
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Ad Account</span>
                                <span className="font-medium text-slate-300 truncate block">{assetData?.selectedAdAccount?.name || "Codeaxys Ads"}</span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Facebook Page</span>
                                <span className="font-medium text-slate-300 truncate block">{assetData?.selectedPage?.name || "Codeaxys Marketing Test"}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">Selected Ad Copy</span>
                              <span className="font-bold text-white">Variation #{editorData.selectedAdCopyIndex + 1}</span>
                            </div>
                          </div>
                        </div>

                        {/* LIVE AD PREVIEW CARD */}
                        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-md space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <Megaphone className="w-4 h-4 text-purple-600" />
                              <span>Live Visual Ad Preview</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Facebook Feed</span>
                          </div>

                          {/* Mock Facebook Post Frame */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs font-sans">
                            {/* Profile Header */}
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                                {(assetData?.selectedPage?.name || "C")[0]}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs">{assetData?.selectedPage?.name || "Codeaxys Marketing Test"}</div>
                                <div className="text-[10px] text-slate-400 font-medium">Sponsored · 🌐</div>
                              </div>
                            </div>

                            {/* Primary Text */}
                            <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-line font-sans">
                              {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.primaryText || "Transform your well-being with personalized Naturopathy services."}
                            </p>

                            {/* Image / Creative Placeholder */}
                            {editorData.selectedImageUrl ? (
                              <img src={editorData.selectedImageUrl} alt="Ad Preview" className="w-full h-40 object-cover rounded-lg" />
                            ) : (
                              <div className="w-full h-36 rounded-lg bg-gradient-to-br from-purple-100 via-indigo-50 to-slate-100 border border-purple-100 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                                <Sparkles className="w-6 h-6 text-purple-400 mb-1" />
                                <span className="text-[11px] font-bold text-purple-900">{editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.headline}</span>
                                <span className="text-[10px] text-slate-500">Naturopathy & Holistic Healthcare</span>
                              </div>
                            )}

                            {/* Link Card / Footer */}
                            <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                              <div className="overflow-hidden">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">WEBSITE.COM{editorData.selectedPage}</span>
                                <div className="font-extrabold text-slate-900 text-xs truncate">
                                  {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.headline || "Book Consultation"}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.description || "Book your appointment."}
                                </div>
                              </div>

                              <span className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-900 font-bold text-xs shrink-0">
                                {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.cta || "Book Now"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM ACTIONS (EDITOR) */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                      <button
                        onClick={() => setEditorStep("strategy")}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                      >
                        Back to Strategy
                      </button>

                      <button
                        onClick={handleContinueToReview}
                        disabled={isApproving}
                        className="py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Validating & Saving Editor State...</span>
                          </>
                        ) : (
                          <>
                            <span>Continue to Review</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: REVIEW META CAMPAIGN SCREEN */}
                {editorStep === "review" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="font-black text-slate-900 text-lg">Review Meta Campaign</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Review everything before creating the campaign in Meta.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold self-start sm:self-auto">
                        3. Review & Create
                      </span>
                    </div>

                    {/* Final Settings Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Campaign Details</span>
                        <div className="font-extrabold text-slate-900 text-sm">{editorData.campaignName}</div>
                        <div className="text-slate-600">Objective: <strong>{editorData.objective}</strong></div>
                        <div className="text-slate-600">Buying Type: <strong>{editorData.buyingType}</strong></div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Ad Set & Audience</span>
                        <div className="font-bold text-slate-900">📍 Location: {editorData.location}</div>
                        <div className="text-slate-600">👥 Age: {editorData.ageRange} | Gender: {editorData.gender}</div>
                        <div className="text-slate-500 text-[11px] truncate">{editorData.audienceSummary}</div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Budget & Duration</span>
                        <div className="font-extrabold text-emerald-700 text-sm">₹{editorData.dailyBudget.toLocaleString()}/day ({editorData.durationDays} Days)</div>
                        <div className="font-black text-slate-900 text-xs">Total Maximum Spend: ₹{(editorData.dailyBudget * editorData.durationDays).toLocaleString()} INR</div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Assets & Identity</span>
                        <div className="font-bold text-slate-900">Ad Account: {assetData?.selectedAdAccount?.name || "Codeaxys Ads"}</div>
                        <div className="text-slate-700">Page: {assetData?.selectedPage?.name || "Codeaxys Marketing Test"}</div>
                        <div className="text-slate-500 text-[11px]">
                          Instagram: {assetData?.selectedInstagramAccount ? `@${assetData.selectedInstagramAccount.username}` : "No connected Instagram Professional Account"}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Destination</span>
                        <div className="font-bold text-slate-900">Selected Page: {editorData.selectedPage}</div>
                        <div className="text-slate-600">Lead Form: {editorData.leadDestination}</div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Selected Ad Copy</span>
                        <div className="font-bold text-slate-900 truncate">
                          Variation #{editorData.selectedAdCopyIndex + 1}: {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.headline}
                        </div>
                        <div className="text-slate-600 font-bold">CTA: {editorData.adCopyVariations[editorData.selectedAdCopyIndex]?.cta}</div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Ad Creative Image</span>
                        {editorData.selectedImageUrl ? (
                          <div className="flex items-center gap-3">
                            <img src={editorData.selectedImageUrl} alt="Creative Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0" />
                            <div className="overflow-hidden">
                              <span className="font-bold text-slate-900 text-xs block">Image Asset Selected</span>
                              <span className="text-[10px] text-slate-500 font-mono truncate block">{editorData.selectedImageUrl}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500 font-medium text-xs">No image selected (Text-only ad copy format)</div>
                        )}
                      </div>
                    </div>

                    {/* STRICT SAFETY WARNING BANNER */}
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs leading-relaxed flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-amber-950 text-sm mb-0.5">Strict Safety & Paused Mode Guarantee:</strong>
                        Your campaign will be created in Meta in <strong>PAUSED</strong> mode. No advertising spend will begin until the campaign is explicitly activated.
                      </div>
                    </div>

                    {/* ERROR PANEL IF CREATION FAILED */}
                    {errorMsg && (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Campaign creation failed.</span>
                        </div>
                        <p className="text-rose-800 text-[11px] font-mono pl-6">{errorMsg}</p>
                      </div>
                    )}

                    {/* PUBLISHING PROGRESS STEPPER */}
                    {isPublishing && (
                      <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-purple-950 font-bold">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          <span>{publishingStepText}</span>
                        </div>
                        <div className="w-full bg-purple-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-purple-600 h-full w-3/4 animate-pulse transition-all" />
                        </div>
                      </div>
                    )}

                    {/* BOTTOM ACTIONS (REVIEW) */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                      <button
                        onClick={() => setEditorStep("editor")}
                        disabled={isPublishing}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                      >
                        Back to Edit
                      </button>

                      <button
                        onClick={handlePublishCampaign}
                        disabled={isPublishing}
                        className="py-3.5 px-7 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2.5 transition-all shadow-lg active:scale-98 cursor-pointer"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Creating campaign...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Create Campaign in Meta</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: SUCCESS / POST-CREATION MANAGEMENT SCREEN VIEW */}
                {editorStep === "success" && publishResult && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="p-5 sm:p-6 rounded-2xl bg-emerald-950 text-white border border-emerald-800 space-y-5 shadow-lg">
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-800">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                          <div>
                            <h5 className="font-extrabold text-base text-white">
                              Campaign Created & Managed in Meta
                            </h5>
                            <span className="text-[11px] text-emerald-300">
                              Current Status: <strong>{publishResult.campaignStatus || "PAUSED"}</strong> (Safety Mode Active)
                            </span>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-200 text-xs font-bold uppercase">
                          {publishResult.campaignStatus || "PAUSED"}
                        </span>
                      </div>

                      {syncWarning && (
                        <div className="p-3.5 rounded-xl bg-amber-900/60 border border-amber-700 text-amber-200 text-xs flex items-center justify-between gap-2">
                          <span className="font-medium">{syncWarning}</span>
                          <button
                            onClick={() => setSyncWarning(null)}
                            className="text-amber-300 hover:text-white font-bold text-xs underline cursor-pointer shrink-0"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-emerald-300">Meta Campaign ID</span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-700">
                              {publishResult.campaignStatus || "PAUSED"}
                            </span>
                          </div>
                          <code className="text-white font-mono font-bold block">{publishResult.metaCampaignId || "n/a"}</code>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-emerald-300">Meta Ad Set ID</span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-700">
                              {publishResult.adsetStatus || "PAUSED"}
                            </span>
                          </div>
                          <code className="text-white font-mono font-bold block">{publishResult.metaAdsetId || "n/a"}</code>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-emerald-300">Meta Ad Creative ID</span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-700">
                              READY
                            </span>
                          </div>
                          <code className="text-white font-mono font-bold block">{publishResult.metaCreativeId || "n/a"}</code>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-emerald-300">Meta Ad ID</span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 border border-emerald-700">
                              {publishResult.adStatus || "PAUSED"}
                            </span>
                          </div>
                          <code className="text-white font-mono font-bold block">{publishResult.metaAdId || "n/a"}</code>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-900/40 border border-emerald-800 text-emerald-200 text-xs font-medium">
                        No advertising spend has started. The campaign and all sub-objects remain safely in PAUSED state.
                      </div>

                      <div className="pt-2 border-t border-emerald-800 flex flex-wrap items-center justify-between gap-3">
                        <button
                          onClick={() => setEditorStep("strategy")}
                          className="px-4 py-2.5 rounded-xl border border-emerald-700 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs transition-all cursor-pointer"
                        >
                          Back to Campaign Strategy
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRefreshStatus}
                            disabled={isSyncingStatus}
                            className="py-2.5 px-4 rounded-xl border border-emerald-700 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                          >
                            {isSyncingStatus ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Refreshing...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Refresh Status</span>
                              </>
                            )}
                          </button>

                          <a
                            href={
                              publishResult?.metaCampaignId
                                ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${(selectedAdId || assetData?.selectedAdAccount?.id || "").replace(/^act_/, "")}&selected_campaign_ids=${publishResult.metaCampaignId}`
                                : `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${(selectedAdId || assetData?.selectedAdAccount?.id || "").replace(/^act_/, "")}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-4 rounded-xl bg-white text-emerald-950 hover:bg-emerald-100 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                          >
                            <span>Open in Meta Ads Manager</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {/* PHASE 5: UNIFIED LEAD INBOX UI */}
          {activeSection === "leads" && (
            <div className="relative z-10 space-y-6 animate-fadeIn">
              {/* Filters & Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <span>Unified Lead Inbox</span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Phase 5
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidated lead entries from native website contact forms and Meta Lead Ads.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Source Filter */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      onClick={() => setSourceFilter("all")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${sourceFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      All Sources
                    </button>
                    <button
                      onClick={() => setSourceFilter("website")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${sourceFilter === "website" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      🌐 Website Forms
                    </button>
                    <button
                      onClick={() => setSourceFilter("meta")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${sourceFilter === "meta" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      📘 Meta Lead Ads
                    </button>
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportLeadsCSV}
                    disabled={leadsList.length === 0}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-purple-600" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Lead Table / List */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                {isLoadingLeads ? (
                  <div className="p-12 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    <span>Loading Lead Inbox...</span>
                  </div>
                ) : leadsList.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mx-auto">
                      <Megaphone className="w-6 h-6" />
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm">No Leads Found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Submissions from your website contact forms and Meta Lead Ads will automatically appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                          <th className="p-3.5 pl-5">Lead Name / Contact</th>
                          <th className="p-3.5">Source</th>
                          <th className="p-3.5">Campaign / Form</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Date Received</th>
                          <th className="p-3.5 pr-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {leadsList.map((lead) => (
                          <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 pl-5">
                              <div className="font-bold text-slate-900 text-sm">{lead.name || "Anonymous Lead"}</div>
                              <div className="text-[11px] text-slate-500">{lead.email || lead.phone || "No direct contact"}</div>
                            </td>
                            <td className="p-3.5">
                              {lead.source === "meta" ? (
                                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[10px] uppercase">
                                  📘 Meta Ad
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[10px] uppercase">
                                  🌐 Website Form
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-800">{lead.campaign_name || lead.form_name || "Direct Inquiry"}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{lead.landing_page || lead.form_id || "/"}</div>
                            </td>
                            <td className="p-3.5">
                              <select
                                value={lead.status || "new"}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                                  lead.status === "converted"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : lead.status === "contacted"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : lead.status === "qualified"
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : lead.status === "lost"
                                    ? "bg-rose-50 text-rose-800 border-rose-200"
                                    : "bg-slate-100 text-slate-800 border-slate-200"
                                }`}
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="qualified">Qualified</option>
                                <option value="follow_up">Follow-up</option>
                                <option value="converted">Converted</option>
                                <option value="lost">Lost</option>
                              </select>
                            </td>
                            <td className="p-3.5 text-slate-500 text-[11px]">
                              {new Date(lead.created_at).toLocaleDateString()} {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3.5 pr-5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedLeadDetail(lead);
                                  setLeadNotesInput(lead.notes || "");
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all cursor-pointer"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Lead Detail Modal */}
              {selectedLeadDetail && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-fadeIn">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {selectedLeadDetail.source === "meta" ? "📘 Meta Lead Ad" : "🌐 Website Form Submission"}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-lg mt-1">
                          {selectedLeadDetail.name || "Anonymous Lead"}
                        </h4>
                      </div>
                      <button
                        onClick={() => setSelectedLeadDetail(null)}
                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Email Address</span>
                        <span className="font-bold text-slate-900">{selectedLeadDetail.email || "Not provided"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Phone Number</span>
                        <span className="font-bold text-slate-900">{selectedLeadDetail.phone || "Not provided"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Campaign / Source</span>
                        <span className="font-medium text-slate-700">{selectedLeadDetail.campaign_name || selectedLeadDetail.form_name || "Direct"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Landing Page</span>
                        <span className="font-medium text-slate-700 truncate block">{selectedLeadDetail.landing_page || "/"}</span>
                      </div>
                    </div>

                    {selectedLeadDetail.message && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Inquiry Message</span>
                        <p className="text-slate-800 whitespace-pre-line leading-relaxed font-sans">{selectedLeadDetail.message}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700 block">Lead Notes & Actions</label>
                      <textarea
                        rows={3}
                        value={leadNotesInput}
                        onChange={(e) => setLeadNotesInput(e.target.value)}
                        placeholder="Add internal notes about this lead (e.g. called on Monday, agreed to consult)..."
                        className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={() => handleSaveLeadNotes(selectedLeadDetail.id)}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PHASE 6: CAMPAIGN ANALYTICS + AI PERFORMANCE ANALYSIS + APPROVED OPTIMIZATION UI */}
          {activeSection === "performance" && (
            <div className="relative z-10 space-y-6 animate-fadeIn">
              {/* Header & Date Range Presets */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <span>Campaign Analytics & AI Optimization</span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Phase 6
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time performance metrics, CPL calculation, AI performance analysis, and approved optimization actions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: "today", label: "Today" },
                    { id: "yesterday", label: "Yesterday" },
                    { id: "last_7d", label: "Last 7 Days" },
                    { id: "last_14d", label: "Last 14 Days" },
                    { id: "last_30d", label: "Last 30 Days" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setDatePresetFilter(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        datePresetFilter === p.id
                          ? "bg-purple-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => fetchAnalytics(datePresetFilter)}
                    disabled={isFetchingAnalytics}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title="Refresh Analytics Data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingAnalytics ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Summary Metrics Grid */}
              {isFetchingAnalytics ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Fetching Meta campaign insights & lead metrics...</p>
                </div>
              ) : analyticsReport ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Spend</span>
                      <p className="text-lg font-black text-slate-900 mt-1">
                        {analyticsReport.currency === "INR" ? "₹" : "$"}{analyticsReport.summary.spend.toLocaleString()}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Impressions</span>
                      <p className="text-lg font-black text-slate-900 mt-1">
                        {analyticsReport.summary.impressions.toLocaleString()}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Clicks / CTR</span>
                      <p className="text-lg font-black text-slate-900 mt-1">
                        {analyticsReport.summary.clicks.toLocaleString()} <span className="text-xs text-purple-600 font-bold">({analyticsReport.summary.ctr}%)</span>
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Leads</span>
                      <p className="text-lg font-black text-purple-700 mt-1">
                        {analyticsReport.summary.totalLeads}
                      </p>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {analyticsReport.summary.metaLeads} Meta + {analyticsReport.summary.websiteLeads} Web
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Meta CPL</span>
                      <p className="text-lg font-black text-emerald-700 mt-1">
                        {analyticsReport.summary.metaCpl > 0 ? `${analyticsReport.currency === "INR" ? "₹" : "$"}${analyticsReport.summary.metaCpl}` : "N/A"}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Blended CPL</span>
                      <p className="text-lg font-black text-indigo-700 mt-1">
                        {analyticsReport.summary.blendedCpl > 0 ? `${analyticsReport.currency === "INR" ? "₹" : "$"}${analyticsReport.summary.blendedCpl}` : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Campaign Performance Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-900 text-sm">Campaign & Ad Performance Breakdown</h4>
                      <span className="text-xs text-slate-500 font-semibold">{analyticsReport.campaigns.length} Campaign(s)</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="p-3.5 pl-5">Campaign / Ad</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5">Spend</th>
                            <th className="p-3.5">Impressions</th>
                            <th className="p-3.5">CTR</th>
                            <th className="p-3.5">Meta Leads</th>
                            <th className="p-3.5">Web Leads</th>
                            <th className="p-3.5 pr-5">Meta CPL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analyticsReport.campaigns.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50/70 font-semibold">
                              <td className="p-3.5 pl-5 font-bold text-slate-900">
                                <div>{c.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">ID: {c.metaCampaignId}</div>
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono">{analyticsReport.currency === "INR" ? "₹" : "$"}{c.metrics.spend}</td>
                              <td className="p-3.5">{c.metrics.impressions.toLocaleString()}</td>
                              <td className="p-3.5">{c.metrics.ctr}%</td>
                              <td className="p-3.5 font-bold text-purple-700">{c.metrics.metaLeads}</td>
                              <td className="p-3.5 text-slate-600">{c.metrics.websiteLeads}</td>
                              <td className="p-3.5 pr-5 font-bold text-emerald-700">
                                {c.metrics.metaCpl > 0 ? `${analyticsReport.currency === "INR" ? "₹" : "$"}${c.metrics.metaCpl}` : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Daily Trend Visualizer */}
                  {analyticsReport.dailyTrends && analyticsReport.dailyTrends.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                      <h4 className="font-extrabold text-slate-900 text-sm mb-4">Daily Spend & Lead Volume Trends</h4>
                      <div className="grid grid-cols-7 gap-2">
                        {analyticsReport.dailyTrends.map((t: any) => (
                          <div key={t.date} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 block">{t.date.slice(5)}</span>
                            <span className="text-xs font-black text-slate-900 block">{analyticsReport.currency === "INR" ? "₹" : "$"}{t.spend}</span>
                            <span className="text-[10px] font-extrabold text-purple-700 block">{t.totalLeads} Leads</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Performance Analysis & Optimization Proposals */}
                  <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] font-extrabold uppercase tracking-wide mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                          <span>AI Growth Optimization Engine</span>
                        </div>
                        <h3 className="text-xl font-black text-white tracking-tight">AI Performance Analysis & Recommendations</h3>
                        <p className="text-xs text-purple-200/80 mt-1">
                          Gemini analyzes campaign efficiency, metrics, and lead attribution to formulate optimization proposals.
                        </p>
                      </div>

                      <button
                        onClick={handleRunAIAnalysis}
                        disabled={isAnalyzingAI}
                        className="px-5 py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-extrabold text-xs shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        {isAnalyzingAI ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Analyzing Performance...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Run AI Analysis (5 Credits)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiAnalysis && (
                      <div className="space-y-6 animate-fadeIn">
                        {/* Summary & Changes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                            <span className="text-[11px] font-extrabold uppercase text-purple-300 block">Performance Summary</span>
                            <p className="text-xs leading-relaxed text-slate-200">{aiAnalysis.performanceSummary}</p>
                          </div>

                          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                            <span className="text-[11px] font-extrabold uppercase text-purple-300 block">What Changed</span>
                            <p className="text-xs leading-relaxed text-slate-200">{aiAnalysis.whatChanged}</p>
                          </div>
                        </div>

                        {/* Signals */}
                        {aiAnalysis.keySignals && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                              <span className="text-[11px] font-extrabold uppercase text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Positive Signals</span>
                              </span>
                              <ul className="text-xs text-emerald-100 space-y-1 list-disc list-inside">
                                {(aiAnalysis.keySignals.positiveSignals || []).map((s: string, idx: number) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                              <span className="text-[11px] font-extrabold uppercase text-rose-400 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Optimization Areas</span>
                              </span>
                              <ul className="text-xs text-rose-100 space-y-1 list-disc list-inside">
                                {(aiAnalysis.keySignals.negativeSignals || []).map((s: string, idx: number) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Approved Optimization Proposals */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                            Optimization Proposals (Explicit Customer Approval Required)
                          </h4>

                          <div className="grid grid-cols-1 gap-4">
                            {(aiAnalysis.recommendations || []).map((rec: any) => (
                              <div key={rec.id} className="p-5 rounded-2xl bg-white text-slate-900 shadow-md space-y-4 border border-purple-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800">
                                      {rec.type === "update_budget" ? "Budget Update" : rec.type === "pause_ad" ? "Pause Ad" : "Pause Campaign"}
                                    </span>
                                    <h5 className="font-extrabold text-slate-900 text-sm">{rec.targetObjectName}</h5>
                                  </div>
                                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                                    rec.riskLevel === "low"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : rec.riskLevel === "high"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {rec.riskLevel || "medium"} Risk
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Current State</span>
                                    <span className="font-mono text-slate-700 font-bold">{rec.currentValue}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-purple-600 uppercase block">Proposed Optimized State (Max 20% Cap)</span>
                                    <span className="font-mono text-purple-900 font-bold">{rec.proposedValue}</span>
                                  </div>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <p className="text-slate-700 font-medium">
                                    <span className="font-bold text-slate-900">Reason:</span> {rec.reason}
                                  </p>
                                  {rec.impactExplanation && (
                                    <p className="text-slate-600">
                                      <span className="font-bold text-slate-800">Expected Impact:</span> {rec.impactExplanation}
                                    </p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[11px] text-slate-400 font-semibold">Requires explicit approval before Meta Graph API call</span>
                                  {rec.status === "executed" ? (
                                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5">
                                      <Check className="w-4 h-4 text-emerald-700" />
                                      Approved & Executed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleApproveOptimization(rec.id)}
                                      disabled={approvingRecId === rec.id}
                                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all shadow-2xs active:scale-98 cursor-pointer flex items-center gap-1.5"
                                    >
                                      {approvingRecId === rec.id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Executing Meta Mutation...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>Approve & Apply</span>
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </main>

      {/* MEDIA ASSET SELECTOR MODAL */}
      {showMediaSelectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Website Media Library
                </span>
                <h4 className="font-black text-slate-900 text-lg mt-1">Select Ad Creative Image</h4>
                <p className="text-xs text-slate-500">
                  Choose an image asset from your library or upload a new image file.
                </p>
              </div>
              <button
                onClick={handleCancelMediaSelection}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Controls Bar: Search & Upload */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                  placeholder="Search images by name..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <input
                  type="file"
                  ref={mediaFileInputRef}
                  onChange={(e) => handleUploadMediaAsset(e.target.files)}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                />
                <button
                  onClick={() => mediaFileInputRef.current?.click()}
                  disabled={isUploadingMedia}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading Image...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload New Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert inside Modal */}
            {mediaUploadError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between">
                <span>{mediaUploadError}</span>
                <button onClick={() => setMediaUploadError(null)} className="text-rose-600 font-bold hover:underline">Dismiss</button>
              </div>
            )}

            {/* Grid Content Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-1 min-h-[220px]">
              {isFetchingMedia ? (
                <div className="h-48 flex items-center justify-center gap-2 text-slate-500 text-xs font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <span>Loading Media Library...</span>
                </div>
              ) : mediaAssetsList.length === 0 ? (
                <div className="h-48 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <p className="text-xs font-bold text-slate-800">No images found in your media library.</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Upload JPEG, PNG, WebP or SVG graphics up to 5 MB to use in your ad campaign.
                  </p>
                  <button
                    onClick={() => mediaFileInputRef.current?.click()}
                    className="mt-1 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Image Now</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {mediaAssetsList
                    .filter((a) => !mediaSearchQuery || a.file_name.toLowerCase().includes(mediaSearchQuery.toLowerCase()))
                    .map((asset) => {
                      const isSelected = Boolean(tempSelectedAssetId) && tempSelectedAssetId === asset.id;
                      const assetUrl = asset.public_url;
                      return (
                        <div
                          key={asset.id}
                          onClick={() => {
                            setTempSelectedAssetId(asset.id);
                          }}
                          className={`group relative rounded-xl border p-2.5 cursor-pointer transition-all flex flex-col justify-between select-none ${
                            isSelected
                              ? "border-2 border-purple-600 bg-purple-50/70 shadow-md ring-2 ring-purple-500/20"
                              : "border-slate-200 bg-white hover:border-purple-300 hover:shadow-2xs"
                          }`}
                        >
                          <div className="h-28 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center relative">
                            {assetUrl ? (
                              <img src={assetUrl} alt={asset.file_name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                            )}

                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md z-10 animate-fadeIn">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="mt-2 text-left">
                            <div className="font-extrabold text-slate-900 text-xs truncate" title={asset.file_name}>
                              {asset.file_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {asset.file_size_bytes ? `${Math.round(asset.file_size_bytes / 1024)} KB` : "Image"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleCancelMediaSelection}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {tempSelectedAssetId && (
                  <button
                    onClick={() => setTempSelectedAssetId("")}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-all cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}

                <button
                  onClick={handleConfirmMediaSelection}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Selected Image</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Marketing Agent Conversational Assistant */}
      <MarketingAgentChat websiteId={website.id} />
    </div>
  );
}
