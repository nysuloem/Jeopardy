# Three real games — archive breadth review

The user approved the pilot's writing and requested ten additional archive reviews, three real OpenAI-generated games replacing the previous playable boards, less wasteful rejection rules, and preservation of unfinished Final Jeopardy wagers.

## Additional editorial sample

These ten Season 38 games do not overlap the documented original ten-game sample or the later fifteen-game sample. This is a bounded editorial reading, not an imported clue corpus. Observations are interpretations of the boards and clue wording.

| Airdate | Show | Archive | Observation |
|---|---|---|---|
| 2022-01-26 | 8563 | https://j-archive.com/showgame.php?game_id=7250 | Cereals, animal comfort, homophones, alphabets, and children's television show how everyday knowledge and word mechanics coexist. |
| 2022-02-15 | 8577 | https://j-archive.com/showgame.php?game_id=7279 | First-person historical voices, food etymologies, excerpts, prisons, tools, and physiology use very different routes to identification. |
| 2022-03-07 | 8591 | https://j-archive.com/showgame.php?game_id=7303 | Mountains, cooking, idioms, adaptations, biographies, and celebrity names demonstrate breadth beyond academic trivia. |
| 2022-03-25 | 8605 | https://j-archive.com/showgame.php?game_id=7317 | Regional music, beer, lawns, literature, law, and scientists can share a board. Linked titles do not require linked subject matter. |
| 2022-04-14 | 8619 | https://j-archive.com/showgame.php?game_id=7331 | Fast food, mythology-derived words, Bible translations, economics, and geographical poetry offer coherent angles. Final's constraints can exclude plausible alternatives. |
| 2022-05-04 | 8633 | https://j-archive.com/showgame.php?game_id=7345 | A mock music countdown frames presidents; fictional places identify their creators. Prefix pairs supply an explicit two-response task. |
| 2022-05-24 | 8647 | https://j-archive.com/showgame.php?game_id=7364 | Headlines, bridges, medical abbreviations, and a recurring first name frame different subjects. Short definitions remain legitimate clue forms. |
| 2022-06-13 | 8661 | https://j-archive.com/showgame.php?game_id=7381 | Book titles can be approached through referents. Rock musicians with advanced degrees cross entertainment and education rather than relying only on songs. |
| 2022-07-01 | 8675 | https://j-archive.com/showgame.php?game_id=7402 | Animals through laws, events through holidays, films through production locations, and books through one-word titles supply precise angles. |
| 2022-07-21 | 8689 | https://j-archive.com/showgame.php?game_id=7417 | Bears connect astronomy, music, fiction, and zoology. Literary endings and compound-word definitions offer different solving experiences. |

## Resulting generation policy

- Broaden the category domain pool to include religion, mythology, business, brands, transport, fashion, quotations, and performing arts alongside existing fields.
- Rotate one or two explicit wordplay slots; do not require three in every game or force Before & After on every board. Retain a connection category and modest Canadian tilt.
- Permit concise definitions, fragments, quotation completions, and pairs where the category supplies the task.
- Shared roots or a partial word from a multiword response no longer invalidate a clue. Complete canonical answers and substantive aliases in clue text remain blocked.
- Raise the approximate same-response lexical duplicate threshold from 0.55 to 0.60. Exact duplicate clues and strong paraphrases remain blocked. This is a heuristic, not comprehensive semantic duplicate detection.
- Keep full game structure, distinct responses, explicit mechanic checks, and the existing bounded targeted repairs. No extra AI critic loop.
- These instructions describe original generation craft; no archive clues are copied into the new game bank.

## Replacement behavior

Release `archive-breadth-2026-11-14` runs one bounded batch of three full games through the configured OpenAI API, using the production model and key. Each game has 30 Jeopardy clues, 30 Double Jeopardy clues, three Daily Doubles, and one Final.

Completed generated games are checkpointed. Old boards are unavailable while preparing the replacement. All three are installed with one atomic bank write, clearing the previous ready stock and repair queue. A durable release marker prevents restart refills or replay after consumption. The pilot and old-question test are removed from player choices; prior boards are refused through the socket API as well. Existing used-clue and champion history remain intact.

Final Jeopardy wagers save a private browser draft on input, keyed to room and stable player token. Room broadcasts restore the draft and input focus. Successful submission clears it; failed submission preserves it. This applies to both phone and Remote Play controls. Drafts are never sent to the server before submission.
