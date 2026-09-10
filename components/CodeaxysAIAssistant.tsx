"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Wand2,
  Copy,
  Check,
  ArrowRight,
  Bot,
  HelpCircle,
  Zap,
  RotateCcw,
  Minimize2,
  ChevronRight,
  Globe,
  Coins,
  ShieldCheck,
} from "lucide-react";

export interface CodeaxysAIAssistantProps {
  onUsePrompt?: (generatedPrompt: string) => void;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestedPrompt?: string | null;
  timestamp: string;
}

const QUICK_STARTERS = [
  { label: "🚀 Create My Website", prompt: "I want to create a website for my business." },
  { label: "✍️ Help Me Write a Prompt", prompt: "Can you help me write a great prompt for my website?" },
  { label: "💡 Show How Codeaxys Works", prompt: "How does Codeaxys AI Website Builder work?" },
  { label: "🎨 What Can I Build?", prompt: "What types of websites can I build with Codeaxys?" },
  { label: "💳 Pricing & Features", prompt: "What are the pricing tiers and features?" },
  { label: "❓ I Have a Question", prompt: "I have a question about building a website." },
  { label: "💬 Talk to Support", prompt: "How can I contact support or get help?" },
];

export function CodeaxysAIAssistant({ onUsePrompt }: CodeaxysAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const initialWelcomeMessage: MessageItem = {
    id: "msg_welcome",
    role: "assistant",
    text: "Hi 👋 I'm **Codeaxys AI**.\n\nTell me what you're trying to build, and I'll help turn your idea into a complete website prompt!",
    timestamp: "Just now",
  };

  const [messages, setMessages] = useState<MessageItem[]>([initialWelcomeMessage]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputValue).trim();
    if (!messageContent || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const newUserMsg: MessageItem = {
      id: userMsgId,
      role: "user",
      text: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);

    try {
      // Build API history payload
      const historyPayload = messages
        .filter((m) => m.id !== "msg_welcome")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          content: m.text,
        }));

      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyPayload,
          userMessage: messageContent,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg: MessageItem = {
          id: `assistant_err_${Date.now()}`,
          role: "assistant",
          text: data.error || "I ran into a temporary connection issue. Please try again!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const assistantMsg: MessageItem = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        text: data.text || "I can help you build that website prompt!",
        suggestedPrompt: data.suggestedPrompt || null,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Assistant Chat Error:", err);
      const errorMsg: MessageItem = {
        id: `assistant_err_${Date.now()}`,
        role: "assistant",
        text: "I experienced a network error. Please try sending your message again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPrompt = (promptText: string, id: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const handleApplyPromptToGenerator = (promptText: string) => {
    if (onUsePrompt) {
      onUsePrompt(promptText);
    }
    const el = document.getElementById("hero-generator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
    setIsOpen(false);
  };

  const handleResetChat = () => {
    setMessages([initialWelcomeMessage]);
    setInputValue("");
  };

  const renderFormattedText = (text: string) => {
    // Simple markdown-style line breaks and bold formatting
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[999999] font-sans">
      {/* FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-5.5 py-4 rounded-full bg-slate-950 text-white shadow-2xl shadow-purple-900/60 hover:bg-purple-950 border-2 border-purple-500/70 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-purple-500/20"
        >
          {/* Pulsing Outer Purple Glow Aura */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-85 blur-sm group-hover:opacity-100 transition-opacity animate-pulse" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/50">
              <Sparkles className="w-4.5 h-4.5 text-white animate-spin-slow" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                Codeaxys AI <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block shadow-sm shadow-emerald-400" />
              </span>
              <span className="text-[10px] text-purple-200 font-bold tracking-tight">Ask or Build Website Prompts</span>
            </div>
          </div>
        </button>
      )}

      {/* CHAT POPUP WINDOW */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[580px] sm:h-[640px] bg-white rounded-3xl border border-purple-200/90 shadow-2xl shadow-purple-950/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* HEADER BAR */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-purple-900/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-900/50 relative">
                <Bot className="w-5 h-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-white">
                  Codeaxys AI
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full border border-purple-700/50">
                    Guide
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online • AI Website Expert
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                title="Reset Conversation"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Chat"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* MESSAGES FEED AREA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-none shadow-xs"
                  }`}
                >
                  {renderFormattedText(msg.text)}

                  {/* PROMPT GENERATED CARD */}
                  {msg.suggestedPrompt && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-purple-50/90 border border-purple-200 text-slate-900 space-y-2.5">
                      <div className="flex items-center justify-between text-purple-700 font-bold text-xs border-b border-purple-200/60 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          Generated Website Prompt
                        </span>
                        <span className="text-[10px] bg-purple-200/80 text-purple-800 px-2 py-0.5 rounded font-mono">
                          Ready to Use
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-purple-200 text-xs font-sans text-slate-800 max-h-48 overflow-y-auto custom-scrollbar leading-relaxed">
                        {msg.suggestedPrompt}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApplyPromptToGenerator(msg.suggestedPrompt!)}
                          className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Use Prompt in Generator</span>
                        </button>
                        <button
                          onClick={() => handleCopyPrompt(msg.suggestedPrompt!, msg.id)}
                          className="py-2 px-3 rounded-lg border border-purple-200 bg-white hover:bg-purple-100/60 text-purple-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          {copiedPromptId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-purple-600" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* TYPING INDICATOR DOTS */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-xs">
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

          {/* QUICK STARTER CHIPS (If chat has only welcome message) */}
          {messages.length === 1 && (
            <div className="p-3 bg-slate-100/80 border-t border-slate-200 space-y-2 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block px-1">
                Quick Action Starters:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                {QUICK_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    disabled={isLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-all cursor-pointer shadow-2xs text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT BAR */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Codeaxys AI or describe your website..."
                disabled={isLoading}
                className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-purple-600/20 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-2 px-1">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-purple-600" /> Multilingual AI Assistant
              </span>
              <span>Powered by Codeaxys</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
