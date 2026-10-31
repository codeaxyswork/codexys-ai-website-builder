#!/usr/bin/env node
/**
 * One-Time Super Admin Password Reset Script
 * Target Account: admin@codeaxys.com
 * Target UID: 91089fcc-7de7-4cfa-bc05-3112cbaa51d6
 * Target Project: yumsturujjjgdxsrqgbm (Production Supabase)
 *
 * Security Guarantees:
 * 1. Reads credentials from .env.local.production-backup into memory.
 * 2. Never prints keys, passwords, or tokens.
 * 3. Validates target project ref is 'yumsturujjjgdxsrqgbm'.
 * 4. Verifies existing user exists with UID '91089fcc-7de7-4cfa-bc05-3112cbaa51d6' and role 'super_admin'.
 * 5. Masks terminal input when entering the password (no plaintext in history/stdout).
 * 6. Enforces strong password requirements.
 * 7. Calls supabase.auth.admin.updateUserById(TARGET_UID, { password }).
 * 8. Zero database schema modifications, zero code deployments.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TARGET_PROJECT_REF = 'yumsturujjjgdxsrqgbm';
const TARGET_UID = '91089fcc-7de7-4cfa-bc05-3112cbaa51d6';
const TARGET_EMAIL = 'admin@codeaxys.com';
const TARGET_ENV_FILE = path.join(PROJECT_ROOT, '.env.local.production-backup');

/**
 * Parse an environment file into key-value pairs safely
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

/**
 * Validate password requirements
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password cannot be empty.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long (Supabase requires minimum 6; production policy requires 8+).' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character.' };
  }
  return { valid: true, message: 'Password meets all security criteria.' };
}

/**
 * Read line input (visible text for confirmations)
 */
function readLineInput(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Read masked input (asterisks for passwords, no echo in bash history)
 */
function readHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error('Interactive TTY terminal required for secure hidden password entry.'));
    }

    process.stdout.write(promptText);

    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          return resolve(password);
        } else if (char === '\u0003') { // Ctrl+C
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\nAborted by user (Ctrl+C).\n');
          process.exit(1);
        } else if (char === '\u0008' || char === '\x7f') { // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += char;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const isVerifyOnly = process.argv.includes('--verify-only');

  console.log('====================================================');
  console.log('   Codeaxys Production Super Admin Password Reset   ');
  console.log('====================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Mode: ${isVerifyOnly ? 'VERIFY ONLY (Read-Only)' : 'INTERACTIVE RESET'}\n`);

  // Step 1: Environment File Verification
  console.log('[1/4] Verifying local environment file...');
  if (!fs.existsSync(TARGET_ENV_FILE)) {
    console.error(`ERROR: Environment file not found at ${TARGET_ENV_FILE}`);
    process.exit(1);
  }

  const env = parseEnvFile(TARGET_ENV_FILE);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not found in environment file.');
    process.exit(1);
  }

  let projectRef = 'unknown';
  try {
    const urlObj = new URL(supabaseUrl);
    projectRef = urlObj.hostname.split('.')[0];
  } catch {
    console.error('ERROR: Invalid Supabase URL format.');
    process.exit(1);
  }

  if (projectRef !== TARGET_PROJECT_REF) {
    console.error(`ERROR: Supabase URL points to project '${projectRef}', expected production project '${TARGET_PROJECT_REF}'. Aborting.`);
    process.exit(1);
  }

  if (!serviceKey || serviceKey.length < 20 || serviceKey.includes('REDACTED')) {
    console.error('ERROR: Valid SUPABASE_SERVICE_ROLE_KEY not found in environment file.');
    process.exit(1);
  }

  console.log(`  ✓ Environment file: ${path.basename(TARGET_ENV_FILE)}`);
  console.log(`  ✓ Verified Target Supabase Host: ${new URL(supabaseUrl).hostname}`);
  console.log(`  ✓ Verified Target Project Ref: ${projectRef}`);
  console.log(`  ✓ Service Role Key present (length: ${serviceKey.length} chars, prefix: ${serviceKey.slice(0, 5)}...)`);

  // Step 2: Account Existence & Role Verification
  console.log('\n[2/4] Verifying target Super Admin account in production Supabase...');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(TARGET_UID);
  if (userError || !userData?.user) {
    console.error(`ERROR: Target UID '${TARGET_UID}' not found in Supabase Auth:`, userError?.message);
    process.exit(1);
  }

  const user = userData.user;
  if (user.email !== TARGET_EMAIL) {
    console.error(`ERROR: UID '${TARGET_UID}' belongs to email '${user.email}', expected '${TARGET_EMAIL}'. Aborting.`);
    process.exit(1);
  }

  // Check role in public.profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', TARGET_UID)
    .single();

  if (profileError || !profile) {
    console.error(`ERROR: Profile not found for UID '${TARGET_UID}':`, profileError?.message);
    process.exit(1);
  }

  if (profile.role !== 'super_admin') {
    console.error(`ERROR: User role is '${profile.role}', expected 'super_admin'. Aborting.`);
    process.exit(1);
  }

  console.log(`  ✓ Supabase Auth User Verified:`);
  console.log(`      UID: ${user.id}`);
  console.log(`      Email: ${user.email}`);
  console.log(`      Email Confirmed: ${user.email_confirmed_at ? 'YES (' + user.email_confirmed_at + ')' : 'NO'}`);
  console.log(`      Created At: ${user.created_at}`);
  console.log(`      Last Sign In: ${user.last_sign_in_at || 'Never'}`);
  console.log(`  ✓ Public Profile Verified:`);
  console.log(`      Role: ${profile.role}`);
  console.log(`      Display Name: ${profile.full_name || 'N/A'}`);

  if (isVerifyOnly) {
    console.log('\n[VERIFY ONLY COMPLETE]');
    console.log('Account is 100% verified and ready for password reset.');
    console.log('No modifications were made.');
    process.exit(0);
  }

  // Step 3: Interactive Password Entry & Validation
  console.log('\n[3/4] Secure Password Input (Keystrokes masked with *)...');
  console.log('Requirements: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.');

  let newPassword = await readHiddenPassword('Enter new Super Admin password: ');
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    console.error(`\nValidation Error: ${validation.message}`);
    process.exit(1);
  }

  let confirmPassword = await readHiddenPassword('Confirm new Super Admin password: ');
  if (newPassword !== confirmPassword) {
    console.error('\nError: Passwords do not match. Aborting.');
    process.exit(1);
  }

  console.log('  ✓ Password validation passed and confirmation matches.');

  // Confirmation step
  const answer = await readLineInput(`\nType 'CONFIRM' to execute password reset for ${TARGET_EMAIL}: `);
  if (answer !== 'CONFIRM') {
    console.log('Operation aborted. No changes were made.');
    process.exit(0);
  }

  // Step 4: Execute Password Reset via Supabase Admin API
  console.log('\n[4/4] Executing password update via supabase.auth.admin.updateUserById...');
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    TARGET_UID,
    { password: newPassword }
  );

  // Clear password from variable reference immediately
  newPassword = null;
  confirmPassword = null;

  if (updateError) {
    console.error('ERROR: Failed to update password:', updateError.message);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('           PASSWORD RESET SUCCESSFUL!               ');
  console.log('====================================================');
  console.log(`  Target Email: ${updateData.user.email}`);
  console.log(`  Target UID:   ${updateData.user.id}`);
  console.log(`  Updated At:   ${updateData.user.updated_at}`);
  console.log(`  Role:         ${profile.role} (Preserved)`);
  console.log('\nYou can now log in at: https://codeaxys.com/admin/login');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err?.message || err);
  process.exit(1);
});
