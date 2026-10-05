"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getLanguageConfig } from "@/lib/multilingual";

export interface UseVoiceInputOptions {
  selectedLang?: string;
  onTranscriptUpdate?: (finalText: string, interimText: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (errorMessage: string) => void;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  interimTranscript: string;
  isSupported: boolean;
  startListening: (options?: { lang?: string; baseText?: string }) => Promise<boolean>;
  stopListening: () => void;
  error: string | null;
}

/**
 * Universal, production-ready speech-to-text hook with deterministic lifecycle:
 * IDLE -> LISTENING -> USER SPEAKS -> TRANSCRIPT -> STOP -> RELEASE TRACKS -> IDLE.
 *
 * Guarantees:
 * - Immediate microphone cutoff upon stopListening()
 * - Full MediaStream track release
 * - Strict separation of final vs. interim transcripts
 * - Zero infinite restart loops on recognition end
 * - Zero background listening after message send
 * - Language-aware recognition (e.g. Malayalam ml-IN, English en-US)
 * - Safe component unmount cleanup
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { selectedLang = "auto", onTranscriptUpdate, onFinalTranscript, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseTextRef = useRef<string>("");
  const accumulatedFinalRef = useRef<string>("");

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  /**
   * Deterministically stops speech recognition and releases all media tracks immediately.
   */
  const stopListening = useCallback(() => {
    // 1. Synchronously flag as not listening to ignore any late onresult events
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript("");

    // 2. Stop SpeechRecognition instance
    if (recognitionRef.current) {
      try {
        // Nullify event handlers to prevent late trigger of onend / onresult
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      recognitionRef.current = null;
    }

    // 3. Stop and release any active MediaStream tracks
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {}
      mediaStreamRef.current = null;
    }
  }, []);

  /**
   * Starts a fresh speech recognition session with language configuration.
   */
  const startListening = useCallback(
    async (startOptions?: { lang?: string; baseText?: string }): Promise<boolean> => {
      if (typeof window === "undefined") return false;

      // Stop any existing session first
      stopListening();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        const msg = "Speech recognition is not supported in this browser. Please type your message.";
        setError(msg);
        if (onError) onError(msg);
        return false;
      }

      setError(null);
      setInterimTranscript("");
      baseTextRef.current = (startOptions?.baseText || "").trim();
      accumulatedFinalRef.current = "";

      // Attempt to acquire microphone permission and hold stream for explicit release
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          if (stream) {
            mediaStreamRef.current = stream;
          }
        }
      } catch (permErr) {
        // Fallback to native SpeechRecognition browser prompt if getUserMedia is restricted
      }

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // Language locale resolution
        const langCode = startOptions?.lang || selectedLang;
        const langCfg = getLanguageConfig(langCode);

        if (langCfg && langCfg.sttLocale) {
          recognition.lang = langCfg.sttLocale;
        } else if (langCode === "auto") {
          const browserLang =
            (navigator.languages && navigator.languages[0]) || navigator.language || "en-US";
          recognition.lang = browserLang;
        } else {
          recognition.lang = "en-US";
        }

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          if (!isListeningRef.current) return;

          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            const transcript = res[0]?.transcript ? res[0].transcript : "";
            if (!transcript) continue;

            if (res.isFinal) {
              const cleanFinal = transcript.trim();
              if (cleanFinal) {
                accumulatedFinalRef.current +=
                  (accumulatedFinalRef.current ? " " : "") + cleanFinal;
              }
            } else {
              currentInterim += transcript;
            }
          }

          setInterimTranscript(currentInterim);

          const finalPart = [baseTextRef.current, accumulatedFinalRef.current]
            .filter(Boolean)
            .join(" ")
            .trim();

          if (onTranscriptUpdate) {
            onTranscriptUpdate(finalPart, currentInterim);
          }
        };

        recognition.onerror = (event: any) => {
          if (!isListeningRef.current) return;

          const errCode = event.error || "unknown";

          // Harmless non-blocking speech recognition events
          if (errCode === "no-speech") {
            stopListening();
            return;
          }

          let userFriendlyMessage = "Speech recognition error. Please try speaking again.";
          if (errCode === "not-allowed" || errCode === "permission-denied") {
            userFriendlyMessage =
              "Microphone access was denied. Please allow microphone permissions in your browser.";
          } else if (errCode === "audio-capture") {
            userFriendlyMessage = "No microphone was found or microphone is in use by another application.";
          } else if (errCode === "network") {
            userFriendlyMessage = "Speech service network error. Please verify your internet connection.";
          }

          setError(userFriendlyMessage);
          if (onError) onError(userFriendlyMessage);

          stopListening();
        };

        // Deterministic onend: ALWAYS return to IDLE. NO infinite auto-restart loop.
        recognition.onend = () => {
          isListeningRef.current = false;
          setIsListening(false);
          setInterimTranscript("");

          const finalFull = [baseTextRef.current, accumulatedFinalRef.current]
            .filter(Boolean)
            .join(" ")
            .trim();

          if (onFinalTranscript && accumulatedFinalRef.current) {
            onFinalTranscript(finalFull);
          }

          // Release media tracks if any
          if (mediaStreamRef.current) {
            try {
              mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            } catch (_) {}
            mediaStreamRef.current = null;
          }
        };

        recognition.start();
        return true;
      } catch (err: any) {
        console.warn("Failed to initialize speech recognition:", err);
        stopListening();
        const failMsg = "Unable to start speech recognition. Please try typing.";
        setError(failMsg);
        if (onError) onError(failMsg);
        return false;
      }
    },
    [selectedLang, onTranscriptUpdate, onFinalTranscript, onError, stopListening]
  );

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    error,
  };
}
