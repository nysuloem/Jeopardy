'use strict';

const fs = require('node:fs');
const path = require('node:path');

async function protectedRepairGeneratedGame(game, priorRecords = [], priorCategories = []) {
  const initialIssues = generatedGameIssues(game, priorRecords, priorCategories);
  if (!initialIssues.length) return game;

  const initiallyBadCategories = new Set(
    initialIssues
      .filter((issue) => issue.kind === 'category')
      .map((issue) => `${issue.round}:${issue.category}`)
  );
  const initiallyBadClues = new Set(
    initialIssues
      .filter((issue) => issue.kind === 'clue')
      .map((issue) => `${issue.round}:${issue.category}:${issue.clue}`)
  );
  const initiallyBadFinal = initialIssues.some((issue) => issue.kind === 'final');

  const canTouch = (issue) => {
    if (issue.kind === 'final') return initiallyBadFinal;
    if (issue.kind === 'category') return initiallyBadCategories.has(`${issue.round}:${issue.category}`);
    if (issue.kind === 'clue') {
      return initiallyBadCategories.has(`${issue.round}:${issue.category}`)
        || initiallyBadClues.has(`${issue.round}:${issue.category}:${issue.clue}`);
    }
    return false;
  };

  const titleSchema = {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string' } },
    required: ['name']
  };

  for (let pass = 0; pass < 10; pass++) {
    const issues = generatedGameIssues(game, priorRecords, priorCategories);
    if (!issues.length) return game;

    if (issues.some((issue) => !canTouch(issue))) {
      throw new Error('Targeted repair tried to invalidate content that was previously good.');
    }

    const beforeRepair = structuredClone(game);
    const boardRecords = gameClueRecords(game);
    const boardClues = boardRecords.map((item) => item.clue);
    const boardResponses = boardRecords.map((item) => item.response);
    const boardCategories = gameCategories(game);

    const categoryIssues = issues.filter((issue) => issue.kind === 'category');
    for (const issue of categoryIssues) {
      const current = game.rounds[issue.round].categories[issue.category];
      let replacementCategory = null;

      if (/category title|category topic/i.test(issue.reason || '')) {
        const shell = structuredClone(game);
        shell.rounds[issue.round].categories.splice(issue.category, 1);
        const lockedRecords = [...priorRecords, ...gameClueRecords(shell)];
        const lockedCategories = [...priorCategories, ...gameCategories(shell)];

        for (let attempt = 0; attempt < 3 && !replacementCategory; attempt++) {
          const renamed = await requestStructured(
            'jeopardy_category_title_repair',
            titleSchema,
            'Rename this Jeopardy category while preserving all five supplied clues exactly. The new title must accurately describe all five clues, must not overlap any supplied category title, and must not impose a Starts With, Before & After, rhyme, letter-count, quotation, or other mechanic unless the five existing responses already satisfy it. Return only the new category name.',
            JSON.stringify({
              round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
              invalidName: current.name,
              clues: current.clues,
              reason: issue.reason,
              avoidCategories: lockedCategories.slice(-500)
            }),
            1000
          );
          const candidate = { ...current, name: renamed.name };
          if (categoryValidAgainst(candidate, lockedRecords, lockedCategories)) replacementCategory = candidate;
        }
      }

      if (!replacementCategory) {
        replacementCategory = await requestStructured(
          'jeopardy_category_repair',
          repairCategorySchema,
          'Replace one invalid Jeopardy category with a different title and five authentic broadcast-style clues. Preserve the requested round difficulty. Do not reuse or substantially overlap the subject or theme of any supplied category title, clue, or response. Clues must be concise declarative statements, not questions, and must not contain their response or a distinctive response root. Aliases must be genuine equivalents only. Use mechanicProof "standard" unless this is a valid BEFORE & AFTER category.',
          JSON.stringify({
            round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
            invalidCategory: current,
            reason: issue.reason,
            avoidCategories: [...priorCategories, ...boardCategories].slice(-500),
            avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
            avoidResponses: boardResponses.slice(-900)
          }),
          5000
        );
      }

      game.rounds[issue.round].categories[issue.category] = replacementCategory;
    }

    const clueIssues = issues.filter((issue) => issue.kind === 'clue');
    if (clueIssues.length) {
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          repairs: {
            type: 'array',
            minItems: clueIssues.length,
            maxItems: clueIssues.length,
            items: repairClueSchema
          }
        },
        required: ['repairs']
      };

      const requests = clueIssues.map((issue) => {
        const category = game.rounds[issue.round].categories[issue.category];
        return {
          id: `${issue.round}:${issue.category}:${issue.clue}`,
          round: issue.round ? 'DOUBLE JEOPARDY!' : 'JEOPARDY!',
          value: (issue.round ? [400, 800, 1200, 1600, 2000] : [200, 400, 600, 800, 1000])[issue.clue],
          category: category.name,
          invalid: category.clues[issue.clue],
          reason: issue.reason
        };
      });

      const result = await requestStructured(
        'jeopardy_clue_repairs',
        schema,
        'Repair only the listed invalid Jeopardy clues. Return exactly one replacement per id. Match each category and dollar-value difficulty. Use compact, natural, declarative broadcast wording with a uniquely correct response. Never expose the response or its distinctive root in the clue. Do not reuse any supplied clue or response. Aliases must be genuine equivalents only. Obey Starts With and every other category mechanic; for BEFORE & AFTER, supply an exact FIRST ANSWER || SECOND ANSWER || SHARED BRIDGE proof.',
        JSON.stringify({
          requests,
          avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
          avoidResponses: boardResponses.slice(-900)
        }),
        Math.max(3000, clueIssues.length * 500)
      );

      const byId = new Map(result.repairs.map((item) => [item.id, item]));
      for (const issue of clueIssues) {
        const id = `${issue.round}:${issue.category}:${issue.clue}`;
        const item = byId.get(id);
        if (!item) continue;
        const replacementClue = { ...item };
        delete replacementClue.id;
        game.rounds[issue.round].categories[issue.category].clues[issue.clue] = replacementClue;
      }
    }

    if (issues.some((issue) => issue.kind === 'final')) {
      const finalIssue = issues.find((issue) => issue.kind === 'final');
      game.final = await requestStructured(
        'final_jeopardy_repair',
        repairFinalSchema,
        'Replace one invalid Final Jeopardy item with a fresh category and authentic clue. Use one concise declarative statement, two useful facts, and one uniquely gettable response. Do not reuse supplied categories, clues, or responses, and never expose the response or its root in the clue. Aliases must be genuine equivalents only.',
        JSON.stringify({
          invalid: game.final,
          reason: finalIssue.reason,
          avoidCategories: [...priorCategories, ...boardCategories].slice(-500),
          avoidClues: [...priorRecords.map((item) => typeof item === 'string' ? item : item.clue), ...boardClues].slice(-900),
          avoidResponses: boardResponses.slice(-900)
        }),
        2500
      );
    }

    const afterIssues = generatedGameIssues(game, priorRecords, priorCategories);
    if (afterIssues.some((issue) => !canTouch(issue))) {
      game = beforeRepair;
      continue;
    }
  }

  throw new Error('Generated game failed validation after protected targeted repairs');
}

const gamePath = path.join(__dirname, 'game.js');
let gameSource = fs.readFileSync(gamePath, 'utf8');
const startMarker = 'async function repairGeneratedGame(game,priorRecords=[],priorCategories[]){';
const endMarker = '\nfunction categoryValidAgainst(category,priorRecords=[],priorCategories=[]){';
const start = gameSource.indexOf(startMarker);
const end = gameSource.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  throw new Error('Jeopardy repair-lock patch failed: repairGeneratedGame block changed.');
}

const replacement = protectedRepairGeneratedGame
  .toString()
  .replace('protectedRepairGeneratedGame', 'repairGeneratedGame');

gameSource = gameSource.slice(0, start) + replacement + gameSource.slice(end);

// Compile the exact patched game source before overwriting the live file. If the
// generated source is syntactically invalid, startup fails without mutating game.js.
new Function(gameSource);
fs.writeFileSync(gamePath, gameSource, 'utf8');
console.log('[repair-lock] protected targeted repair enabled; previously valid content is locked');

require('./start');
