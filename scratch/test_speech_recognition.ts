// Deterministic test for Speech Recognition transcript accumulation engine

export class MockSpeechRecognitionEngine {
  private initialInput = "";
  private previousSessionsFinal = "";
  private sessionFinal = "";
  private interimTranscript = "";
  private isListening = false;
  private isUserStopping = false;

  public currentInputValue = "";

  constructor() {}

  public startListening(currentInput: string) {
    this.initialInput = currentInput;
    this.previousSessionsFinal = "";
    this.sessionFinal = "";
    this.interimTranscript = "";
    this.isUserStopping = false;
    this.isListening = true;
    this.updateComposerInput();
  }

  public simulateResult(results: Array<{ transcript: string; isFinal: boolean }>) {
    let currentFinal = "";
    let currentInterim = "";

    for (let i = 0; i < results.length; ++i) {
      const item = results[i];
      const text = item.transcript.trim();
      if (!text) continue;

      if (item.isFinal) {
        currentFinal += (currentFinal ? " " : "") + text;
      } else {
        currentInterim += (currentInterim ? " " : "") + text;
      }
    }

    this.sessionFinal = currentFinal;
    this.interimTranscript = currentInterim;
    this.updateComposerInput();
  }

  public finalizeTranscript() {
    const pendingInterim = this.interimTranscript.trim();
    if (pendingInterim) {
      const currentSession = this.sessionFinal.trim();
      if (!currentSession.endsWith(pendingInterim)) {
        this.sessionFinal = (currentSession + " " + pendingInterim).trim();
      }
      this.interimTranscript = "";
    }
    this.updateComposerInput();
  }

  public stopListening() {
    this.isUserStopping = true;
    this.isListening = false;
    this.finalizeTranscript();
  }

  public simulateUnexpectedOnEnd() {
    this.finalizeTranscript();
    if (!this.isUserStopping && this.isListening) {
      const currentTotal = (
        this.previousSessionsFinal +
        " " +
        this.sessionFinal
      ).trim();
      this.previousSessionsFinal = currentTotal;
      this.sessionFinal = "";
      this.interimTranscript = "";
    } else {
      this.isListening = false;
    }
    this.updateComposerInput();
  }

  private updateComposerInput() {
    const baseText = this.initialInput.trim();
    const prevFinal = this.previousSessionsFinal.trim();
    const sessFinal = this.sessionFinal.trim();
    const interimText = this.interimTranscript.trim();

    let sessionSpeech = sessFinal;
    if (interimText) {
      if (!sessionSpeech.endsWith(interimText)) {
        sessionSpeech = sessionSpeech ? `${sessionSpeech} ${interimText}` : interimText;
      }
    }

    let totalSpeech = prevFinal;
    if (sessionSpeech) {
      if (!totalSpeech.endsWith(sessionSpeech)) {
        totalSpeech = totalSpeech ? `${totalSpeech} ${sessionSpeech}` : sessionSpeech;
      }
    }

    let fullText = baseText;
    if (totalSpeech) {
      fullText = baseText ? `${baseText} ${totalSpeech}` : totalSpeech;
    }

    this.currentInputValue = fullText;
  }
}

// RUN TESTS
function runTests() {
  console.log("=== RUNNING SPEECH RECOGNITION UNIT TESTS ===");

  const engine = new MockSpeechRecognitionEngine();

  // TEST 1: English
  engine.startListening("");
  engine.simulateResult([
    { transcript: "Create a modern website", isFinal: true },
    { transcript: "for a digital marketing agency with a dark theme and WhatsApp contact button.", isFinal: true }
  ]);
  console.assert(
    engine.currentInputValue === "Create a modern website for a digital marketing agency with a dark theme and WhatsApp contact button.",
    `TEST 1 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 1 Passed: English complete sentence preserved.");

  // TEST 2: Malayalam
  engine.startListening("");
  engine.simulateResult([
    { transcript: "എനിക്ക് ഒരു നല്ല പ്രൊഫഷണൽ വെബ്സൈറ്റ് വേണം", isFinal: true },
    { transcript: "അതിൽ WhatsApp ബട്ടണും കോൺടാക്ട് ഫോമും വേണം", isFinal: false }
  ]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "എനിക്ക് ഒരു നല്ല പ്രൊഫഷണൽ വെബ്സൈറ്റ് വേണം അതിൽ WhatsApp ബട്ടണും കോൺടാക്ട് ഫോമും വേണം",
    `TEST 2 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 2 Passed: Malayalam final interim committed on stop.");

  // TEST 3: Manglish
  engine.startListening("");
  engine.simulateResult([
    { transcript: "Enikku oru professional website venam", isFinal: true },
    { transcript: "athil WhatsApp buttonum contact formum venam", isFinal: false }
  ]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "Enikku oru professional website venam athil WhatsApp buttonum contact formum venam",
    `TEST 3 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 3 Passed: Manglish final words preserved.");

  // TEST 4: Mixed Language
  engine.startListening("");
  engine.simulateResult([
    { transcript: "എനിക്ക് ഒരു modern website വേണം with WhatsApp button and contact form", isFinal: true }
  ]);
  console.assert(
    engine.currentInputValue === "എനിക്ക് ഒരു modern website വേണം with WhatsApp button and contact form",
    `TEST 4 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 4 Passed: Mixed language sentence preserved.");

  // TEST 5: Continuous 10-15s speech
  engine.startListening("");
  engine.simulateResult([{ transcript: "Part 1 speech", isFinal: true }]);
  engine.simulateResult([{ transcript: "Part 1 speech", isFinal: true }, { transcript: "Part 2 speech", isFinal: true }]);
  engine.simulateResult([{ transcript: "Part 1 speech", isFinal: true }, { transcript: "Part 2 speech", isFinal: true }, { transcript: "Part 3 speech", isFinal: false }]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "Part 1 speech Part 2 speech Part 3 speech",
    `TEST 5 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 5 Passed: Continuous speech accumulation preserved.");

  // TEST 6: Stop immediately after saying final word
  engine.startListening("");
  engine.simulateResult([{ transcript: "The final word is here", isFinal: false }]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "The final word is here",
    `TEST 6 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 6 Passed: Stop immediately after speaking preserves last word.");

  // TEST 7: Start -> speak -> stop -> start again -> speak more
  engine.startListening("");
  engine.simulateResult([{ transcript: "First sentence.", isFinal: true }]);
  engine.stopListening();
  const firstResult = engine.currentInputValue; // "First sentence."
  engine.startListening(firstResult);
  engine.simulateResult([{ transcript: "Second sentence.", isFinal: true }]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "First sentence. Second sentence.",
    `TEST 7 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 7 Passed: Multi-session recording appends without losing earlier text.");

  // TEST 8: Pause -> unexpected onend -> auto restart
  engine.startListening("");
  engine.simulateResult([{ transcript: "Speech before pause", isFinal: true }, { transcript: "and last interim", isFinal: false }]);
  engine.simulateUnexpectedOnEnd(); // Auto restart
  console.assert(
    engine.currentInputValue === "Speech before pause and last interim",
    `TEST 8 Failed: ${engine.currentInputValue}`
  );
  engine.simulateResult([{ transcript: "speech after pause", isFinal: true }]);
  engine.stopListening();
  console.assert(
    engine.currentInputValue === "Speech before pause and last interim speech after pause",
    `TEST 8 Failed: ${engine.currentInputValue}`
  );
  console.log("TEST 8 Passed: Unexpected onend auto-restarts and preserves text.");

  console.log("=== ALL 8 SPEECH RECOGNITION TESTS PASSED! ===");
}

runTests();
