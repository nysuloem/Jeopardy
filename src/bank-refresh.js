'use strict';

// This release authorizes one batch, not an automatic recurring refill.
const BANK_RELEASE = 'archive-breadth-2026-11-14';
const BANK_RELEASE_SIZE = 3;

async function buildReplacement({ load, save, generate, records, categories, progress = () => {} }) {
  const saved = load();
  const batch = saved?.release === BANK_RELEASE ? saved : { release: BANK_RELEASE, games: [] };
  while (batch.games.length < BANK_RELEASE_SIZE) {
    const game = await generate(records(batch.games), categories(batch.games), progress);
    game.id = `${BANK_RELEASE}-${batch.games.length + 1}`;
    game.source = 'openai-api';
    batch.games.push(game);
    save(batch); // Completed games survive a restart; never regenerate them.
  }
  return batch.games;
}

module.exports = { BANK_RELEASE, BANK_RELEASE_SIZE, buildReplacement };
