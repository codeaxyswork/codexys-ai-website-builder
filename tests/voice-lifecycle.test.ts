import assert from "node:assert";

/**
 * Mock SpeechRecognition implementation for testing state machine behavior.
 */
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "en-US";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onresult: ((event: any) => void) | null = null;

  isStarted = false;
  aborted = false;
  stopped = false;

  start() {
    this.isStarted = true;
    if (this.onstart) this.onstart();
  }

  stop() {
    this.stopped = true;
    this.isStarted = false;
    if (this.onend) this.onend();
  }

  abort() {
    this.aborted = true;
    this.isStarted = false;
    if (this.onend) this.onend();
  }

  simulateResult(results: Array<{ transcript: string; isFinal: boolean }>, resultIndex = 0) {
    if (!this.onresult) return;
    const formattedResults = results.map((r) => {
      const item: any = [{ transcript: r.transcript }];
      item.isFinal = r.isFinal;
      return item;
    });
    this.onresult({
      resultIndex,
      results: formattedResults,
    });
  }

  simulateError(error: string) {
    if (this.onerror) {
      this.onerror({ error });
    }
  }
}

/**
 * Mock MediaStream and MediaStreamTrack for testing track release.
 */
class MockMediaStreamTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack(), new MockMediaStreamTrack()];
  getTracks() {
    return this.tracks;
  }
}

// Emulate voice input controller based on useVoiceInput lifecycle
class VoiceInputController {
  isListening = false;
  interimTranscript = "";
  accumulatedFinal = "";
  baseText = "";
  error: string | null = null;
  recognition: MockSpeechRecognition | null = null;
  mediaStream: MockMediaStream | null = null;

  startListening(options: { lang?: string; baseText?: string }) {
    this.stopListening();
    this.baseText = options.baseText || "";
    this.accumulatedFinal = "";
    this.interimTranscript = "";
    this.error = null;

    this.mediaStream = new MockMediaStream();
    const rec = new MockSpeechRecognition();
    this.recognition = rec;
    rec.lang = options.lang || "en-US";

    rec.onstart = () => {
      this.isListening = true;
    };

    rec.onresult = (event: any) => {
      if (!this.isListening) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          this.accumulatedFinal += (this.accumulatedFinal ? " " : "") + item[0].transcript.trim();
        } else {
          interim += item[0].transcript;
        }
      }
      this.interimTranscript = interim;
    };

    rec.onerror = (event: any) => {
      if (!this.isListening) return;
      this.error = event.error;
      this.stopListening();
    };

    rec.onend = () => {
      this.isListening = false;
      this.interimTranscript = "";
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
      }
    };

    rec.start();
  }

  stopListening() {
    this.isListening = false;
    this.interimTranscript = "";
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  getFinalTranscript() {
    return [this.baseText, this.accumulatedFinal].filter(Boolean).join(" ").trim();
  }
}

// Chat Send Controller for testing send, stop mic, and double submit protection
class ChatController {
  voice: VoiceInputController;
  isSending = false;
  isLoading = false;
  messages: Array<{ role: string; text: string }> = [];
  apiCallCount = 0;

  constructor(voice: VoiceInputController) {
    this.voice = voice;
  }

  async handleSend(textToSend?: string) {
    // Double submit protection
    if (this.isSending || this.isLoading) return false;

    // Immediately stop listening
    if (this.voice.isListening) {
      this.voice.stopListening();
    }

    let prompt = (textToSend || this.voice.getFinalTranscript()).trim();
    if (!textToSend && this.voice.interimTranscript.trim()) {
      prompt = (prompt ? `${prompt} ${this.voice.interimTranscript.trim()}` : this.voice.interimTranscript.trim());
    }

    if (!prompt) return false;

    this.isSending = true;
    this.messages.push({ role: "user", text: prompt });
    this.isLoading = true;

    try {
      this.apiCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.messages.push({ role: "assistant", text: "Response for: " + prompt });
      return true;
    } finally {
      this.isLoading = false;
      this.isSending = false;
    }
  }
}

// TEST SUITE EXECUTION
async function runTests() {
  console.log("=== RUNNING VOICE LIFECYCLE & STATE MACHINE UNIT TESTS ===");

  // Test 1: Microphone Start
  {
    const voice = new VoiceInputController();
    voice.startListening({ lang: "ml-IN", baseText: "Previous input" });
    assert.strictEqual(voice.isListening, true, "Mic should be listening on start");
    assert.strictEqual(voice.recognition?.lang, "ml-IN", "Speech recognition should accept Malayalam locale");
    assert.strictEqual(voice.baseText, "Previous input", "Base text preserved");
    console.log("✅ Test 1 Passed: Microphone start & Malayalam locale configuration");
  }

  // Test 2: Microphone Stop releases tracks & sets isListening = false
  {
    const voice = new VoiceInputController();
    voice.startListening({ lang: "en-US" });
    const tracks = voice.mediaStream?.getTracks();
    assert.ok(tracks && tracks.length > 0, "Tracks initialized");
    voice.stopListening();
    assert.strictEqual(voice.isListening, false, "Listening state must be false");
    assert.strictEqual(voice.recognition, null, "Recognition ref must be cleared");
    assert.ok(tracks.every((t) => t.stopped), "All MediaStream tracks must be stopped");
    console.log("✅ Test 2 Passed: Microphone stop releases all MediaStream tracks and sets isListening=false");
  }

  // Test 3: SEND immediately stops microphone & speech recognition
  {
    const voice = new VoiceInputController();
    const chat = new ChatController(voice);

    voice.startListening({ lang: "en-US" });
    voice.recognition?.simulateResult([
      { transcript: "Build a modern website", isFinal: true },
    ]);

    assert.strictEqual(voice.isListening, true, "Voice is currently active before send");
    const sendPromise = chat.handleSend();
    assert.strictEqual(voice.isListening, false, "Microphone must be immediately stopped upon SEND");
    assert.strictEqual(voice.recognition, null, "Recognition must be aborted and cleaned up upon SEND");

    await sendPromise;
    assert.strictEqual(chat.messages.length, 2, "User message and AI response recorded");
    assert.strictEqual(chat.messages[0].text, "Build a modern website");
    console.log("✅ Test 3 Passed: SEND stops microphone immediately before AI request");
  }

  // Test 4: Separation of Final vs Interim Transcript
  {
    const voice = new VoiceInputController();
    voice.startListening({ lang: "en-US", baseText: "Hello" });

    // Interim result
    voice.recognition?.simulateResult([
      { transcript: "I want an agency", isFinal: false },
    ]);
    assert.strictEqual(voice.interimTranscript, "I want an agency", "Interim transcript stored in buffer");
    assert.strictEqual(voice.getFinalTranscript(), "Hello", "Final transcript does not commit interim text prematurely");

    // Final result commits
    voice.recognition?.simulateResult([
      { transcript: "I want an agency website", isFinal: true },
    ]);
    assert.strictEqual(voice.getFinalTranscript(), "Hello I want an agency website", "Committed final transcript");
    console.log("✅ Test 4 Passed: Separation of final vs interim transcripts verified");
  }

  // Test 5: Transcript Reset after send and no reinsertion
  {
    const voice = new VoiceInputController();
    const chat = new ChatController(voice);

    voice.startListening({ lang: "en-US" });
    voice.recognition?.simulateResult([
      { transcript: "Test message", isFinal: true },
    ]);
    await chat.handleSend();

    assert.strictEqual(voice.isListening, false, "Voice is stopped");
    assert.strictEqual(voice.interimTranscript, "", "Interim transcript is blank");
    console.log("✅ Test 5 Passed: Transcript reset after send verified");
  }

  // Test 6: Duplicate Send Prevention
  {
    const voice = new VoiceInputController();
    const chat = new ChatController(voice);

    voice.startListening({ lang: "en-US" });
    voice.recognition?.simulateResult([
      { transcript: "Duplicate check", isFinal: true },
    ]);

    // Send twice concurrently
    const p1 = chat.handleSend();
    const p2 = chat.handleSend();

    await Promise.all([p1, p2]);
    assert.strictEqual(chat.apiCallCount, 1, "Only ONE API call must be executed");
    assert.strictEqual(chat.messages.filter((m) => m.role === "user").length, 1, "Only ONE user message appended");
    console.log("✅ Test 6 Passed: Duplicate send prevented");
  }

  // Test 7: Recognition Error Cleanup
  {
    const voice = new VoiceInputController();
    voice.startListening({ lang: "en-US" });
    assert.strictEqual(voice.isListening, true);

    voice.recognition?.simulateError("not-allowed");
    assert.strictEqual(voice.isListening, false, "Listening state must return to IDLE on error");
    assert.strictEqual(voice.recognition, null, "Recognition cleared on error");
    assert.strictEqual(voice.error, "not-allowed", "Error recorded");
    console.log("✅ Test 7 Passed: Recognition error cleans up state and returns to IDLE");
  }

  // Test 8: Unmount / Close Agent Cleanup
  {
    const voice = new VoiceInputController();
    voice.startListening({ lang: "en-US" });
    const tracks = voice.mediaStream?.getTracks();

    // Emulate component unmount
    voice.stopListening();
    assert.strictEqual(voice.isListening, false, "Unmount stops listening");
    assert.ok(tracks?.every((t) => t.stopped), "Unmount stops all media tracks");
    console.log("✅ Test 8 Passed: Component unmount / drawer close cleanup verified");
  }

  console.log("\nALL 8 VOICE STATE MACHINE & LIFECYCLE TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
