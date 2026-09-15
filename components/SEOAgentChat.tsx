"use client";

import React from "react";
import { CodeaxysAIAssistant } from "./CodeaxysAIAssistant";

export interface SEOAgentChatProps {
  websiteId: string;
  userPlan?: string;
  userCredits?: number;
  gscConnected?: boolean;
  onNavigateTab: (tabId: string) => void;
}

export function SEOAgentChat(props: SEOAgentChatProps) {
  return <CodeaxysAIAssistant mode="seo" {...props} />;
}
