# Mosslight

A self-contained, 2D woodland squad adventure inspired by Pikmin. Recover three lost lanterns with a crew of tiny leaf creatures and relight your acorn ship before dusk. Pixel sprites, textured woodland paths, soft lighting, and a locally synthesized soundtrack give it a modern retro feel.

Every visible menu, HUD, tooltip, field-guide page, and control is drawn in the Canvas 2D game. It fills the browser window and supports native fullscreen. The only visible HTML element is the canvas.

## Play

Serve this repository with any static HTTP server and open `/mosslight/`. For example, from the repository root:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/mosslight/`. No installation or build step is needed. JavaScript modules require HTTP rather than opening the HTML file directly.

Choose **Venture into the woods** for an eight-minute expedition, or **Take your time** for unlimited exploration. A timed victory records your quickest expedition locally when storage is available.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Move | Click / tap empty ground, or click a destination on the map | WASD / arrow keys |
| Sprint | Double-click ground | Hold Shift while moving |
| Send crew | Click / tap cargo, a bridge, or a beetle; distant tasks automatically bring the captain closer | E: nearest task; Space: send toward the pointer |
| Throw one | Shift + click; hold to throw repeatedly | — |
| Whistle / rescue | Hold right click; touch players have a Whistle button | Hold Q around the captain |
| Choose crew | Click the crew cards; mouse wheel cycles types | 1: Ember, 2: Tide, 3: Honey, 4: everyone; Z / X cycle |
| Pause / resume | In-game pause button | Esc / P |
| Fullscreen | In-game fullscreen button | F; the browser can also exit with Esc |
| Sound | In-game sound button | M |
| Menus | Click / tap in-game buttons | Tab / arrows, then Enter |

The canvas field guide explains controls and tactics. Switching away from the browser pauses the expedition and silences audio.

## Your crew

- **Ember:** fireproof, with stronger attacks. Clear beetles and ember patches.
- **Tide:** can swim across the stream. An entirely Tide carrying team can take cargo through water.
- **Honey:** counts as two carriers. Useful for heavy lanterns and smaller hauling teams.

Walk near sprouts to recruit them. Deliver berries, beetle seed pods, and lanterns to grow new friends at camp. Cargo displays its current carrying strength and the strength it needs. Let a team haul something home while the captain and the remaining squad work elsewhere.

Following friends defend the captain from nearby beetles. Bites have visible warnings and knock down at most three friends. Whistle wilted friends before their thirty-second glow fades. If the squad dwindles, the ship grows reinforcements, so an expedition cannot be permanently stalled by a wipeout.

The fallen-log bridge creates a shortcut across the stream; a southern ford provides an alternative. Three handcrafted lantern locations introduce gathering, building, combat, fireproof crews, and heavy hauling.

## Files

- `world.js`: handcrafted world, terrain rules, and grid navigation.
- `game.js`: simulation, crews, tasks, combat, carrying, and expedition outcomes.
- `render.js`: cached terrain, pixel sprites, camera, effects, and map.
- `ui.js`: all menus and HUD painting, layout, and button hit regions.
- `main.js`: browser input, fullscreen, accessibility labels, and animation loop.
- `audio.js`: synthesized effects and an original generative melody using Web Audio.

No runtime or development dependencies, package manager, CDN, downloaded art, external fonts, network calls, build tools, or tests. The PNG preview is a screenshot of the game, not a runtime asset.

## Manual playthrough

Played the complete timed expedition in the browser and reached the victory screen with all three lanterns restored in **4:07**, with **37 friends** remaining. Also checked recruiting, berry delivery, independent lantern hauling, bridge construction, combat, Ember/Honey selection, map movement, whistle, pause/resume, fullscreen entry/exit, field-guide navigation, and desktop/phone/landscape layouts. Browser logs were clear.

Playtesting exposed and fixed a large-cargo clearance snag around rocks and overly punishing beetle attacks. No test files or test runner were added or run.
