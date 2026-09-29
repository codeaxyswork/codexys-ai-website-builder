"use client";

import React from "react";
import { CodeaxysAIAssistant } from "./CodeaxysAIAssistant";

export interface WebsiteAgentChatProps {
  websiteId?: string;
  userPlan?: string;
  userCredits?: number;
  onNavigateTab?: (tabId: string) => void;
  onUsePrompt?: (generatedPrompt: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isWidget?: boolean;
}

export function WebsiteAgentChat(props: WebsiteAgentChatProps) {
  return <CodeaxysAIAssistant mode="website" {...props} />;
}
