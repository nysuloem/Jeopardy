# Jeopardy Home Game

A Jeopardy game with randomly selected Alex Trebek and Ken Jennings eras. It supports a shared 16:9 host screen with contestant phone controllers or one-device Remote Play for contestants in different locations.

## Features

- Up to three contestants with finger-drawn podium signatures and uploaded podium photos
- Dynamic contestant introductions using occupation, location, and returning-champion records
- Jeopardy, Double Jeopardy, Daily Doubles, and Final Jeopardy
- Server-authoritative buzz lockout, scoring, private wagers, and automatic host rulings
- OpenAI-generated boards, semantic response judging, and synchronized AI host narration, with a complete offline fallback game
- Presentation-only 16:9 TV display; clue selection, buzzing, wagers, and responses are controlled from contestant phones
- One-device Remote Play with the synchronized board, clues, scores, narration, music, sound effects, and personal controls on every contestant’s device
- Automatic narration and round progression in both modes, with remote control authority moving to another connected contestant if the current device disconnects
- Spoken category introductions, player-by-player selection prompts, 15-second microphone responses that contestants explicitly submit, and automatic round progression
- Spoken Daily Double wagers, including "True Daily Double," plus a broadcast-style animated reveal
- Typed-only, draft-safe Final Jeopardy responses with the full 30-second music cue and low-to-high staged reveal
- A consumable, background-generated bank of 12 complete games
- An uncapped permanent clue ledger on the Railway volume; assigned clues are reserved before play and exact clues or repeated category/response facts are rejected from every refill
- Durable champion, game, and clue history on a Railway volume

## Railway

Mount a persistent volume at `/data`, then configure:

- `DATA_DIR=/data`
- `OPENAI_API_KEY` for generated boards, semantic judging, and host narration
- `OPENAI_TTS_MODEL` optionally overrides the default `gpt-4o-mini-tts` narration model
- `OPENAI_MODEL` optionally overrides the default `gpt-5-mini`

Railway runs `npm start` and serves both the game and Socket.IO server from `PORT`.

After deployment, visit `/api/game-bank` to see the 12-game bank fill in and the number of permanently reserved clues. Generation runs in the background, one full game at a time. Each assigned game is removed from the queue and replaced with a newly generated game. Keep the `/data` volume mounted so the bank, clue ledger, and champion history survive redeployments.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`. Choose **Host on This Screen** for shared-TV play or **Remote Play** to create a link that each contestant opens on their own device.
