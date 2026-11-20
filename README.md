[![make.fun](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/gaiaoagoaia-art/news-image-20261120-entry/rank.svg)](https://make.fun/bounty/news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/gaiaoagoaia-art/news-image-20261120-entry/reward.svg)](https://make.fun/bounty/news-image-20261120)

# news-image-20261120-entry

One image that sums up the world's news of **Friday 20 November 2026** — a
broadsheet front page in the EDITORIAL design language: giant date masthead,
the headline story **"MISSILES OVER POLAND"** (Russian missiles crossed into
NATO Poland overnight), a hero map of Poland with missile arcs, the Anthropic
slide (-10% a day after a debut above $2T), Trump waiting on Iran, a UTC
timeline, 10 more numbered stories, a dotted world map with pins, an 11-item
index, a date-check box for older news, and a by-field count. 24 verified
stories, 5 regions, one page. Every story happened, or was first reported,
on 20 November 2026; claims are attributed. Sources: Reuters, AP, NYT, WSJ,
Axios, BBC, Cognoscere. Original drawings.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) draws the 1024x1024 PNG deterministically —
one seeded PRNG, fixed consumption order — and writes it to
`$MAKEFUN_OUTPUT_DIR/entry.png`. Two runs produce byte-identical output.

## License

MIT — see [LICENSE](LICENSE). SPDX-License-Identifier: MIT.
