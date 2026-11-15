# Trebek media and signaling rules

The supplied 45.8-second recording is split into a title opening (source 2.75–6.00 seconds) and host entrance (33.55–42.35 seconds). The original contestant introductions and final Maria segment are excluded; the remaining clips surround the app's own contestant introductions. The late player controls are excluded, and clips have short audio fades. Existing intro-video autoplay recovery and cancellation apply to both eras; legacy audio remains the missing-media fallback.

The supplied contestant shot was restored into an empty set, without original contestants, scores or names, and packaged at 2484×1946. The classic-era presentation fits the entire original aspect ratio and maps contestant portraits, handwritten names, totals and red response lamps to the same photograph coordinates, including remote play and Final Jeopardy.

Official rules: https://www.jeopardy.com/jbuzz/behind-scenes/how-does-jeopardy-buzzer-work

The host's clue-read completion arms the devices and both side-light strips. A contestant can press while the clue is being read, but each early press starts a personal 250 ms lockout. An early press is never queued for acceptance when the lights turn on. The first eligible signal received by the server wins, and all others are ignored during that answer. After an incorrect response, the devices reset for the remaining contestants; the previous responder stays excluded for that clue. Duplicate narration-completion messages cannot reopen or prolong a rebound. Private lockouts survive reconnects and stay out of public room state. Daily Doubles and Final Jeopardy do not use buzzers.

Phones signal on pointer-down or a fresh Space/Enter press. Holding a key does not repeat; a new press is needed after the lockout. Remote play uses the same controls and server arbitration. Network arrival order decides the winner, as with the app's existing buzzer transport; a networked game cannot replicate the show's wired hardware timing exactly.

Validation includes exact lockout boundaries, repeated early presses, competing contestants, rebound exclusions, stale clue identities, private state, socket-level arming and duplicate-read handling, keyboard/pointer input and existing game flow. Video source frames were checked at the trims. The high-resolution set is a restored image, not recovered archival detail.
