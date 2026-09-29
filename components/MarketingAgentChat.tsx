"use client";

import React from "react";
import { CodeaxysAIAssistant } from "./CodeaxysAIAssistant";

export interface MarketingAgentChatProps {
  websiteId: string;
  userPlan?: string;
  userCredits?: number;
  onNavigateTab?: (tabId: string) => void;
}

export function MarketingAgentChat(props: MarketingAgentChatProps) {
  return <CodeaxysAIAssistant mode="marketing" {...props} />;
}
