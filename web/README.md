# tft-coach web app (Fase 2)

Analizador de partida en vivo: subís una captura de tu tablero de TFT, una
IA con visión la lee, y te recomienda comp/campeones/items — usando datos
reales de [pipeline/](../pipeline/) cuando existen para la comp detectada, o
razonamiento de IA claramente etiquetado como estimado cuando todavía no.

## Setup

1. Conseguí una API key de Anthropic en https://console.anthropic.com/
2. Copiá `.env.local.example` a `.env.local` y completá:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` — el mismo connection string de Neon que ya usa
     `pipeline/.env` (esta app solo lee `comp_stats`/`item_stats`, nunca
     escribe).
3. Instalá dependencias: `npm install`

## Correr

```
npm run dev
```

Abrí http://localhost:3000, subí/pegá una captura de tu tablero, y clickeá
"Analizar tablero".

## Cómo funciona

1. `app/api/analyze-screenshot/route.ts` manda la imagen a Claude (con
   visión) junto con los nombres reales de campeones/items del parche
   actual (`lib/staticData.ts`, misma fuente que usa el pipeline) para que
   los identifique bien.
2. Las sinergias activas del tablero se calculan del lado del servidor
   (`computeActiveTraits` en `lib/staticData.ts`) a partir de los campeones
   detectados y los umbrales reales de cada trait — no se le pide a la IA
   que lea el panel de sinergias, es más confiable así.
3. `app/api/recommend/route.ts` calcula la firma de la comp
   (`lib/compSignature.ts`, mismo criterio que
   `pipeline/tft_pipeline/comp_signature.py` — hay que mantener ambos
   iguales), busca esa firma en Postgres (`lib/db.ts`), y le pide a Claude
   una recomendación — con los números reales si los hay, o etiquetada como
   estimada si no.
