# Jeopardy Home Game

A TV-first Jeopardy game with randomly selected Alex Trebek and Ken Jennings eras. The host screen creates a room and contestants join from their phones to sign their podium, wager, buzz, and respond.

## Features

- Up to three contestants with finger-drawn or typed podium signatures
- Dynamic contestant introductions using occupation, location, and returning-champion records
- Jeopardy, Double Jeopardy, Daily Doubles, and Final Jeopardy
- Server-authoritative buzz lockout, scoring, private wagers, and host ruling reversal
- OpenAI-generated boards and semantic response judging, with a complete offline fallback game
- Durable champion, game, and clue history on a Railway volume

## Railway

Mount a persistent volume at `/data`, then configure:

- `DATA_DIR=/data`
- `OPENAI_API_KEY` for generated boards and semantic judging
- `OPENAI_MODEL` optionally overrides the default `gpt-5-mini`

Railway runs `npm start` and serves both the game and Socket.IO server from `PORT`.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`, choose **Host on This Screen**, and scan the QR code with contestant phones.
