import fs from "fs";
import path from "path";

console.log("Checking environment keys in process.env:");
console.log(Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("SECRET") || k.includes("KEY") || k.includes("VERCEL") || k.includes("DATABASE") || k.includes("POSTGRES")));
