const target = "https://codexys-ai-website-builder.vercel.app/site/velocity-motors-an-elite-cinematic-automotive-gallery/";

const encoded = encodeURIComponent(target);
const fullUrl = `https://www.googleapis.com/webmasters/v3/sites/${encoded}`;

console.log("Target URL:", target);
console.log("encodeURIComponent:", encoded);
console.log("Full Request URL string:", fullUrl);

const parsed = new URL(fullUrl);
console.log("Parsed URL href:", parsed.href);
console.log("Parsed URL pathname:", parsed.pathname);

// Check if double encoding or decoding happens when constructing request
const requestObj = new Request(fullUrl);
console.log("Request object url:", requestObj.url);
