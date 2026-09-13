# Jeopardy Home Game

A TV-first Jeopardy game with randomly selected Alex Trebek and Ken Jennings eras. The host screen creates a room and contestants join from their phones to sign their podium, wager, buzz, and respond.

## Features

- Up to three contestants with finger-drawn podium signatures and uploaded podium photos
- Dynamic contestant introductions using occupation, location, and returning-champion records
- Jeopardy, Double Jeopardy, Daily Doubles, and Final Jeopardy
- Server-authoritative buzz lockout, scoring, private wagers, and automatic host rulings
- OpenAI-generated boards, semantic response judging, and synchronized AI host narration, with a complete offline fallback game
- Presentation-only 16:9 TV display; clue selection, buzzing, wagers, and responses are controlled from contestant phones
- Spoken category introductions, player-by-player selection prompts, 15-second microphone responses that contestants explicitly submit, and automatic round progression
- Spoken Daily Double wagers, including "True Daily Double," plus a broadcast-style animated reveal
- Typed-only, draft-safe Final Jeopardy responses with the full 30-second music cue and low-to-high staged reveal
- A background-generated bank of 12 complete games, persisted between deployments
- Durable champion, game, and clue history on a Railway volume

## Railway

Mount a persistent volume at `/data`, then configure:

- `DATA_DIR=/data`
- `OPENAI_API_KEY` for generated boards, semantic judging, and host narration
- `OPENAI_TTS_MODEL` optionally overrides the default `gpt-4o-mini-tts` narration model
- `OPENAI_MODEL` optionally overrides the default `gpt-5-mini`

Railway runs `npm start` and serves both the game and Socket.IO server from `PORT`.

After deployment, visit `/api/game-bank` to see the 12-game bank fill in. Generation runs in the background, one full game at a time, so the app remains playable while the bank is being prepared. Keep the `/data` volume mounted so generated games and champion history survive redeployments.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`, choose **Host on This Screen**, and scan the QR code with contestant phones.
