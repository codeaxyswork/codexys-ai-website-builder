import crypto from "crypto";

const HMAC_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  "codeaxys-third-party-seo-secret-key-fallback";

// Derived 32-byte key for AES-256-GCM authenticated encryption
const ENCRYPTION_KEY = crypto.createHash("sha256").update(HMAC_SECRET).digest();

/**
 * Encrypts sensitive credential object to hex string format (iv:authTag:ciphertext)
 */
export function encryptCredentials(credentials: Record<string, any>): string {
  if (!credentials || typeof credentials !== "object") {
    throw new Error("Invalid credentials payload for encryption.");
  }

  const jsonStr = JSON.stringify(credentials);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(jsonStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted credential string back to credential object
 */
export function decryptCredentials(encryptedStr: string): Record<string, any> {
  if (!encryptedStr || !encryptedStr.includes(":")) {
    throw new Error("Invalid encrypted credentials format.");
  }

  try {
    const [ivHex, authTagHex, encryptedText] = encryptedStr.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (err: any) {
    console.error("AES-256-GCM Credential Decryption Error:", err);
    throw new Error("Failed to decrypt stored credentials.");
  }
}

/**
 * Generates customer-friendly masked string representation (e.g. ••••••••AB91)
 */
export function maskRawCredential(rawStr: string | null | undefined): string {
  if (!rawStr || typeof rawStr !== "string") return "••••••••";
  const clean = rawStr.trim();
  if (clean.length <= 4) return "••••" + clean;
  const lastFour = clean.slice(-4);
  return "••••••••" + lastFour;
}
