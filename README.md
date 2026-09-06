# tft-coach

Web app to help play and improve at Teamfight Tactics (TFT): stats tracking, build/comp recommendations, and match analysis.

Status: early planning. Scope, MVP feature set, and tech stack are being defined via the spec-driven workflow in [openspec/](openspec/).

## Roadmap

1. **Data pipeline** ([pipeline/](pipeline/), in progress) — collects real TFT match data via the Riot API and computes real placement/win-rate statistics per comp and item build, per patch. This is the statistical foundation the app will recommend from.
2. **Web app** (not started) — upload a screenshot of your live match on PC, an AI model reads the board, and the app recommends comp directions backed by the real stats from step 1, plus heuristic (non-statistical) positioning advice.

See [pipeline/README.md](pipeline/README.md) for how to run the data pipeline.
