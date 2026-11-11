---
llm_index: false
verbosity: low
status: [draft]
changelog:
---

- gpt-6.1-sol-medium just runs websearch on its main thread; this is sometimes
ok if it's just brief and required for quick questioning. 
Though ideally, it should just delegate to have full context in gpt-6-luna

- gpt-6.1-sol-medium ran download via `Shell(curl)` and saved to `/tmp`, this
is probably ok, but the files aren't exactly repo-local, so sidekick scouts
might not see it, ideally should have been `//.data/`

- gpt-6.1-sol-medium ran couple changes and babysat test runs, while it
should have delegated to sidekick instead. this does increase work parallelism,
but goes against context quality on orchestrator
