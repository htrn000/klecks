<div align="center">
 <img src="https://bitbof.com/stuff/2022-01-klecks/2026-04-06-logo.png" alt="Klecks" title="Klecks">
</div>

<div align="center">
  Modern and feature-rich painting app for the web
</div>

<div align="center">
  <h3>
    <a href="https://kleki.com">
      Try it out
    </a>
    <span> | </span>
    <a href="https://kleki.com/about/">
      About
    </a>
    <span> | </span>
    <a href="https://blog.kleki.com">
      Dev Blog
    </a>
    <span>
  </h3>
</div>

<p align="center">
<img src="https://bitbof.com/stuff/2022-01-klecks/2026-03-28-klecks-github.png" alt="Klecks"><br>
</p>

Klecks (German for "splash of color", pronounced "clex") is the official open-source release of the free online painting app [Kleki](https://kleki.com).

Klecks can run in standalone mode (e.g. on [kleki.com](https://kleki.com)), or embed (e.g. on [2draw.net](https://2draw.net)) for drawing communities.

## Features
- Layers
- Pen-support with pressure and stabilizer
- Touch gestures
- Brushes: pen, blend, sketchy, pixel, chemy, smudge, eraser
- Tools: selection, paint bucket, text, shapes, gradient
- WebGL-powered filters: blur, tilt-shift, curves, distort, noise.
- Lineart extraction
- Editing tools: transform, warp, crop/expand, resize, perspective
- Supports all major form factors: desktop, tablet and phone
- Multi-language (10+ languages)

---

Created by developer/artist [bitbof](https://bitbof.com)

---

# Commands
- initialize via `npm ci` (requires node and npm to be installed already)
- `npm run icon:build` - generate icon files necessary to run Klecks
- `npm run lang:build` - generate language files necessary to run Klecks
- `npm run lang:build -- --missing` - generate language files and list all keys with a missing translation.
- `npm run start` - dev server (to run `standalone` locally)
- `npm run build` - build `standalone` into `/dist/`
- `npm run build:embed` - build `embed` into `/dist/`

# Embed
Example usage of the embed can be found under: `/examples/embed/`

# Self-hosting with Docker (Tailscale)

Run Klecks and its project store with Docker Compose:

```sh
docker compose up -d --build
```

Open http://localhost:5050. The `klecks-data` named volume stores projects under `/data`; back it up with your
normal Docker volume backup process before upgrades or host maintenance. Upgrade by pulling the desired source
revision and running `docker compose up -d --build` again; the project data volume is retained.

For one-user access on a Tailscale network, keep the default loopback binding and publish the local port to the
tailnet with `tailscale serve --bg 5050`. Alternatively bind directly to a Tailscale interface with
`KLECKS_BIND=<tailscale-ip> docker compose up -d --build`.

There is deliberately no app-level authentication: the intended trust boundary is the private Tailscale network.
Do not expose the port to an untrusted network.

# Contributing

How you can contribute to this project:
- Bug reporting (detailed bug reports that are reproducible)
- Contribute to a translation (see below)
- Give it a star

# Translations
Are you a native speaker or have advanced skills in a language? Any contribution by you is highly encouraged and appreciated!

### Where are translation files?
Translations are located in `src/languages` where each translation is its own JSON5 file, e.g. `de.json5` for German.
Within such a file everything except `value` is to be kept in sync with `_base-en.json5`.

### Structure of a translation file
```json5
{
  // key by which this text is referenced in code
  stabilizer: {
    
    // A hint, further explaining the text
    hint: 'Common feature in drawing software to make lines smoother',
    
    // Original text (English)
    original: 'Stabilizer',
    
    // Translated text
    value: '抖动修正'
  },
  // ...
}
```

### Creating/editing a translation
To **create a new translation** run `npm run lang:add <code>`, which creates `src/languages/<code>.json5`. You find all
(ISO 639-1) language codes in `src/languages/languages.json`. The generated file will already include everything except `value`.
To **edit an existing translation**, simply edit one of the files in `src/languages`. If a language file is out of sync with
`src/languages/_base-en.json5` (English), whatever key is out of sync will be ignored and fall back on English. English is the
source of truth. A translation cannot add new keys without them also being present in `_base-en.json5`.

To **see your changes** in Klecks, run `npm run lang:build`. It needs to be run whenever changes to `src/languages` are
made or it won't be up-to-date. Then build or start Klecks.

A translation should try not to cause additional line-breaks in the UI if possible. Test to make sure translations
fit the context of the application. Note, some texts are only visible in the standalone-version and vice versa with
the embed-version.

### List of commands
- `npm run lang:add <code>` - creates new language file `src/languages/<code>.json5`.
  - See (ISO 639-1) language codes in `src/languages/languages.json`
- `npm run lang:sync <code>` - synchronizes with base file. (TODO)
- `npm run lang:build` - generates JSON & TS files in `src/app/languages`
  - Problems are printed to the command line output

# License

bitbof © 2026 - Released under the MIT License. Icons by bitbof are public domain (excluding the Klecks logo, bitbof logo).
While Kleki and Klecks are jointly developed, Kleki's license is separate from Klecks. Kleki at [kleki.com](https://kleki.com) is free to use, but the name and brand "Kleki" are not covered by this license — you may not use Klecks to offer a service branded or presented as "Kleki" without a license from bitbof.
