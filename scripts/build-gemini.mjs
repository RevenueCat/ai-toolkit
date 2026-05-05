#!/usr/bin/env node
/**
 * Build script: copies plugins/revenuecat/ → dist/gemini/revenuecat/ and
 * rewrites Claude-flavored tool names in agent files to Gemini equivalents.
 */

import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'plugins', 'revenuecat');
const DEST = join(ROOT, 'dist', 'gemini', 'revenuecat');

// Claude tool name → Gemini tool name
const TOOL_RENAMES = {
  '\\bRead\\b': 'read_file',
  '\\bWrite\\b': 'write_file',
  '\\bEdit\\b': 'edit_file',
  '\\bBash\\b': 'run_shell_command',
  '\\bGlob\\b': 'glob',
  '\\bGrep\\b': 'grep',
};

async function rewriteToolNames(content) {
  let out = content;
  for (const [pattern, replacement] of Object.entries(TOOL_RENAMES)) {
    out = out.replace(new RegExp(pattern, 'g'), replacement);
  }
  return out;
}

async function copyAndRewrite(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyAndRewrite(srcPath, destPath);
    } else if (entry.name.endsWith('.md')) {
      const content = await readFile(srcPath, 'utf8');
      await writeFile(destPath, await rewriteToolNames(content), 'utf8');
    } else {
      await cp(srcPath, destPath);
    }
  }
}

async function main() {
  console.log(`Building Gemini export: ${SRC} → ${DEST}`);

  if (!existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }

  await mkdir(DEST, { recursive: true });
  await copyAndRewrite(SRC, DEST);

  // Place gemini-extension.json at the export root (not nested in the plugin dir copy)
  const geminiManifest = join(SRC, 'gemini-extension.json');
  if (existsSync(geminiManifest)) {
    await cp(geminiManifest, join(DEST, 'gemini-extension.json'));
  }

  console.log('Done.');
}

main();
