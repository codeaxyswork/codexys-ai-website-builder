function extractBusinessName(userMessage: string, userMessagesOnly: string[], lastAssistantMsg: string): string {
  const allUserText = (userMessagesOnly.join(" ") + " " + userMessage).trim();

  // 1. Check user messages for explicit "പേര്" / "name is" / "called" patterns
  const nameMatchMalayalam = allUserText.match(/([\u0D00-\u0D7FA-Za-z0-9\s]{2,30}?)\s*(?:എന്നാണ്|ആണെന്ന്|ആണ്)?\s*പേര്/i);
  const nameMatchEnglish = allUserText.match(/(?:name is|called|business name is|brand is)\s+([\u0D00-\u0D7FA-Za-z0-9\s]{2,30}?)(?:\.|\,|$|\n)/i);

  if (nameMatchMalayalam && nameMatchMalayalam[1] && !/കാർ|ഷോറൂം|website|വേണം|ഉണ്ട്|logo|ലോഗോ|ആയുർവേദ/i.test(nameMatchMalayalam[1])) {
    return nameMatchMalayalam[1].trim();
  }
  if (nameMatchEnglish && nameMatchEnglish[1]) {
    return nameMatchEnglish[1].trim();
  }

  // 2. Check suffix patterns in latest user message (e.g. "ജോൺ ആയുർവേദിക്കാണെന്ന്", "Velocity Motors ആണ്")
  const suffixMatch = userMessage.match(/([\u0D00-\u0D7FA-Za-z0-9\s]{2,35}?)(?:ആണെന്ന്|എന്നാണ്|ആണ്|എന്ന്)/i);
  if (suffixMatch && suffixMatch[1]) {
    const candidate = suffixMatch[1]
      .replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്|പറഞ്ഞല്ലോ|എന്റെ|കടയുടെ|കമ്പനിയുടെ|ഒരു|പേര്/gi, "")
      .trim();
    if (candidate.length >= 2 && !/കാർ|ഷോറൂം|website|വേണം|ഉണ്ട്|logo|ലോഗോ/i.test(candidate)) {
      return candidate;
    }
  }

  // 3. If last assistant message asked for business name, treat the user's response as the name
  if (lastAssistantMsg.includes("പേര്") || lastAssistantMsg.includes("name")) {
    const cleanInput = userMessage
      .replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്|പറഞ്ഞല്ലോ|എന്റെ|കടയുടെ|കമ്പനിയുടെ|പേര്|എന്നാണ്|ആണെന്ന്|ആണ്|\.|\!/gi, "")
      .trim();
    if (cleanInput.length >= 2) {
      return cleanInput;
    }
    return userMessage.replace(/അതല്ലേ|ഇപ്പോൾ|ഞാൻ|നിങ്ങളോട്|പറഞ്ഞത്/gi, "").trim();
  }

  return "";
}

const lastMsg = "തീർച്ചയായും! ഒരു professional Ayurvedic center website നമുക്ക് തയ്യാറാക്കാം. ആദ്യം ഒരു കാര്യം അറിയട്ടെ, നിങ്ങളുടെ business / brand-ന്റെ പേര് എന്താണ്?";

const testCases = [
  "അതല്ലേ ഇപ്പോൾ ഞാൻ നിങ്ങളോട് പറഞ്ഞത് ജോൺ ആയുർവേദിക്കാണെന്ന്",
  "ഞാൻ പറഞ്ഞല്ലോ ജോൺ ആയുർവേദിക് ആണ്",
  "Velocity Motors എന്നാണ് പേര്",
  "Kottakkal Santhigiri",
  "John Ayurvedic"
];

testCases.forEach((inp) => {
  const extracted = extractBusinessName(inp, [], lastMsg);
  console.log(`Input: "${inp}"\n  -> Extracted: "${extracted}"\n`);
});
