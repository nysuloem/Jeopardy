'use strict';

const fs = require('node:fs');
const path = require('node:path');

function replaceRequired(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`[startup-compat] ${label} target changed.`);
  return source.replace(oldText, newText);
}

const repairLockPath = path.join(__dirname, 'repair-lock-start.js');
let repairLockSource = fs.readFileSync(repairLockPath, 'utf8');
repairLockSource = replaceRequired(
  repairLockSource,
  'Do not reuse or substantially overlap the subject or theme of any supplied category title, clue, or response.',
  'Broad subject areas may recur. Choose a fresh category title and fresh clues, facts, and responses, but do not reject a useful history, science, geography, literature, arts, entertainment, sports, food, language, nature, or other broad domain merely because that domain appeared before. Never reuse a supplied clue, response, or obvious near-duplicate.',
  'protected category-repair prompt'
);
repairLockSource = replaceRequired(
  repairLockSource,
  'Do not reuse supplied categories, clues, or responses, and never expose the response or its root in the clue.',
  'Do not reuse supplied clues or responses, and never expose the response or its root in the clue. Broad Final Jeopardy subject areas may recur; use a fresh category title and tested fact rather than avoiding an entire subject domain.',
  'protected Final Jeopardy repair prompt'
);
new Function(repairLockSource);
fs.writeFileSync(repairLockPath, repairLockSource, 'utf8');

const startPath = path.join(__dirname, 'start.js');
let startSource = fs.readFileSync(startPath, 'utf8');
const oldGuard = "else if (!gameSource.includes(newRepairPrompt)) throw new Error('Jeopardy generation patch failed: category repair prompt changed.');";
const newGuard = "else if (!gameSource.includes(newRepairPrompt) && !/async\\s+function\\s+repairGeneratedGame\\s*\\(/.test(gameSource)) throw new Error('Jeopardy generation patch failed: category repair prompt changed.');";
startSource = replaceRequired(startSource, oldGuard, newGuard, 'category-repair compatibility guard');
new Function(startSource);
fs.writeFileSync(startPath, startSource, 'utf8');

console.log('[startup-compat] broader generation prompts made compatible with protected repair startup');
require('./repair-lock-start');
