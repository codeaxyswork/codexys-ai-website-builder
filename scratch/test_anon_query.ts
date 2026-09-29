import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file: string) {
  const envPath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val !== '[SENSITIVE]') {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv('.env.local');
loadEnv('.env.production.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yumsturujjjgdxsrqgbm.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
  console.log('--- Testing ANON Client Query ---');
  const { data: web, error } = await anonClient
    .from('websites')
    .select('id, title, published_slug, is_published')
    .eq('published_slug', 'mncc')
    .single();

  console.log('Anon Client Query Result:', web, 'Error:', error);
}

run();
