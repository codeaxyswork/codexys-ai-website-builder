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
  Bot,
  RotateCcw,
  Globe,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { SUPPORTED_LANGUAGES, getLanguageConfig } from "@/lib/multilingual";

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
];

export function CodeaxysAIAssistant({ onUsePrompt }: CodeaxysAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>("auto");

  // Dual-Engine Audio State & Refs
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Background Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Client Live Feedback Ref
  const recognitionRef = useRef<any>(null);

  // Transcript Synchronization Refs
  const initialInputRef = useRef<string>("");
  const liveSpeechTranscriptRef = useRef<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("codeaxys_conversation_lang");
      if (saved) {
        setSelectedLang(saved);
      }
    } catch (e) {}
  }, []);

  // Helper to detect browser SpeechRecognition support
  const getSpeechRecognitionClass = () => {
    if (typeof window === "undefined") return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  };

  // Helper to detect best supported MediaRecorder audio MIME type
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/wav",
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  // Helper to update composer input dynamically during live speech recording
  const updateComposerLiveInput = (liveSpeech: string) => {
    liveSpeechTranscriptRef.current = liveSpeech;
    const baseText = initialInputRef.current.trim();
    const speechText = liveSpeech.trim();

    let fullText = baseText;
    if (speechText) {
      fullText = baseText ? `${baseText} ${speechText}` : speechText;
    }
    setInputValue(fullText);
  };

  // Cleanup media recording streams and recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const handleLangChange = (code: string) => {
    setSelectedLang(code);
    try {
      localStorage.setItem("codeaxys_conversation_lang", code);
      window.dispatchEvent(new CustomEvent("codeaxys_lang_changed", { detail: code }));
    } catch (e) {}
  };

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

  // Start Hybrid Dual-Engine (Live Client SpeechRecognition + Authoritative Server MediaRecorder)
  const startListening = async () => {
    setAudioError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone recording is not supported in this browser. You can type your message.");
      return;
    }

    initialInputRef.current = inputValue;
    liveSpeechTranscriptRef.current = "";

    try {
      // 1. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Start Background MediaRecorder (Authoritative Waveform Data)
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up media stream tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        const finalMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });

        if (!audioBlob || audioBlob.size === 0) {
          setIsListening(false);
          setIsTranscribing(false);
          return;
        }

        // Send Audio Blob to Server Gemini AI Transcription /api/transcribe
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `recording.${finalMimeType.includes("wav") ? "wav" : "webm"}`);
          formData.append("language", selectedLang);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (res.ok && data.success && data.transcript) {
            const cleanAiTranscript = data.transcript.trim();
            if (cleanAiTranscript) {
              const baseText = initialInputRef.current.trim();
              const fullText = baseText ? `${baseText} ${cleanAiTranscript}` : cleanAiTranscript;
              setInputValue(fullText);
            }
          } else if (data.error) {
            console.warn("AI Transcription Endpoint Notice:", data.error);
          }
        } catch (err: any) {
          console.error("Audio Transcription Request Error:", err);
        } finally {
          setIsTranscribing(false);
          setIsListening(false);
        }
      };

      // Start MediaRecorder with 100ms continuous chunks
      mediaRecorder.start(100);

      // 3. Start Client SpeechRecognition for Real-Time Live Feedback
      const SpeechRecognition = getSpeechRecognitionClass();
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;

          const langCfg = getLanguageConfig(selectedLang);
          if (langCfg.sttLocale) {
            recognition.lang = langCfg.sttLocale;
          } else {
            const detectedLang =
              (navigator.languages && navigator.languages.length ? navigator.languages[0] : null) ||
              navigator.language ||
              "en-US";
            recognition.lang = detectedLang;
          }

          recognition.onresult = (event: any) => {
            let sessionFinal = "";
            let sessionInterim = "";

            for (let i = 0; i < event.results.length; ++i) {
              const result = event.results[i];
              const transcript = result[0]?.transcript ? result[0].transcript.trim() : "";
              if (!transcript) continue;

              if (result.isFinal) {
                sessionFinal += (sessionFinal ? " " : "") + transcript;
              } else {
                sessionInterim += (sessionInterim ? " " : "") + transcript;
              }
            }

            const liveCombined = (sessionFinal + " " + sessionInterim).trim();
            updateComposerLiveInput(liveCombined);
          };

          recognition.onerror = (event: any) => {
            if (event.error !== "no-speech" && event.error !== "aborted") {
              console.warn("Live SpeechRecognition notice:", event.error);
            }
          };

          recognition.start();
        } catch (srErr) {
          console.warn("SpeechRecognition Live initialization skipped:", srErr);
        }
      }

      setIsListening(true);
    } catch (err: any) {
      console.error("Microphone Access Error:", err);
      setIsListening(false);
      setIsTranscribing(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setAudioError("Microphone access denied. Please allow microphone permissions in browser settings.");
      } else {
        setAudioError("Could not access microphone.");
      }
    }
  };

  // Stop Dual-Engine Recording
  const stopListening = () => {
    // Stop Live SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else if (!isTranscribing) {
      startListening();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    if (isListening) stopListening();

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
          conversationLanguage: selectedLang,
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
    if (isListening) stopListening();
    setMessages([initialWelcomeMessage]);
    setInputValue("");
    setAudioError(null);
  };

  const renderFormattedText = (text: string) => {
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
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[999999] font-sans">
      {/* FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Open Codeaxys AI Assistant"
          aria-label="Open Codeaxys AI Assistant"
          className="group relative flex items-center gap-3 px-5 py-3.5 rounded-full bg-slate-950 text-white shadow-2xl shadow-purple-900/60 hover:bg-purple-950 border-2 border-purple-500/70 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-purple-500/20"
        >
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-85 blur-sm group-hover:opacity-100 transition-opacity animate-pulse" />

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/50">
              <Sparkles className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                Codeaxys AI <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shadow-xs shadow-emerald-400" />
              </span>
              <span className="text-[10px] text-purple-200 font-bold tracking-tight">Ask or Speak Website Prompts</span>
            </div>
          </div>
        </button>
      )}

      {/* CHAT POPUP WINDOW */}
      {isOpen && (
        <div className="w-[350px] sm:w-[400px] md:w-[420px] h-[540px] sm:h-[600px] bg-white rounded-3xl border border-purple-200/90 shadow-2xl shadow-purple-950/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* HEADER BAR */}
          <div className="bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 px-4 py-3.5 text-white flex items-center justify-between border-b border-purple-800/40 shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-950/50 relative shrink-0">
                <Bot className="w-4 h-4 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight">Codeaxys AI</h3>
                  <span className="text-[9px] font-extrabold text-purple-300 bg-purple-900/80 px-1.5 py-0.2 rounded border border-purple-700/50">
                    Guide
                  </span>
                </div>
                <p className="text-[10px] text-purple-200/80 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online • AI Website Expert
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* LANGUAGE SELECTOR */}
              <div className="flex items-center gap-1 bg-purple-900/50 border border-purple-700/60 rounded-lg px-2 py-1 text-white">
                <Globe className="w-3 h-3 text-purple-300 shrink-0" />
                <select
                  value={selectedLang}
                  onChange={(e) => handleLangChange(e.target.value)}
                  aria-label="Select AI Conversation Language"
                  className="bg-transparent text-[11px] font-semibold text-purple-100 outline-none cursor-pointer max-w-[95px] truncate"
                  title="Select AI Conversation Language"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-950 text-white">
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* RESET CONVERSATION */}
              <button
                onClick={handleResetChat}
                title="Start new conversation"
                aria-label="Start new conversation"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-purple-900/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* CLOSE CHAT */}
              <button
                onClick={() => {
                  stopListening();
                  setIsOpen(false);
                }}
                title="Close AI assistant"
                aria-label="Close AI assistant"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-purple-900/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MESSAGES FEED AREA */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/70 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start items-start"}`}
              >
                {/* AI AVATAR */}
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                {/* MESSAGE BUBBLE */}
                <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-xs"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs"
                    }`}
                  >
                    {renderFormattedText(msg.text)}

                    {/* SUGGESTED PROMPT CARD */}
                    {msg.suggestedPrompt && (
                      <div className="mt-3 p-3 rounded-xl bg-purple-50/90 border border-purple-200 text-slate-900 space-y-2">
                        <div className="flex items-center justify-between text-purple-700 font-bold text-xs border-b border-purple-200/60 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Generated Website Prompt
                          </span>
                          <span className="text-[10px] bg-purple-200/80 text-purple-800 px-2 py-0.5 rounded font-mono">
                            Ready to Use
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-purple-200 text-xs font-sans text-slate-800 max-h-44 overflow-y-auto custom-scrollbar leading-relaxed">
                          {msg.suggestedPrompt}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleApplyPromptToGenerator(msg.suggestedPrompt!)}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Use Prompt</span>
                          </button>
                          <button
                            onClick={() => handleCopyPrompt(msg.suggestedPrompt!, msg.id)}
                            className="py-1.5 px-2.5 rounded-lg border border-purple-200 bg-white hover:bg-purple-100/60 text-purple-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
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
              </div>
            ))}

            {/* TYPING INDICATOR */}
            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3 shadow-xs">
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
          {messages.length === 1 && (
            <div className="px-3.5 py-2.5 bg-purple-50/60 border-t border-slate-200/80 shrink-0 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>Quick Action Starters:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                {QUICK_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    disabled={isLoading}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-600 text-slate-700 hover:text-white border border-purple-200/80 hover:border-purple-600 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* COMPOSER WITH VISIBLE MICROPHONE */}
          <div className="p-3 bg-white border-t border-slate-200/90 shrink-0 space-y-2">
            {/* RECORDING ACTIVE BADGE */}
            {isListening && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0" />
                  <span className="truncate">
                    Listening ({getLanguageConfig(selectedLang).label})... Speak now
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopListening}
                  className="text-xs text-rose-800 underline font-bold hover:text-rose-950 cursor-pointer shrink-0 ml-2"
                  aria-label="Stop recording"
                >
                  Stop
                </button>
              </div>
            )}

            {/* TRANSCRIBING LOADING BADGE */}
            {isTranscribing && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin shrink-0" />
                  <span className="truncate">AI finalizing transcript...</span>
                </div>
              </div>
            )}

            {/* AUDIO ERROR BADGE */}
            {audioError && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">{audioError}</span>
                </div>
                <button
                  onClick={() => setAudioError(null)}
                  className="text-amber-600 hover:text-amber-900 font-bold ml-2 shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            {/* INPUT FORM */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* CLEARLY VISIBLE MICROPHONE BUTTON */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading || isTranscribing}
                title={isListening ? "Stop recording" : "Speak to Codeaxys AI"}
                aria-label={isListening ? "Stop recording" : "Speak to Codeaxys AI"}
                className={`w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isListening
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse"
                    : isTranscribing
                    ? "bg-purple-100 text-purple-600 cursor-wait"
                    : "bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-white animate-bounce" />
                ) : isTranscribing ? (
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* CHAT INPUT */}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening..."
                    : isTranscribing
                    ? "AI finalizing transcript..."
                    : "Ask Codeaxys AI or describe your website..."
                }
                disabled={isLoading || isTranscribing}
                className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
              />

              {/* SEND BUTTON */}
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || isTranscribing}
                title="Send message"
                aria-label="Send message"
                className="w-9.5 h-9.5 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all cursor-pointer shadow-md shadow-purple-600/20 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1 px-1">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-purple-600" /> Type or Speak in Any Language
              </span>
              <span>Powered by Codeaxys</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
