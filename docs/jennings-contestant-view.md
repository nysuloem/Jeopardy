# Jennings contestant view

The supplied November 14 podium photograph is now used for Jennings-era contestant shots during regular answers, Daily Double answers, judging reviews, Final response reveals and champion results. Trebek keeps its existing podium presentation.

The built-in image editor removed the three original contestants (including the outstretched hands) and their handwritten names, reconstructed the set behind them, and preserved the three podiums, blank score panels, timer rails and floor. The cleaned result is `public/assets/jennings-contestant-stage.webp`, 1766 × 891. The image is used without stretching or cropping.

`public/jennings-podiums.css` places uploaded contestant portraits behind the photographed desk tops, actual scores inside the score monitors, handwritten signatures inside the name panels, and the existing ten countdown lights on the timer rails. All coordinates scale within the same fixed-aspect stage. Final answers and wagers replace only the active name panel during their reveal.

Validation: all 57 repository tests pass. Client DOM checks verify the three portraits/signatures, negative scores, active-player-only countdown lights at 0/3/7.5/15 seconds, Final answer/wager display, and the Trebek fallback. Browser screenshot verification was unavailable in this environment.
