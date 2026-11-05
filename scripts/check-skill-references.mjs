#!/usr/bin/env node
// Fail when a skill names an MCP tool or a skill that does not exist.
//
// MCP tools: names come from scripts/mcp-tools.txt. A tool reference is code,
// either an inline code span that holds only a tool-shaped name (`list-apps`)
// or the first word of a line in a fenced block. "Tool-shaped" means it starts
// with a verb that some real tool starts with, so `create-package` is checked
// and `rc apps list` is not. Prose such as "duplicate-package errors" is not
// checked, which is why the report counts what it examined.
//
// Skills: `/<plugin>:<skill>` must name a plugin in .claude-plugin/marketplace.json
// and a skill directory inside it.
//
// Usage: node scripts/check-skill-references.mjs

import { glob, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [toolsText, marketplaceText] = await Promise.all([
  readFile(join(repoRoot, 'scripts', 'mcp-tools.txt'), 'utf8'),
  readFile(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'),
]);
const tools = new Set(
  toolsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')),
);
const verbs = [...new Set([...tools].map((tool) => tool.split('-')[0]))];
const toolShaped = new RegExp(`^(?:${verbs.join('|')})-[a-z0-9]+(?:-[a-z0-9]+)*$`);

const plugins = await Promise.all(
  JSON.parse(marketplaceText).plugins.map(async (plugin) => {
    const root = join(repoRoot, plugin.source);
    const [skillFiles, files] = await Promise.all([
      Array.fromAsync(glob('skills/*/SKILL.md', { cwd: root })),
      Array.fromAsync(glob('**/*.md', { cwd: root })),
    ]);
    return {
      name: plugin.name,
      skills: new Set(skillFiles.map((file) => basename(dirname(file)))),
      files: files.sort().map((file) => join(root, file)),
    };
  }),
);
const skillsByPlugin = new Map(plugins.map((plugin) => [plugin.name, plugin]));
// Skill names share the tools' verb-noun shape (create-revenuecat-project), so
// a code span holding a skill name is a skill reference, not an unknown tool.
const allSkills = new Set(plugins.flatMap(({ skills }) => [...skills]));

const documents = await Promise.all(
  plugins.flatMap((plugin) =>
    plugin.files.map(async (file) => ({ plugin: plugin.name, file, text: await readFile(file, 'utf8') })),
  ),
);

const counts = { files: 0, toolRefs: 0, skillNames: 0, slashRefs: 0 };
const toolsSeen = new Set();
const problems = [];

for (const { plugin: pluginName, file, text } of documents) {
  counts.files += 1;
  const where = relative(repoRoot, file);
  const synced = pluginName === 'revenuecat-play-billing';
  let inFence = false;
  text.split('\n').forEach((line, index) => {
    const at = `${where}:${index + 1}`;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    const candidates = inFence
      ? [line.match(/^\s*([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?=[\s(:]|$)/)?.[1]]
      : [...line.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
    for (const name of candidates) {
      if (!name || !toolShaped.test(name)) continue;
      if (allSkills.has(name)) {
        counts.skillNames += 1;
      } else if (tools.has(name)) {
        counts.toolRefs += 1;
        toolsSeen.add(name);
      } else {
        problems.push({ at, synced, message: `unknown MCP tool \`${name}\`` });
      }
    }
    for (const match of line.matchAll(/(?<![\w/])\/([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)/g)) {
      const [ref, plugin, skill] = match;
      if (/^https?$/.test(plugin)) continue;
      counts.slashRefs += 1;
      const target = skillsByPlugin.get(plugin);
      if (!target) {
        problems.push({ at, synced, message: `\`${ref}\` names plugin \`${plugin}\`, which this marketplace does not have` });
      } else if (!target.skills.has(skill)) {
        problems.push({ at, synced, message: `\`${ref}\` names skill \`${skill}\`, which ${plugin} does not have` });
      }
    }
  });
}

console.log(
  `Examined ${counts.files} files: ${counts.toolRefs} MCP tool references (${toolsSeen.size} of ${tools.size} tools), ` +
    `${counts.skillNames} skill names, ${counts.slashRefs} /plugin:skill references. ` +
    'Not examined: tool names in plain prose.',
);

if (problems.length) {
  for (const { at, synced, message } of problems) {
    const fix = synced ? ' (synced file: fix it in RevenueCat/play-billing-skills)' : '';
    console.error(`${at}: ${message}${fix}`);
  }
  console.error(
    `\n${problems.length} broken reference(s). Use a tool name from scripts/mcp-tools.txt; if the tool is new, ` +
      'add it there from https://www.revenuecat.com/docs/tools/mcp/tools-reference. Skill references must name an existing skill directory.',
  );
  process.exit(1);
}
