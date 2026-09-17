import { GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./gemini";
import { buildMultilingualSystemDirective } from "./multilingual";

export interface AssistantChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface AssistantResponse {
  text: string;
  suggestedPrompt?: string | null;
}

const ASSISTANT_SYSTEM_PROMPT = `
You are Codeaxys AI — an expert, highly intelligent, friendly AI Website Consultant sitting beside visitors on Codeaxys AI Website Builder.
Your mission is to guide visitors naturally from a simple idea to a complete, professional website requirement. You act like a real, experienced human web design consultant having a continuous, intelligent conversation.

--------------------------------------------------
1. DYNAMIC CONTEXTUAL CONSULTANT BEHAVIOR
--------------------------------------------------
• Name: Codeaxys AI
• You are NOT a rigid questionnaire or form-filling bot.
• ALWAYS READ THE FULL CONVERSATION HISTORY before generating a response!
• ACKNOWLEDGE THE CUSTOMER'S LATEST MESSAGE SPECIFICALLY and build directly upon what they just said.
• Continuously track and remember ALL accumulated requirements:
  - Website Type & Industry
  - Business/Company Name & Details
  - Existing Logo Availability
  - Brand Colors & Visual Theme/Mood
  - Featured Products / Brands / Services / Target Audience
  - Essential Pages (Home, About, Inventory/Showcase, Booking, Services, Contact)
  - Primary Call-to-Action (CTA) & Interactive Features
• ABSOLUTE RULES:
  1. DO NOT ask any question whose answer has ALREADY been provided in conversation history!
  2. If the customer answers about the logo, NEVER ask about the logo again! Continue to the next logical topic (e.g. brand colors or featured cars/services).
  3. If the customer specifies brand colors, NEVER ask about colors again! Acknowledge their color choice and move to the next relevant detail.
  4. If the customer provides multiple details in one message, extract and remember ALL of them, acknowledge them warmly, and ask only ONE relevant unasked question if needed.
  5. DO NOT restart the questionnaire or ask generic questions.

--------------------------------------------------
2. REAL CONVERSATION EXAMPLES (MULTILINGUAL / MANGLISH)
--------------------------------------------------
Example 1:
  Customer: "എനിക്ക് ഒരു കാർ ഷോറൂമിന്റെ website വേണം."
  Codeaxys AI: "തീർച്ചയായും! ഒരു professional car showroom website നമുക്ക് തയ്യാറാക്കാം. ആദ്യം ഒരു കാര്യം അറിയട്ടെ, നിങ്ങൾക്ക് existing logo ഉണ്ടോ?"

Example 2:
  Customer: "Logo ഉണ്ട്."
  Codeaxys AI: "വളരെ നല്ലത്! Logo മാച്ചിംഗ് ചെയ്യുന്ന രീതിയിൽ ഡിസൈൻ ചെയ്യാം. ഇനി നിങ്ങളുടെ വെബ്സൈറ്റിന് എങ്ങനെയുള്ള brand colors ആണ് താാല്പര്യം? (ഉദാഹരണത്തിന് Sleek Black & Gold, Dark Luxury, or Clean White?)"

Example 3:
  Customer: "Black and gold ആണ് brand colors."
  Codeaxys AI: "Sleek Metallic Black and Gold തീം ഒരു കാർ ഷോറൂമിന് വളരെ പ്രീമിയം ലുക്ക് നൽകും! ഇനി നിങ്ങളുടെ ഷോറൂമിൽ പ്രധാനമായും ഏതെല്ലാം കാറുകളാണ് (BMW, Mercedes, Audi പോലെ) വിൽക്കുന്നത് അല്ലെങ്കിൽ ഫീച്ചർ ചെയ്യുന്നത്?"

Example 4:
  Customer: "BMW, Mercedes, Audi cars ആണ് mainly showcase ചെയ്യുന്നത്."
  Codeaxys AI: "കിടിലൻ! BMW, Mercedes, Audi മോഡലുകൾക്കായി dedicated inventory showcase, test drive booking form, interactive filter എന്നിവ ഉൾപ്പെടുത്താം. ✦ Creation Ready! നിങ്ങളുടെ വെബ്സൈറ്റ് ആവശ്യകതകൾ തയ്യാറാണ്..."

--------------------------------------------------
3. DISCOVERY BUDGET & CREATION READY STATE
--------------------------------------------------
• Max 4 intentional discovery questions during initial discovery. Skip questions whenever sufficient information is provided.
• Once core requirements are gathered or 4 questions are reached, show:
  "✦ Creation Ready! Your website requirements are gathered and ready."
  Summarize accumulated understanding concisely.
• After Creation Ready, the customer can continue talking naturally, refine details, ask product questions, or say "Create it". Do NOT restart discovery or ask Q5.

--------------------------------------------------
4. PROMPT REQUESTS & CREATION TRIGGERS
--------------------------------------------------
• Explicit Prompt Request ("Can you create the prompt for me?", "give prompt", "prepare prompt"):
  Generate the finalized prompt wrapped in ===PROMPT_START=== ... ===PROMPT_END=== using all accumulated requirements!
• Creation Trigger ("Create it", "Build it", "Generate website"):
  Output the prompt wrapped in ===PROMPT_START=== ... ===PROMPT_END=== and state: "Your website prompt is ready! Clicking Generate Website to start building."

--------------------------------------------------
5. PRODUCT FACTS & MULTILINGUAL RULES
--------------------------------------------------
• Always respond in the customer's preferred conversation language (English, Malayalam, Manglish, Hinglish).
• Product Facts: Codeaxys features Instant AI Multi-file Engine (HTML5/CSS3/JS), Conversational Real-Time Editor, 3-Day Free Preview Trial (72 hours), Supabase Media Manager, Subdomains & Custom Domains.
`;

export async function generateAssistantReply(
  history: AssistantChatMessage[],
  userMessage: string,
  conversationLanguage?: string
): Promise<AssistantResponse> {
  const { apiKey, model } = getGeminiConfig();
  const ai = new GoogleGenAI({ apiKey });

  const langDirective = buildMultilingualSystemDirective(conversationLanguage);

  let promptPayload = `${ASSISTANT_SYSTEM_PROMPT}\n\n${langDirective}\n\n===CONVERSATION HISTORY===\n`;

  const recentHistory = history.slice(-16);
  recentHistory.forEach((msg) => {
    const roleLabel = msg.role === "user" ? "Customer" : "Codeaxys AI";
    promptPayload += `${roleLabel}: ${msg.content}\n`;
  });

  const lowerMsg = userMessage.toLowerCase().trim();
  const isExplicitPromptRequest =
    lowerMsg.includes("prompt") &&
    (
      lowerMsg.includes("give") ||
      lowerMsg.includes("prepare") ||
      lowerMsg.includes("show") ||
      lowerMsg.includes("generate") ||
      lowerMsg.includes("get") ||
      lowerMsg.includes("create") ||
      lowerMsg.includes("write") ||
      lowerMsg.includes("provide") ||
      lowerMsg.includes("can you") ||
      lowerMsg.includes("what is") ||
      lowerMsg.includes("send") ||
      lowerMsg === "prompt" ||
      lowerMsg === "give me the prompt" ||
      lowerMsg === "show me the prompt" ||
      lowerMsg === "prepare the prompt"
    );

  const isCreationTrigger =
    lowerMsg === "create it" ||
    lowerMsg === "build it" ||
    lowerMsg === "generate it" ||
    lowerMsg === "let's create" ||
    lowerMsg === "create website" ||
    lowerMsg.includes("create it now") ||
    lowerMsg.includes("generate website now");

  if (isExplicitPromptRequest || isCreationTrigger) {
    promptPayload += `\n[MANDATORY SYSTEM DIRECTIVE: The customer is requesting their complete website prompt / creation now. You MUST generate the finalized website prompt enclosed strictly inside ===PROMPT_START=== and ===PROMPT_END=== using ALL accumulated requirements from the conversation history (business name, website type, logo status, pages, visual style, colors, features)! Do NOT ask any follow-up discovery questions. Include the ===PROMPT_START=== prompt block in your output.]\n`;
  }

  promptPayload += `\nCustomer: ${userMessage}\nCodeaxys AI:`;

  const primaryModel = model || "gemini-3.6-flash";
  const candidateModels = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.1-pro-preview"]));

  let lastError: any = null;

  for (const currentModel of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [promptPayload],
          config: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        });

        const replyText =
          response.text ||
          "I'm here as your Codeaxys AI Website Consultant! What type of website would you like to build?";

        let suggestedPrompt: string | null = null;
        const promptMatch = replyText.match(/===PROMPT_START===([\s\S]*?)===PROMPT_END===/);
        if (promptMatch && promptMatch[1]) {
          suggestedPrompt = promptMatch[1].trim();
        } else if ((isExplicitPromptRequest || isCreationTrigger) && replyText.trim()) {
          suggestedPrompt = replyText.trim();
        }

        const cleanedText = replyText
          .replace(/===PROMPT_START===[\s\S]*?===PROMPT_END===/g, "")
          .trim();

        return {
          text: cleanedText || replyText,
          suggestedPrompt,
        };
      } catch (err: any) {
        console.warn(`Assistant model ${currentModel} attempt ${attempt} failed:`, err?.message || err);
        lastError = err;
        if (attempt === 1 && err?.status === 429) {
          // Wait 1.2s before retry on 429 rate limit
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    }
  }

  console.error("All Assistant Gemini Models Failed, using Dynamic Context Fallback:", lastError);
  return synthesizeContextFallback(history, userMessage, isExplicitPromptRequest || isCreationTrigger);
}

function synthesizeContextFallback(
  history: AssistantChatMessage[],
  userMessage: string,
  isPromptRequested: boolean
): AssistantResponse {
  const allHistoryText = history.map((h) => h.content).join(" ");
  const fullText = (allHistoryText + " " + userMessage).toLowerCase();

  // 1. Dynamic Business Type Extraction (supports any user business domain)
  let businessType = "";
  const typeMatchEnglish = fullText.match(/(?:need|want|create|build|for|a|an)\s+([a-z0-9\s]{2,30}?)\s+(?:website|web site|site)/i);
  const typeMatchMalayalam = fullText.match(/([\u0D00-\u0D7F\s]{2,30}?)\s*(?:website|വെബ്സൈറ്റ്|സൈറ്റ്)\s*(?:വേണം|തയ്യാറാക്കണം)?/i);

  if (typeMatchEnglish && typeMatchEnglish[1] && !/website|create|build|need|want/i.test(typeMatchEnglish[1])) {
    businessType = typeMatchEnglish[1].trim();
  } else if (typeMatchMalayalam && typeMatchMalayalam[1] && !/വേണം|ഉണ്ട്|പേര്/i.test(typeMatchMalayalam[1])) {
    businessType = typeMatchMalayalam[1].trim();
  } else if (fullText.includes("car showroom") || fullText.includes("കാർ ഷോറൂം")) {
    businessType = "car showroom";
  } else if (fullText.includes("ayurveda") || fullText.includes("ആയുർവേദ")) {
    businessType = "Ayurvedic center";
  } else if (fullText.includes("dental") || fullText.includes("clinic") || fullText.includes("hospital")) {
    businessType = "clinic";
  } else if (fullText.includes("restaurant") || fullText.includes("food") || fullText.includes("cafe")) {
    businessType = "restaurant";
  } else if (fullText.includes("agency") || fullText.includes("portfolio")) {
    businessType = "agency";
  } else if (fullText.includes("gym") || fullText.includes("fitness")) {
    businessType = "fitness center";
  } else {
    businessType = "business";
  }

  // 2. Detect Business Name (handles both English and Malayalam word orders & Unicode characters)
  let businessName = "";
  const allUserText = history
    .filter((h) => h.role === "user")
    .map((h) => h.content)
    .join(" ") + " " + userMessage;

  const nameMatchMalayalam = allUserText.match(/([\u0D00-\u0D7FA-Za-z0-9\s]{2,30}?)\s*(?:എന്നാണ്|ആണെന്ന്|ആണ്)?\s*പേര്/i);
  const nameMatchEnglish = allUserText.match(/(?:name is|called|business name is|brand is)\s+([\u0D00-\u0D7FA-Za-z0-9\s]{2,30}?)(?:\.|\,|$|\n)/i);

  if (nameMatchMalayalam && nameMatchMalayalam[1] && !/കാർ|ഷോറൂം|website|വേണം|ഉണ്ട്|logo|ലോഗോ|ആയുർവേദ/i.test(nameMatchMalayalam[1])) {
    businessName = nameMatchMalayalam[1].trim();
  } else if (nameMatchEnglish && nameMatchEnglish[1]) {
    businessName = nameMatchEnglish[1].trim();
  } else {
    // Suffix pattern match (e.g. "ജോൺ ആയുർവേദിക്കാണെന്ന്", "Velocity Motors ആണ്")
    const suffixMatch = userMessage.match(/([\u0D00-\u0D7FA-Za-z0-9\s]{2,35}?)(?:ആണെന്ന്|എന്നാണ്|ആണ്|എന്ന്)/i);
    if (suffixMatch && suffixMatch[1]) {
      const candidate = suffixMatch[1]
        .replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്|പറഞ്ഞല്ലോ|എന്റെ|കടയുടെ|കമ്പനിയുടെ|ഒരു|പേര്/gi, "")
        .trim();
      if (candidate.length >= 2 && !/കാർ|ഷോറൂം|website|വേണം|ഉണ്ട്|logo|ലോഗോ/i.test(candidate)) {
        businessName = candidate;
      }
    }

    if (!businessName) {
      // If the assistant previously asked for the business name, treat the response as the business name
      const lastAssistantMsg = history.filter(h => h.role === "assistant" || h.role === "model").pop()?.content || "";
      if (lastAssistantMsg.includes("പേര്") || lastAssistantMsg.includes("name")) {
        const cleanInput = userMessage
          .replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്|പറഞ്ഞല്ലോ|എന്റെ|കടയുടെ|കമ്പനിയുടെ|പേര്|എന്നാണ്|ആണെന്ന്|ആണ്|\.|\!/gi, "")
          .trim();
        businessName = cleanInput.length >= 2 ? cleanInput : userMessage.replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്/gi, "").trim();
      }
    }
  }

  // 3. Detect Logo
  const hasLogo = fullText.includes("logo") || fullText.includes("ലോഗോ");

  // 4. Detect Colors / Theme from USER history only!
  let colors = "";

  const lastAssistantMsgForColor = history.filter((h) => h.role === "assistant" || h.role === "model").pop()?.content || "";
  const askedColorInPrevTurn = lastAssistantMsgForColor.includes("brand colors") || lastAssistantMsgForColor.includes("color scheme") || lastAssistantMsgForColor.includes("brand colors / visual theme");

  if (askedColorInPrevTurn) {
    const lowerUser = userMessage.toLowerCase().trim();
    if (
      lowerUser.includes("no preferred") ||
      lowerUser.includes("don't have") ||
      lowerUser.includes("dont have") ||
      lowerUser.includes("no color") ||
      lowerUser.includes("suggest") ||
      lowerUser.includes("നിങ്ങൾ സജസ്റ്റ്") ||
      lowerUser.includes("ഏത് കളർ") ||
      lowerUser === "no"
    ) {
      colors = "No specific preference (suggest a suitable palette)";
    } else {
      // Dynamically preserve exact user color choice!
      colors = userMessage.trim();
    }
  } else {
    // Check if user explicitly stated colors in user history (excluding business name)
    const allUserMessagesExceptName = history
      .filter((h, idx) => h.role === "user" && idx > 1) // skip initial turn
      .map((h) => h.content)
      .join(" ") + " " + userMessage;
    
    const explicitColorMatch = allUserMessagesExceptName.match(/(?:color|colors|theme|palette|is|are)\s+(?:is|are)?\s*([a-z\s\&]{3,25})/i);
    if (explicitColorMatch && explicitColorMatch[1] && !/website|showroom|shop|saree|ayurvedic|clinic|company|name|logo/i.test(explicitColorMatch[1])) {
      colors = explicitColorMatch[1].trim();
    }
  }

  const hasColors = Boolean(colors);

  // 5. Detect Offerings / Products
  let showcases = "";
  if (fullText.includes("bmw") || fullText.includes("mercedes") || fullText.includes("audi")) {
    showcases = "BMW, Mercedes, and Audi inventory showcase";
  } else if (fullText.includes("treatment") || fullText.includes("panchakarma") || fullText.includes("doctor")) {
    showcases = "Ayurvedic treatments & consultation booking";
  } else if (fullText.includes("saree") || fullText.includes("silk") || fullText.includes("clothing")) {
    showcases = "saree & silk collection showcase";
  }
  const hasOfferings = Boolean(showcases || fullText.includes("bmw") || fullText.includes("mercedes") || fullText.includes("audi") || fullText.includes("cars") || fullText.includes("services") || fullText.includes("products") || fullText.includes("saree") || fullText.includes("collection"));

  // Forward-only state progression based on assistant history
  const assistantHistoryText = history
    .filter((h) => h.role === "assistant" || h.role === "model")
    .map((h) => h.content)
    .join(" ");

  const askedName = assistantHistoryText.includes("പേര്") || assistantHistoryText.includes("name");
  const askedLogo = assistantHistoryText.includes("logo") || assistantHistoryText.includes("ലോഗോ");
  const askedColors = assistantHistoryText.includes("color") || assistantHistoryText.includes("കളർ") || assistantHistoryText.includes("theme");
  const askedOfferings = assistantHistoryText.includes("ഫീച്ചർ") || assistantHistoryText.includes("products") || assistantHistoryText.includes("services");

  // If assistant already asked for logo or colors in history, business name was collected
  if ((askedLogo || askedColors || askedOfferings) && !businessName) {
    businessName = "your business";
  }

  const isMalayalam = /[അ-ഹാ-്]/.test(userMessage) || userMessage.includes("ആണ്") || userMessage.includes("ഉണ്ട്") || userMessage.includes("വേണം") || userMessage.includes("പേര്");

  if (isPromptRequested) {
    const fallbackPrompt = `Create a complete, responsive website for ${businessName || "Velocity Motors"}, a ${businessType}. The website must feature a high-converting Hero section, Inventory & Services Showcase (${showcases || "featured items"}), About Us, Booking / Enquiry form, and Contact details, designed with a ${colors || "luxury modern"} theme, logo branding, and interactive components.`;
    return {
      text: isMalayalam
        ? `✦ Creation Ready! ${businessName || "നിങ്ങളുടെ"} ${businessType} വെബ്സൈറ്റിന്റെ പ്രോംപ്റ്റ് തയ്യാറാണ്. ഇത് താഴെ നൽകിയിട്ടുണ്ട്. direct ആയി 'Generate Website' ക്ലിക്ക് ചെയ്ത് വെബ്സൈറ്റ് നിർമ്മിക്കാം!`
        : `✦ Creation Ready! Here is your complete website prompt based on all your accumulated requirements for ${businessName || "your business"}. You can review it and click Generate Website to start building!`,
      suggestedPrompt: fallbackPrompt,
    };
  }

  // Step-by-Step Guided Discovery (Forward Only)
  if (!businessName && !askedName) {
    return {
      text: isMalayalam
        ? `തീർച്ചയായും! ഒരു professional ${businessType} website നമുക്ക് തയ്യാറാക്കാം. ആദ്യം ഒരു കാര്യം അറിയട്ടെ, നിങ്ങളുടെ business / brand-ന്റെ പേര് എന്താണ്?`
        : `Absolutely! I can help you plan a professional ${businessType} website. First, what is the name of your business or brand?`,
      suggestedPrompt: null,
    };
  }

  if (!hasLogo && !askedLogo) {
    return {
      text: isMalayalam
        ? `വളരെ സന്തോഷം! ${businessName != "your business" ? businessName : 'നിങ്ങളുടെ സ്ഥാപനത്തിന്'}-ന് നിലവിൽ existing logo ഉണ്ടോ, അതോ പുതിയ logo തയ്യാറാക്കാൻ സഹായം വേണമെന്നുണ്ടോ?`
        : `Great! Do you already have a logo for ${businessName}, or would you like me to help plan one?`,
      suggestedPrompt: null,
    };
  }

  if (!hasColors && !askedColors) {
    return {
      text: isMalayalam
        ? `വളരെ നല്ലത്! ${businessName != "your business" ? businessName : 'വെബ്സൈറ്റിന്'} എങ്ങനെയുള്ള brand colors / visual theme ആണ് താാല്പര്യം? (ഉദാഹരണത്തിന് Sleek Black & Gold, Dark Luxury, or Clean Modern style?)`
        : `Perfect! Do you have preferred brand colors for ${businessName} (e.g., Black & Gold, Dark Luxury, Clean White & Blue), or would you like me to suggest a color scheme?`,
      suggestedPrompt: null,
    };
  }

  if (!hasOfferings && !askedOfferings) {
    const colorAckText = colors.includes("No specific preference")
      ? "Got it! I will suggest a suitable professional color palette for your website."
      : `${colors} visual theme will give a great look!`;
    const colorAckTextMalayalam = colors.includes("No specific preference")
      ? "തീർച്ചയായും! വെബ്സൈറ്റിന് അനുയോജ്യമായ പ്രീമിയം കളർ തീം ഞങ്ങൾ സജസ്റ്റ് ചെയ്യാം."
      : `${colors} തീം വെബ്സൈറ്റിന് വളരെ പ്രീമിയം ലുക്ക് നൽകും!`;

    return {
      text: isMalayalam
        ? `${colorAckTextMalayalam} ഇനി ${businessName != "your business" ? businessName : 'വെബ്സൈറ്റിൽ'} പ്രധാനമായും ഏതെല്ലാം സേവനങ്ങളാണ്/ഉൽപ്പന്നങ്ങളാണ് (products / services) ഫീച്ചർ ചെയ്യേണ്ടത്?`
        : `${colorAckText} What key products, services, or featured items should be showcased on the website?`,
      suggestedPrompt: null,
    };
  }

  // All 4 core details collected or asked -> Transition to Creation Ready!
  return {
    text: isMalayalam
      ? `കിടിലൻ! ${businessName != "your business" ? businessName : 'നിങ്ങളുടെ സ്ഥാപനത്തി'}-നായി ${colors || 'പ്രീമിയം'} തീമിൽ ${showcases || 'പ്രധാന ഫീച്ചറുകളോട് കൂടിയ'} ${businessType} വെബ്സൈറ്റിന്റെ എല്ലാ വിവരങ്ങളും ശേഖരിച്ചു കഴിഞ്ഞു.\n\n✦ Creation Ready! നിങ്ങളുടെ വെബ്സൈറ്റ് പ്രോംപ്റ്റ് തയ്യാറാക്കാൻ 'Can you create the prompt for me?' എന്ന് പറയൂ, അല്ലെങ്കിൽ 'Create it' എന്ന് പറയുക!`
      : `Awesome! All key requirements for ${businessName}'s ${businessType} website (${colors || 'modern'} theme, ${showcases || 'featured content'}) are gathered.\n\n✦ Creation Ready! Say 'Can you create the prompt for me?' or 'Create it' when you're ready to build!`,
    suggestedPrompt: null,
  };
}

