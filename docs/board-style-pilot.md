# New-style game pilot — November 2026

## Editorial sample

Reviewed category sets and clue wording from ten games, two spaced episodes in each of five seasons. This is a bounded editorial review, not an imported clue bank. All 61 pilot clues are original.

| Season | Games reviewed |
| --- | --- |
| 10 | [6795](https://j-archive.com/showgame.php?game_id=6795), [8433](https://j-archive.com/showgame.php?game_id=8433) |
| 25 | [3108](https://j-archive.com/showgame.php?game_id=3108), [3068](https://j-archive.com/showgame.php?game_id=3068) |
| 35 | [6386](https://j-archive.com/showgame.php?game_id=6386), [6335](https://j-archive.com/showgame.php?game_id=6335) |
| 40 | [8996](https://j-archive.com/showgame.php?game_id=8996), [8974](https://j-archive.com/showgame.php?game_id=8974) |
| 43 | [9574](https://j-archive.com/showgame.php?game_id=9574), [9552](https://j-archive.com/showgame.php?game_id=9552) |

Editorial inferences: straightforward subjects coexist with themed angles, connected meanings and explicit word mechanics. Titles sometimes form a set, but usually stand independently. A category premise gives players a useful solving constraint. Clues often supply a second identifying connection, use varied syntax and occasional wit, and are not confined to one-sentence dictionary definitions. Familiar broad subjects return regularly. Category word overlap is not evidence of repeated facts.

## Play the pilot

On the landing screen select **New Style Pilot · Canadian Tilt** in **Game board**, then choose **Host on This Screen** or **Remote Play**. This is a full 61-clue, two-round scored game with Daily Doubles and Final Jeopardy. Results do not affect champion records. It is explicitly replayable for comparison; selecting it does not consume any original-bank board. Its clues are recorded once in the permanent freshness ledger so future ordinary generation can avoid them. The public availability endpoint contains only pilot metadata, not its clues or answers.

The pilot has 10 Canadian connections, 9 U.S. connections and 42 global/general clues under editorial tagging (a cultural work can have a geographic connection without mentioning a country). Canadian material appears in multiple categories. General generation guidance aims roughly at 15% Canada / 10% U.S.; this is a flexible editorial target, not a rejection rule.

After playing, compare: category clarity and variety, whether the title helps solve the clue, naturalness of the wording, lower-value accessibility, upper-value challenge, and Canadian balance. Keep the existing bank as the comparison group until feedback is available.

## Generator and validation changes

- Plan twelve slots before drafting: eight knowledge categories, one connection category, and three word-mechanic categories, distributed across two rounds. Rotate subjects and category order.
- Familiar category titles may recur across games. Exact duplicate titles within one game remain invalid. Shared topic words are advisory, not a board rejection reason.
- A historical category/response pair alone no longer counts as a duplicated fact. Exact clues and substantial lexical paraphrases with the same response are rejected. This heuristic is not a complete semantic fact checker; generation instructions also require fresh facts.
- Keep distinct responses within a game, answer-leak checks, complete boards and valid category mechanics. Enforce multi-letter Starts With, Ends With and numeric letter-count rules, plus exact Before & After bridge proofs.
- Permit up to 42 words / 240 characters when useful identifying context needs it. The actual pilot is shorter (at most 111 characters / 19 words per clue). Longer ordinary clues use reduced type.
- Lock accepted content during targeted repair. Use at most two repair passes and a shared 20-request budget for one generation or repair job. Automatic generation stays opt-in and paused in production. Full failed candidates remain in the existing durable repair queue.
- Startup no longer rewrites source files. Existing champion fixes and orthographic judging are retained directly in source/runtime code. Old entry points remain compatible.

## Selected factual checks

Consulted sources for facts most in need of checking; ordinary stable facts also received editorial review. Sources are kept here to avoid spoiling responses on the game screen.

- [Amundsen's Northwest Passage voyage](https://www.rmg.co.uk/stories/maritime-history/roald-amundsen-north-west-passage-expedition-1903-06) and [South Pole expedition](https://www.rmg.co.uk/stories/maritime-history/race-south-pole-scott-amundsen), Royal Museums Greenwich.
- [Emily Carr, Big Raven](https://artbooks.artcanada.com/emily-carr/key-works/big-raven), Art Canada Institute; [Emily Carr collection](https://www.vanartgallery.bc.ca/exhibitions/emily-carr/), Vancouver Art Gallery.
- [Helium](https://periodic-table.rsc.org/element/2/helium/) and [tungsten](https://periodic-table.rsc.org/element/74/tungsten), Royal Society of Chemistry.
- [Céline Dion biography](https://www.celinedion.com/about/biography/), artist's official site.
- [San Marino and Mount Titano](https://whc.unesco.org/en/list/1245), UNESCO; [Saint Marinus and the republic](https://www.visitsanmarino.com/pub1/VisitSM/en/luogo/Arte-e-cultura/Titanus_Museum.html), Visit San Marino.

## Verification

Automated coverage includes a complete pilot, its mechanics, freshness rules, single-clue repair with valid slots preserved, mixed board planning, both socket play modes, normal scoring/history isolation, hidden responses and unchanged original-bank counts. Browser QA verified the selector and resulting pilot lobby. No paid board generation was needed to create this pilot.
