#!/usr/bin/env node
// Sync the revenuecat/ skill collection from RevenueCat/play-billing-skills
// into the revenuecat-play-billing plugin.
//
// Source of truth: https://github.com/RevenueCat/play-billing-skills
// Do not edit revenuecat-play-billing/skills/ or revenuecat-play-billing/LICENSE
// by hand — changes there are overwritten on the next sync. Fix the source
// repo instead.
//
// Usage: node scripts/sync-play-billing.mjs <path-to-play-billing-skills-checkout>

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg = process.argv[2] ?? process.env.PLAY_BILLING_SKILLS_DIR;
if (!sourceArg) {
  console.error('Usage: node scripts/sync-play-billing.mjs <path-to-play-billing-skills-checkout>');
  process.exit(1);
}
const sourceRoot = resolve(sourceArg);
const sourceSkills = join(sourceRoot, 'revenuecat');
if (!existsSync(sourceSkills)) {
  console.error(`No revenuecat/ collection found at ${sourceRoot}`);
  process.exit(1);
}

const pluginRoot = join(repoRoot, 'revenuecat-play-billing');
const targetSkills = join(pluginRoot, 'skills');

const slugs = readdirSync(sourceSkills, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(sourceSkills, entry.name, 'SKILL.md')))
  .map((entry) => entry.name)
  .sort();

// Longest first so the alternation never matches a prefix of a longer slug.
const alternation = [...slugs].sort((a, b) => b.length - a.length).join('|');
// `[setup](../setup/)` -> `[rc-setup](../rc-setup/)` (link text matches the slug)
const namedLink = new RegExp(`\\[(${alternation})\\]\\(\\.\\./\\1/`, 'g');
// `](../setup/` -> `](../rc-setup/` (any remaining relative skill link)
const relativeLink = new RegExp(`\\]\\(\\.\\./(${alternation})/`, 'g');
// `revenuecat/setup` -> `rc-setup` (textual refs; the lookbehind keeps sample
// code like `post("/revenuecat/webhook")` and URLs untouched)
const textualRef = new RegExp(`(?<![\\w/.-])revenuecat/(${alternation})(?![\\w-])`, 'g');
const frontmatterName = new RegExp(`^name: (${alternation})$`, 'm');

rmSync(targetSkills, { recursive: true, force: true });
mkdirSync(targetSkills, { recursive: true });

for (const slug of slugs) {
  const content = readFileSync(join(sourceSkills, slug, 'SKILL.md'), 'utf8')
    .replace(frontmatterName, 'name: rc-$1')
    .replace(namedLink, '[rc-$1](../rc-$1/')
    .replace(relativeLink, '](../rc-$1/')
    .replace(textualRef, 'rc-$1');
  const targetDir = join(targetSkills, `rc-${slug}`);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, 'SKILL.md'), content);
}

copyFileSync(join(sourceRoot, 'LICENSE'), join(pluginRoot, 'LICENSE'));

console.log(`Synced ${slugs.length} skills into revenuecat-play-billing/skills/`);
