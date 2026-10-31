import { GeneratedFile, WebsitePlan } from "./types";
import { SaveState } from "@/components/SaveStatus";

export interface LocalDraft {
  websiteId: string | null;
  prompt: string;
  plan: WebsitePlan | null;
  files: GeneratedFile[];
  timestamp: number;
  version: number;
}

const LOCAL_DRAFT_KEY_PREFIX = "codeaxys_draft_";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days expiry

/**
 * Generates local storage key for draft isolation.
 */
function getStorageKey(websiteId?: string | null): string {
  if (websiteId && websiteId.trim()) {
    return `${LOCAL_DRAFT_KEY_PREFIX}${websiteId.trim()}`;
  }
  return `${LOCAL_DRAFT_KEY_PREFIX}active_project`;
}

/**
 * Saves current editing state to browser localStorage immediately.
 * Provides synchronous crash-proof persistence against refresh or network drop.
 */
export function saveLocalDraft(
  files: GeneratedFile[],
  plan: WebsitePlan | null,
  prompt: string,
  websiteId: string | null,
  version: number
): boolean {
  if (typeof window === "undefined" || !files || files.length === 0) {
    return false;
  }

  try {
    const draft: LocalDraft = {
      websiteId,
      prompt,
      plan,
      files,
      timestamp: Date.now(),
      version,
    };

    const key = getStorageKey(websiteId);
    localStorage.setItem(key, JSON.stringify(draft));

    // Also update active pointer
    if (websiteId) {
      localStorage.setItem(`${LOCAL_DRAFT_KEY_PREFIX}latest_id`, websiteId);
    }
    return true;
  } catch (err) {
    console.warn("[Autosave] Failed to write local draft to localStorage:", err);
    return false;
  }
}

/**
 * Retrieves a recoverable local draft.
 */
export function getLocalDraft(websiteId?: string | null): LocalDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getStorageKey(websiteId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const draft = JSON.parse(raw) as LocalDraft;

    // Validate draft integrity
    if (!draft || !Array.isArray(draft.files) || draft.files.length === 0) {
      return null;
    }

    // Check expiry
    if (Date.now() - draft.timestamp > MAX_DRAFT_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn("[Autosave] Failed to parse local draft:", err);
    return null;
  }
}

/**
 * Clears local draft when project is reset or cleanly saved.
 */
export function clearLocalDraft(websiteId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(websiteId);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("[Autosave] Failed to clear local draft:", err);
  }
}

export interface AutoSavePayload {
  websiteId: string | null;
  prompt: string;
  plan: WebsitePlan | null;
  files: GeneratedFile[];
  version: number;
}

export interface AutoSaveConfig {
  onStatusChange: (status: SaveState) => void;
  onSaveSuccess: (result: { websiteId: string; slug: string; title: string }) => void;
  debounceMs?: number;
}

/**
 * Resilient Client-Side AutoSave & Network Recovery Engine
 */
export class AutoSaveEngine {
  private config: AutoSaveConfig;
  private currentVersion = 0;
  private highestSavedVersion = 0;
  private isSaving = false;
  private pendingPayload: AutoSavePayload | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private maxRetries = 8;
  private isOnline = true;
  private isDestroyed = false;

  constructor(config: AutoSaveConfig) {
    this.config = config;

    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;

      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    // When returning online, flush any pending save immediately
    if (this.pendingPayload) {
      this.config.onStatusChange("retrying");
      this.flushImmediate();
    }
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.config.onStatusChange("offline");
  };

  /**
   * Schedules a debounced autosave.
   * If `immediate` is true (e.g. after AI edit), executes without debouncing.
   */
  public triggerSave(
    files: GeneratedFile[],
    plan: WebsitePlan | null,
    prompt: string,
    websiteId: string | null,
    immediate: boolean = false
  ): void {
    if (this.isDestroyed || !files || files.length === 0) return;

    this.currentVersion++;
    const version = this.currentVersion;

    // 1. Immediately save to localStorage for crash/refresh protection
    saveLocalDraft(files, plan, prompt, websiteId, version);

    const payload: AutoSavePayload = {
      websiteId,
      prompt,
      plan,
      files,
      version,
    };

    this.pendingPayload = payload;

    if (immediate) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.flushImmediate();
    } else {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.flushImmediate();
      }, this.config.debounceMs || 1500);
    }
  }

  /**
   * Flushes the pending save payload to the server.
   * Protects against concurrent overlapping saves and stale writes.
   */
  private async flushImmediate(): Promise<void> {
    if (this.isDestroyed || !this.pendingPayload) return;

    // If a save is already in-flight, do not start another one;
    // the currently running save will flush pendingPayload upon completion.
    if (this.isSaving) {
      return;
    }

    if (typeof window !== "undefined" && !navigator.onLine) {
      this.isOnline = false;
      this.config.onStatusChange("offline");
      this.scheduleRetry();
      return;
    }

    const payloadToSave = this.pendingPayload;
    this.pendingPayload = null;
    this.isSaving = true;

    this.config.onStatusChange(this.retryAttempt > 0 ? "retrying" : "saving");
    let saveFailed = false;

    try {
      const response = await fetch("/api/websites/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: payloadToSave.websiteId || undefined,
          prompt: payloadToSave.prompt,
          plan: payloadToSave.plan,
          files: payloadToSave.files,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          // Unauthenticated session: safely keep in localStorage draft without infinite retry loop
          this.isSaving = false;
          this.config.onStatusChange("idle");
          return;
        }
        throw new Error(data.error || "Save request failed");
      }

      // Check for stale response
      if (payloadToSave.version >= this.highestSavedVersion) {
        this.highestSavedVersion = payloadToSave.version;

        this.retryAttempt = 0;
        this.config.onStatusChange("saved");
        this.config.onSaveSuccess({
          websiteId: data.websiteId,
          slug: data.slug,
          title: data.title,
        });

        // Update local draft with confirmed server ID
        saveLocalDraft(
          payloadToSave.files,
          payloadToSave.plan,
          payloadToSave.prompt,
          data.websiteId,
          payloadToSave.version
        );

        setTimeout(() => {
          if (!this.isSaving && !this.pendingPayload) {
            this.config.onStatusChange("idle");
          }
        }, 2500);
      }
    } catch (err: unknown) {
      saveFailed = true;
      console.warn("[Autosave] Network/Server Save Error:", err);

      // Re-queue the payload that failed if no newer payload has arrived
      if (!this.pendingPayload) {
        this.pendingPayload = payloadToSave;
      }

      const isNetworkError =
        typeof window !== "undefined" &&
        (!navigator.onLine ||
          err instanceof TypeError ||
          (err instanceof Error && err.message.toLowerCase().includes("fetch")));

      if (isNetworkError) {
        this.isOnline = false;
        this.config.onStatusChange("offline");
      } else {
        this.config.onStatusChange("error");
      }

      this.scheduleRetry();
    } finally {
      this.isSaving = false;

      // Only flush immediately if the previous save SUCCEEDED and a newer payload arrived while saving
      if (!saveFailed && this.pendingPayload && this.pendingPayload.version > payloadToSave.version) {
        this.flushImmediate();
      }
    }
  }

  /**
   * Schedules a retry with bounded exponential backoff and jitter.
   */
  private scheduleRetry(): void {
    if (this.isDestroyed || this.retryTimer) return;

    if (this.retryAttempt >= this.maxRetries) {
      console.warn("[Autosave] Max retry attempts reached. Buffered in localStorage.");
      this.config.onStatusChange(this.isOnline ? "error" : "offline");
      return;
    }

    this.retryAttempt++;
    // Exponential backoff: 1.5s, 3s, 6s, 12s, max 20s
    const baseDelay = Math.min(1500 * Math.pow(2, this.retryAttempt - 1), 20000);
    const jitter = Math.random() * 500;
    const delay = Math.round(baseDelay + jitter);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.isDestroyed) {
        this.flushImmediate();
      }
    }, delay);
  }
}
