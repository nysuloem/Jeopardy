'use strict';

// Original editorial guidance distilled from a bounded cross-season sample.
// No archive clues or responses are used as a generation corpus.
const EDITORIAL_GUIDE = `Write for a Canadian household playing a real Jeopardy-style game.
A category is a playable premise, not just a clever heading pasted onto unrelated trivia.
Mix plain subject headings, playful but intelligible themes, connected meanings, and real word mechanics.
Do not force a pun into every title. Broad subjects and familiar category names can recur across games.
Write original clues, not copies or close paraphrases of television clues.
Choose a canonical response first, then write a specific identifying fact and, when helpful, a second route to it.
Use natural declarative broadcast language, varied syntax, economical context, and occasional understated wit.
Avoid quiz questions, 'name this' instructions, definition-only strings, vague superlatives, and unsupported claims.
Do not pad a clue to meet a word target. Short clues are welcome; a useful second hint is better than needless compression.
For ordinary knowledge categories the title should help orient the player. For wordplay it is part of the solving rule.
Five rows should progress from accessible recognition toward deeper knowledge or inference; Double Jeopardy is harder overall.
Do not confuse difficulty with obscure dates, arbitrary statistics, or specialist-only names.
Canadian perspective is a modest tilt: approximately 9 of 61 clues Canadian, 6 explicitly U.S.-focused, the rest global/general.
These are flexible whole-game editorial targets, never per-category quotas or validation gates.
Canadian content should span culture, places, people, history and discoveries; avoid defaulting to U.S. civic trivia.
Keep responses and tested facts distinct within the game. Across history, reject repeated clues/facts, not entire subjects.
Aliases must identify exactly the same response, and category mechanics must hold for every response.`;

function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createBoardPlan() {
  const domains = shuffled(['geography and travel', 'world history', 'literature and language',
    'music', 'film and television', 'science and nature', 'art and architecture',
    'food and everyday life', 'sports and games', 'technology and inventions']);
  const knowledge = domains.slice(0, 7).map((domain, index) => ({
    type: 'knowledge', domain,
    premise: 'Choose a recognizable, coherent angle broad enough for five different responses.',
    canadianClues: index < 4 ? 'Include one naturally Canadian clue if it fits; remaining clues global/general.' : 'No geographic quota.'
  }));
  const mechanics = shuffled([
    { type: 'wordplay', premise: 'A quoted letter or short letter sequence that begins every response; make the rule clear in the title.' },
    { type: 'wordplay', premise: 'An explicit letter-count category, using single-word responses with exactly that many letters.' },
    { type: 'wordplay', premise: 'BEFORE & AFTER: two recognizable answers joined on one exact shared word or phrase. Provide mechanicProof.' }
  ]);
  const connection = { type: 'connection', premise: 'Two everyday meanings share one word, or a similarly clear connecting rule. Explain it briefly in the title.' };
  const canadian = { type: 'knowledge', domain: shuffled(['Canadian music and performers', 'Canadian places', 'Canadian history and inventions', 'Canadian books and art'])[0], premise: 'A recognizable Canadian category, with five distinct responses and useful identifying context.' };
  return [shuffled([...knowledge.slice(0, 3), canadian, connection, mechanics[0]]),
    shuffled([...knowledge.slice(3), ...mechanics.slice(1)])];
}

module.exports = { EDITORIAL_GUIDE, createBoardPlan };
