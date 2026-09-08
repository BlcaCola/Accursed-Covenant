# Accursed Covenant · 诅咒契约

[简体中文](README.zh_CN.md) · **English**

**Accursed Covenant** is a single-player gothic action RPG prototype combining roguelite runs, survivor-style combat, procedural dungeons, incremental progression, and Diablo-inspired loot. It runs entirely in the browser and can be hosted as a static website without a game server, database, or engine runtime.

> Version **0.15.4** · Playable desktop demo · TypeScript + Phaser 3 + Vite

![Accursed Covenant gameplay](public/screenshots/gameplay.png)

_Current browser demo with its dark isometric, pixel-art-inspired presentation and image-driven gothic interface._

## What's new in 0.15.4

- Rebuilt inventory and equipment as a Diablo-style paper-doll and backpack grid, then fixed its slot geometry and item actions across desktop resolutions. Full item details appear only when the item icon is hovered.
- Restored all three character resources: Elemental Resonance, Soulfire, and Bloodrage. Their compact, frameless, character-colored meters are embedded in the HUD and stay hidden in camp.
- Made every generated room rectangular, enlarged Black Iron Mine rooms, and reveal an entire room as soon as the player enters it.
- Moved Q ultimates to the mouse position, clamped by range, and reduced all boss visuals and collision bodies to 70% of their previous scale.
- Added equipment and coin treasure chests, removed decorative chest reuse, and kept hidden vaults sealed from fog until their wall is broken.

## Highlights

- **Three heroes:** Sorceress, Necromancer, and Blood Knight have unique looks, skills, ultimates, and talent trees. The Sorceress also builds Elemental Resonance for an empowered cast. Equipment, inventory, and currency are shared during the current browser session.
- **Weapon and evolution identities:** Eight weapon types use different ranges, cadences, arcs, projectiles, and combo rules. Every one of the 30 skill evolutions has a matching legendary Covenant.
- **Eight-map expeditions:** each run crosses increasingly dangerous procedural maps with 5–15 main rooms, loops, corridors, hidden vaults, breakable walls, encounters, treasure, and guardian arenas. Map eight ends with a giant three-phase final boss.
- **Fifteen themes:** caves, dungeons, cathedrals, abandoned villages, inferno, mountains, towns, palaces, catacombs, sewers, frozen ruins, swamps, mines, desert temples, and abyssal fortresses have distinct layouts, hazards, encounters, monster pools, and relics.
- **Automatic or manual casting:** the four regular skills can cycle automatically, or be triggered with 1–4 after disabling autocast. Every slot shows its live cooldown. Mouse aim sets cast direction, with out-of-range targets clamped to the farthest valid point. Right-click performs a mana-free basic attack.
- **Thirty skill evolutions:** every regular skill chooses one of two mutually exclusive level-three identities and gains a branch-specific apex effect at level six.
- **Deep loot:** seven quality tiers, item levels, six affix tiers, prefixes and suffixes, eight weapon families that alter attacks, eight equipment slots, sets, uniques, legendaries, Diablo-style hover details and comparisons, animated rarity-colored loot beams, ground labels, and pickup filters.
- **Readable build links:** item tooltips explain each item's affixes, comparison values, weapon mechanics, and current skill and talent synergy.
- **Monster ecology:** 60 animated monster sets form melee lines, ranged pressure, ambushes, tanks, and support groups with healing, shields, resurrection, teleportation, surrounds, and status effects.
- **Long-term progression:** every hero has an independent 18-node talent tree with three six-node branches and three ranks per node. Respecs refund half the invested gold.
- **Camp and events:** progression-aware merchants and smithing, potions, item upgrades, a beggar/traveler investment, cursed chests, blood altars, hunting contracts, and a secret bestiary gallery.
- **Authored presentation:** fixed 2.5D isometric camera, eight-direction actors, wall-foot depth sorting, theme-specific terrain, fog of war, off-screen threat markers, categorized combat numbers, animated portals and effects, experience drops, and Diablo-style red life and blue mana orbs.
- **Chinese and English:** the title screen, HUD, menus, item text, encounters, map names, and combat information switch language at runtime.

## Run locally

Requires Node.js 22.12 or a newer compatible release and npm. Verified with Node.js 22.17.0.

```bash
git clone https://github.com/BlcaCola/Accursed-Covenant.git
cd Accursed-Covenant
git lfs pull
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173/`. Windows users may also run `启动Demo.cmd` after installing dependencies.

The large sprite library is stored with [Git LFS](https://git-lfs.com/). Install Git LFS before cloning, or run `git lfs install` and `git lfs pull` afterward.

## Controls

| Input | Action |
| --- | --- |
| Left mouse button | Click the ground to pathfind and move; enabled by default |
| WASD / Arrow keys | Move in screen direction and cancel the active click route |
| Right mouse button | Perform a mana-free basic attack toward the pointer |
| Mouse pointer | Set cast direction; out-of-range casts stop at maximum range |
| 1–4 | Cast the corresponding regular skill while autocast is disabled |
| Space | Shadow dodge; two charges, independent of mana |
| Q | Hero ultimate; costs 40 mana, 8-second cooldown |
| R | Drink a potion and restore 50% maximum life |
| E | Interact with chests, NPCs, portals, and the Greed altar |
| F | Pick up the nearest eligible item within 190 units |
| I | Open equipment and inventory; combat pauses |
| Esc | Pause, resume, or close the active panel |
| Tab | Expand or collapse the map |
| M | Toggle sound |
| EN / 中 | Switch language immediately |

The autocast switch is available in the pause menu. Corpses remain visible on the ground for a short time, and the Necromancer's Corpse Explosion prioritizes remains near the aimed point.

The current demo targets keyboard-and-mouse desktop play. Full controller, touch, and mobile layouts are not implemented.

## Core systems

### Expedition and encounters

Every run starts at level one. Generation guarantees a connected critical route before adding loops, optional branches, room encounters, environmental props, and an isolated hidden vault. Later floors contain more rooms and denser combat. Key rooms must be purified before the guardian seal opens.

Room encounters include siege, elite, survival, hunt, mechanism, and treasure ambush. Optional cursed chests and hunting contracts continuously spawn reinforcements until success or failure. Reward rooms offer level-matched loot, gold, or recovery.

### Difficulty and Greed

Monster and item levels follow expedition depth and hero level. Greed has 15 ranks and increases monster life, damage, defense, and density while improving item-quality odds. It does not raise monster or item level. Epic and higher qualities remain locked below Greed 10.

### Loot and economy

Equipment has a base type, level, quality, rolled affixes, and possible mechanical effects. Weapon families change attack patterns instead of acting as stat sticks. Merchants generate offers near the current progression band; blacksmiths can match item level or raise quality.

Gold funds purchases, smithing, and hero-specific talents. A complete tree costs 31,860 gold, targeting roughly eight to ten average expeditions for one hero.

### Session-only progress

Progress exists only in memory. Repeated expeditions in the current page retain equipment, inventory, gold, wings, and all three talent trees. Refreshing or closing the page clears everything. The game uses no `localStorage`, `sessionStorage`, IndexedDB, cookies, service worker, account, or cloud save.

## Project structure

```text
src/
├── core/      deterministic combat, dungeons, loot, AI, progression
├── render/    Phaser scene, sprites, effects, terrain, camera, audio
├── ui/        DOM interface, menus, HUD, inventory, debug tools
├── i18n.ts    Chinese and English runtime strings
└── main.ts    application entry and session lifecycle
public/
├── assets/    actors, effects, UI, equipment, and environment art
├── licenses/  third-party notices
└── screenshots/
scripts/       asset normalization and manifest generators
tests/         Vitest logic/simulation and Playwright browser flows
```

The domain layer does not depend on Phaser or the DOM. `Run` advances combat with a fixed 1/60-second step and emits plain state plus one-shot visual events. Seeded gameplay randomness makes maps and drops reproducible in tests.

## Asset conventions

Actors use transparent PNG frames named `{direction}_{action}_{frame}.png`. Directions rotate clockwise: `0` north, `1` north-east, `2` east, `3` south-east, `4` south, `5` south-west, `6` west, and `7` north-west. Actions include `stand`, `run`, `attack`, `skill`, `hit`, and `death`.

After adding or replacing frames, regenerate manifests when needed:

```bash
python scripts/generate-sprite-manifest.py
python scripts/build_effect_manifest.py
```

Actor, environment, and effect assets use separate English-named directories. Ground equipment uses the animated `blue-glow` sequence with a rarity hue, while `frame-effects` remains reserved for equipment-bound presentation.

## Development and tests

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Tests cover deterministic generation, reachability, collision, combat resources, pause behavior, loot, talent economics, NPC flows, eight-map completion, all heroes and themes, hidden rooms, boss phases, animation, localization, session clearing, and production removal of the development bridge.

Development mode exposes a QA panel at `/?qa=1` for levels, gold, Greed, equipment, enemies, bosses, and map progression. It is guarded by `import.meta.env.DEV` and removed from production builds.

## Build and deploy

```bash
npm ci
npm run build
```

Upload the contents of `dist/` to any static host. Relative asset URLs support both a domain root and a subpath such as `/games/accursed-covenant/`. Deployment requires no Node.js process, API, WebSocket, database, or external CDN. Do not launch the production game through a local `file://` URL.

### GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. To publish it:

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy GitHub Pages** manually from the Actions tab.
4. After the workflow succeeds, open `https://blcacola.github.io/Accursed-Covenant/`.

The workflow downloads Git LFS assets, tests the project, builds `dist`, and deploys that directory. Because Vite uses `base: './'`, no repository-name-specific path setting is required.

The current static asset library is roughly 760 MB. This remains below GitHub Pages' 1 GB published-site limit, but it leaves limited headroom and makes the first download heavy. Future asset work should prefer atlas deduplication, WebP/AVIF where appropriate, and loading only the frames used by the current theme.

## Current limitations

- Desktop keyboard and mouse are the supported input method.
- Safari, Firefox, mobile touch, controller input, and long hardware sessions need dedicated validation.
- Balance is suitable for an evolving demo and will continue to change.
- Accounts and cloud saves are planned for a later phase.
- The authored sprite library makes the first complete asset download substantial; runtime loading is staged by character, direction, and effect use.

## Contributing

Issues and pull requests are welcome. Keep gameplay rules in `src/core`, use seeded randomness for gameplay, preserve English asset paths, and run the relevant checks before submitting changes.

## License

Released under the [MIT License](LICENSE). The bundled Cinzel font uses the SIL Open Font License; its notice remains at `public/licenses/Cinzel-OFL.txt`.
