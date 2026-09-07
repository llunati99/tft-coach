# tft-coach

Web app to help play and improve at Teamfight Tactics (TFT): stats tracking, build/comp recommendations, and match analysis.

Status: core loop working end to end (screenshot in, AI-backed recommendation out); scouting rival boards and manual board entry are next.

## Roadmap

1. **Data pipeline** ([pipeline/](pipeline/), running) — collects real TFT match data via the Riot API and computes real placement/win-rate statistics per comp and item build, per patch. This is the statistical foundation the app recommends from; keeps improving in the background.
2. **Web app** ([web/](web/), in progress) — upload a screenshot of your live match on PC, Claude (vision) reads the board, and the app recommends comp direction/champions/items — backed by real stats from step 1 when available for that comp, clearly labeled as AI-estimated when not. Scouting rival boards and manual board entry (as a faster alternative to screenshots) are the next features.

See [pipeline/README.md](pipeline/README.md) and [web/README.md](web/README.md) for setup instructions.
