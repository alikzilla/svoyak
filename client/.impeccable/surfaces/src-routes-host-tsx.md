---
version: 1
slug: "src-routes-host-tsx"
primary_target: "src/routes/Host.tsx"
related_targets: ["src/routes/Editor.tsx","src/routes/Games.tsx"]
---

# Workspace surfaces: host, pack editor, evening builder

Scope: `/host` (setup, lobby, live control, final, results), `/editor` (pack list, pack editor), `/games` (evening builder). Mode: Operate. TV (`/board`), phones (`/play`, `/join`), landing and history keep the game world.

Audience/job: the owner hosting friends. At a laptop, arm's length, often a dimmed room with the TV on; guests can glimpse the screen. Jobs: compose a game fast, get guests in, read each question aloud, judge, keep score; write and import packs at a desk.

User decisions (2026-11-02): direction «Билет ведущего»; all three page groups; theme follows system (light default, dark under prefers-color-scheme). Brief: "not like a game, simpler, more intuitive".

## Direction contract

THESIS: The host's side is a quiet desk of question tickets: every question is a ticket with the public part on top and the answer key below a tear line. Refuses the game-board costume (wobble frames, ink shadows, doodles, confetti) and the grey SaaS default.

OWN-WORLD: Cool indigo-tinted paper ground, white sheets with 1px hairline borders and soft low shadows; one Cyrillic grotesk (Onest) at fixed rem steps, tabular figures for prices and scores; brand indigo as the single action/selection colour; amber strip reserved for host-only secrets; green/red only for verdicts; lucide line icons at one stroke.

STORY: The host always sees what is happening now, what to say, and the one next action with its key. The author sees the whole pack as an outline and what is unfinished.

FIRST VIEWPORT: Live screen: top bar (round, room code, turn, pause/undo/sound); left column the current ticket (theme·price, question at 1.5rem, dashed tear line, amber answer key) above a row of primary actions with key hints, then the players table; right column the board as a clean price grid with played cells struck through and the current one ringed in indigo.

FORM: Host's ticket / exam-ticket key strip; position 7 of the grounded list; seed 574367e1. Raises: capacity counters from the cassette j-card (rounds show N of N themes); tabular data density from Datamatics; the item under the eye ringed in one colour from the star atlas; spent state as a single strike from the centre-rail setting.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
