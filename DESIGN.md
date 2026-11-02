---
name: Свояк
description: Своя игра для своей компании — нарисована маркером на кухонной доске.
colors:
  scene-indigo: "#4a3aa8"
  scene-ink: "#f6f1ff"
  final-night: "#1a1140"
  night: "#131c3f"
  night-glow: "#2b3a7d"
  card-cream: "#fff6e9"
  paper-white: "#fffdf7"
  played-kraft: "#d8cdb8"
  marker-ink: "#1a1a1a"
  pencil-brown: "#5b524b"
  grape: "#8b5cff"
  grape-ink: "#7a4aee"
  coral: "#ff6b57"
  teal: "#12beb0"
  sticky-yellow: "#ffc53d"
  lime: "#93d93a"
  bubblegum: "#ff5fa2"
  verdict-green: "#2ebd59"
  verdict-green-ink: "#16793a"
  verdict-red: "#e23b3b"
  verdict-red-ink: "#d12626"
  stamp-red: "#c2493c"
  medal-gold: "#f2a93b"
  ws-paper: "#f3f3f8"
  ws-sheet: "#ffffff"
  ws-sunken: "#ececf3"
  ws-line: "#e2e1eb"
  ws-line-strong: "#b9b6ca"
  ws-ink: "#16141f"
  ws-ink-soft: "#545168"
  ws-ink-faint: "#6f6c84"
  ws-accent-soft: "#ecebfa"
  ws-accent-ink: "#3b2e95"
  ws-key: "#fff4d3"
  ws-key-line: "#ecd07c"
  ws-key-ink: "#6f4b00"
  ws-yes: "#1d7a42"
  ws-yes-soft: "#e2f3e8"
  ws-no: "#c42f2d"
  ws-no-soft: "#fbe8e7"
  ws-warn-soft: "#fdf0d9"
  ws-warn-ink: "#855000"
typography:
  display:
    fontFamily: "'Unbounded Variable', system-ui, sans-serif"
    fontSize: "clamp(3rem, 12vw, 5.5rem)"
    fontWeight: 900
    lineHeight: 1
  headline:
    fontFamily: "'Unbounded Variable', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1.1
  title:
    fontFamily: "'Unbounded Variable', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 900
    lineHeight: 1.25
  question:
    fontFamily: "'Nunito Variable', system-ui, sans-serif"
    fontSize: "clamp(1.5rem, min(4vw, 6.5dvh), 3.5rem)"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "'Nunito Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: "'Nunito Variable', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.25
  hand:
    fontFamily: "'Caveat Variable', 'Comic Sans MS', cursive"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.1
  ws-title:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.2
  ws-ticket:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.35
  ws-section:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  ws-body:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  ws-ui:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
  ws-small:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  ws-meta:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  ws-label:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  ws-kbd:
    fontFamily: "'Onest Variable', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  ws-kbd: "0.3125rem"
  ws-seg-item: "0.4375rem"
  sm: "0.5rem"
  ws-seg: "0.625rem"
  field: "0.75rem"
  btn: "0.875rem"
  card: "1rem"
  panel: "1.5rem"
  pill: "9999px"
  ws-card: "0.75rem"
  ws-ticket: "0.875rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-doodle-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.hand}"
    rounded: "{rounded.panel}"
    padding: "1rem 2rem"
  button-doodle-confirm:
    backgroundColor: "{colors.verdict-green}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.hand}"
    rounded: "{rounded.card}"
    padding: "0.75rem 1.5rem"
  button-doodle-reject:
    backgroundColor: "{colors.verdict-red}"
    textColor: "#ffffff"
    typography: "{typography.hand}"
    rounded: "{rounded.card}"
    padding: "0.75rem 1.5rem"
  button-tool:
    backgroundColor: "{colors.card-cream}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.btn}"
    padding: "0.4rem 0.85rem"
    height: "2.5rem"
  button-tool-danger:
    backgroundColor: "{colors.verdict-red}"
    textColor: "{colors.card-cream}"
    rounded: "{rounded.btn}"
    padding: "0.4rem 0.85rem"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.field}"
    padding: "0.45rem 0.75rem"
    height: "2.5rem"
  card-paper:
    backgroundColor: "{colors.card-cream}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.panel}"
    padding: "1rem 1.25rem"
  theme-header:
    backgroundColor: "{colors.grape}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: "0.5rem 0.75rem"
  price-cell:
    backgroundColor: "{colors.card-cream}"
    textColor: "{colors.grape}"
    typography: "{typography.headline}"
    height: "6rem"
---

# Design System: Свояк

## Overview

**Creative North Star: "Marker on the fridge"**

Свояк looks like a game board someone drew for tonight: a thick black marker on cream paper cut-outs, stuck to a deep indigo wall with sticky-note colours. Every surface carries the same handmade signal. Outlines are heavy and slightly wobbly (Rough.js frames), and shadows are hard ink offsets, never soft blur. The cast of characters is generated from players' names. It is homemade on purpose, made by a friend for friends, and it should never read as a polished SaaS product or a slick TV studio.

The volume follows the evening. Most of the time the interface is a calm stack of legible paper cards: the host managing the board, players waiting, the editor at work. The noise is saved for the peaks: the buzzer, the verdict stamp slapping onto the screen, the round intro, confetti at victory. Quiet screens earn the loud moments.

Every control is a toy you can press. Buttons are chunky, outlined in ink, and sit on a hard shadow they physically sink into when pressed. One system covers three viewing distances: a phone held close and used in a hurry, a host laptop at arm's length, and a TV read from the sofa.

**Two worlds.** Everything above describes the game: the TV board, the players' phones, the landing page, the hall of fame and the rules deck. The host's working screens (`/host` setup, lobby, live control and final; `/editor`; `/games`) are a separate, quiet world — "The host's desk", below. They are tools, not part of the show, and they never borrow the marker, the wobble or the ink shadows.

**Key Characteristics:**
- Deep indigo scene with faint speckle and drifting outline doodles; light paper cards on top.
- 4px ink outlines and hard offset ink shadows (3–10px, zero blur) on everything that matters.
- Hand-drawn Rough.js frames and crosses for the board and big moments.
- Unbounded Black for anything you read at a glance; Nunito Bold for anything you read in full; Caveat for the hand-lettered buttons and stamps.
- Six player colours that follow each person across every screen.
- Motion is springy and physical, and it lives at the peaks.

## Colors

A saturated party palette on a dark-indigo wall. Colour marks who and what, while ink and cream carry the reading.

### Primary
- **Scene Indigo** (scene-indigo): the wall behind everything. Every screen's background, faintly speckled. Text placed directly on it uses Scene Lilac, never ink.
- **Grape** (grape): the board's voice. Fills theme headers and prices on the price cells, and is player 1's colour.

### Secondary
- **Lime** (lime): the "go" colour. The main action on a screen («Играть», «Создать комнату», «Начать игру»), and player 5.
- **Sticky Yellow** (sticky-yellow): attention and "you have the move". The active player's row and card, the host's private answer slip, the "Открыть" buttons, and player 4.

### Tertiary
- **Coral** (coral), **Teal** (teal), **Bubblegum** (bubblegum): player colours 2, 3 and 6. Teal also marks a selected pack. On the landing page each role card takes one player colour.
- **Verdict Green** (verdict-green) and **Verdict Red** (verdict-red): correct and wrong only. They appear on the judge buttons, revealed answers, final reveals and the buzzer's open/locked states.
- **Medal Gold** (medal-gold): focus rings on the scene, and podium and victory accents.

### Neutral
- **Marker Ink** (marker-ink): every outline, every hard shadow, and all text on paper.
- **Card Cream** (card-cream): the paper of cards, panels, cells and quiet buttons.
- **Paper White** (paper-white): input fields only, one shade lighter than the card so a field reads as a recess.
- **Pencil Brown** (pencil-brown): secondary text on cream (`.text-soft` inside `.on-paper`).
- **Scene Lilac** (scene-ink): text directly on the indigo scene. Secondary text on the scene uses it at 78% via `.text-soft` inside `.on-scene`.
- **Played Kraft** (played-kraft) with **Stamp Red** (stamp-red): a played price cell, kraft paper crossed out by hand in red.
- **Final Night** (final-night): the scene darkens to this for the final round and results, so the room itself feels the ending.

### Named Rules
**The Ink-Variant Rule.** Fill colours are for fills. Text in a player or verdict colour on cream must use its `-ink` variant: grape-ink (4.85:1), verdict-red-ink (4.88:1), verdict-green-ink (5.1:1). Plain green on cream is 2.3:1 and unreadable from a sofa.

**The Ink-on-Green Rule.** Labels on Verdict Green are Marker Ink, never white. White on green is 2.6:1; ink is about 8:1.

**The Surface-Decides-Text Rule.** Secondary text gets its colour from the surface it sits on, never from a hard-coded `ink/60`. Wrap screens in `.on-scene` and cards in `.on-paper`, then use `.text-soft`. Ink at 60% on indigo was 1.6:1.

**The Follow-the-Player Rule.** A player's colour is assigned once by join order (`colorForIndex`) and used for their avatar, score, frame and confetti on every screen. Never recolour a player for decoration.

## Typography

**Display Font:** Unbounded Variable (with system-ui)
**Body Font:** Nunito Variable (with system-ui)
**Hand Font:** Caveat Variable (with Comic Sans MS, cursive)

**Character:** Unbounded Black is the marker block-capital: wide, heavy, readable across a room. Nunito Bold is the friendly round hand for full sentences. Caveat is the scribble on the button, used sparingly so it stays charming. Fonts are installed locally through npm, never loaded from Google Fonts, because the game must work offline.

### Hierarchy
- **Display** (900, clamp(3rem, 12vw, 5.5rem), lh 1): the «Свояк» logotype, room codes, scene titles. Cream fill with a 4–6px ink stroke (`-webkit-text-stroke` plus `paint-order: stroke fill`), tilted about −2°.
- **Headline** (900, 2.25rem): page titles («Новая игра», «Редактор паков», «Игры»), cream with a 3–4px ink stroke on the scene. Price-cell numbers use the same weight at 1.875–3rem.
- **Title** (900, 1.25rem): card titles, pack and game names, player names, theme headers.
- **Question** (700 Nunito, clamp(1.5rem, min(4vw, 6.5dvh), 3.5rem), lh 1.25, `text-pretty`): question text on the TV. It scales with height as well as width so it always fits the screen. The host reads the same text at 1.5rem (700).
- **Body** (700, 1rem): descriptions, hints, player-phone instructions. The product's body text is bold Nunito, not regular.
- **Label** (700, 0.75–0.875rem): field captions, meta lines («3 раунда · 76 вопросов»), chips. Lowercase Russian, never uppercase-tracked.
- **Hand** (700 Caveat, 1.125–3rem by button size): DoodleButton labels and verdict stamps (3.75rem) only.

### Named Rules
**The Two-Voices Rule.** Unbounded is for what you glance at, Nunito for what you read. Never set a full sentence or a question in Unbounded, and never set a score or room code in Nunito.

**The Stroke-on-Scene Rule.** Large display text placed directly on the indigo scene is cream with an ink stroke. Display text inside a cream card is ink or a player colour, with no cream fill.

## Layout

Single centred column, generous gutters. Screens sit in a centred container (`max-w-md` for the landing page and join form, `max-w-4xl` for lists, `max-w-5xl` for host setup, the lobby and the pack editor) with a 1.5rem gutter. The TV board uses 2rem.

- **Phone screens are viewport-locked** (`.screen-lock`): exactly the visible viewport minus safe areas, with no page scroll. The buzzer and the action are always on screen, and a long question shrinks instead of pushing the button away.
- **The TV board is viewport-locked too.** Board rows share the available height (up to 7.5rem each) and the score strip is always visible. Nothing on the TV scrolls.
- **Host and editor pages scroll normally** (`.app-shell`, min-height only). The page's main action sits in a sticky footer when settings could push it below the fold.
- **Host game** is two columns from `xl` (1280px): the question panel and player ledger on the left, the board on the right. Below that it stacks.
- **Responsive grids** start from `grid-cols-1` (`minmax(0,1fr)`) and add columns at `sm` (640px) and `lg` (1024px). A bare `grid` with an auto track expands to fit long pack titles and scrolls the phone sideways.
- **Rhythm:** gaps of 0.5rem inside a group, 0.75–1rem between siblings, 1.25–1.5rem between sections.

### Named Rules
**The No-Scroll Screens Rule.** Phones and the TV never scroll. If content doesn't fit, it shrinks (clamp with `dvh`) or moves to another step; it never scrolls away.

## Elevation & Depth

Depth comes from hard ink offsets, never blur. Each card or button sits on a solid Marker Ink shadow offset down and to the right, as if cut from paper and stuck on the wall. Bigger offsets mean more important or closer.

### Shadow Vocabulary
- **Pinned** (`box-shadow: 3px 3px 0 #1a1a1a`): small chips, inactive pack tiles, other players' pills on the phone.
- **Stuck** (`box-shadow: 4px 4px 0 #1a1a1a` to `5px 5px 0 #1a1a1a`): standard cards, inputs, tool buttons, theme headers.
- **Lifted** (`box-shadow: 6px 6px 0 #1a1a1a`): primary DoodleButtons at rest, landing role cards, player cards on the TV.
- **Raised** (`box-shadow: 8px 8px 0 #1a1a1a`): the QR card on the TV, big lobby frames. Grows to `9px 10px` on hover.
- **Pressed** (`box-shadow: 0 0 0 #1a1a1a`, translated by the old offset): the button has sunk into its own shadow.
- **Ghost** (`box-shadow: 8px 8px 0 rgb(26 26 26 / 25%)`) and **Soft-on-scene** (`3px 3px 0 rgb(0 0 0 / 28%)`): the verdict stamp, and quiet buttons placed directly on indigo.

### Named Rules
**The Zero-Blur Rule.** No shadow in Свояк has a blur radius. A soft `0 4px 24px` glow breaks the paper illusion immediately.

**The Sink-on-Press Rule.** Hover lifts (translate about −1px/−4px, shadow grows). Press translates by the full shadow offset and the shadow drops to zero, so the button lands in its own shadow.

## Shapes

Rounded rectangles with a heavy ink outline and a hand-wobbled edge where it matters.

- **Outline:** 4px solid Marker Ink (`.ink-border`) on cards, inputs and buttons. 3px dashed for "add another" actions. The verdict stamp's border is 7px.
- **Corners:** softly rounded, never sharp and never fully pill except avatars and status dots. Fields 0.75rem, tool buttons 0.875rem, small cards and doodle buttons 1rem, panels and list rows 1.5rem, xl doodle buttons 2rem.
- **Hand-drawn frames:** the board's price cells, question cards, room-code frames and the join card are drawn with Rough.js (`RoughFrame`, roughness 1.8, bowing 1.4, 3px stroke) with a fixed `seed`, so the wobble stays put between renders. A played cell gets a hand-drawn red `RoughCross`.
- **Tilt:** primary buttons and the logotype sit at about ±1–2°. Price cells alternate −1.1° and +1.1°. Nothing sits perfectly square on the TV.
- **Doodles:** the scene background carries outline-only SVG doodles (star, spiral, question mark, squiggle, bolt, ring, crown…), drawn by hand and never from an icon library.

## Components

### Buttons
Chunky and pressable, like toy buttons.

- **DoodleButton (primary actions):** Caveat Bold label, 4px ink outline, Lifted shadow, a few degrees of tilt. Tones: lime for "go", grape, sticky yellow, cream ("paper") for secondary, green and red for verdicts. Sizes sm/md/lg/xl step the padding (0.5rem×1rem up to 1.5rem×2.5rem) and label size (1.125rem up to 3rem). The screen's main button may sway gently (`idle`) once it is enabled. Pass `type="submit"` inside forms so Enter and the phone keyboard's "Go" work.
- **Tool button (`.btn`):** the dense editor and list version. Unbounded or Nunito, 4px outline, 4px Stuck shadow, 2.5rem minimum height. Variants: `.btn-quiet` (translucent cream chip with a lilac outline for use on the scene), `.btn-dashed` (dashed outline for "add another"), `.btn-danger` (red fill, cream text), `.btn-grip` (bare drag handle, `cursor: grab`).
- **Hover / Focus:** hover lifts and grows the shadow. Focus is a 3px gold outline offset by 3px on the scene, switching to an ink outline inside `.on-paper` cards.
- **Disabled:** 45% opacity, half saturation, `not-allowed` cursor. Its shadow shrinks to Pinned.
- **Confirm-then-destroy:** "Удалить" swaps in place for «Удалить насовсем» (danger) plus «Отмена». No modal.

### Cards / Containers
- **Corner Style:** 1.5rem for list rows and panels, 1rem for small cards.
- **Background:** Card Cream, with Sticky Yellow for the active player.
- **Shadow Strategy:** Stuck (5px) by default. See Elevation & Depth.
- **Border:** 4px Marker Ink, or a Rough.js frame on game surfaces.
- **Internal Padding:** 1rem × 1.25rem for rows, 1.25–2.5rem for question cards.

### Inputs / Fields
- **Style:** Paper White fill, 4px ink outline, 0.75rem corners, 2.5rem minimum height. Join-screen fields are oversized: centred Unbounded text at 1.5–2.25rem.
- **Hover / Focus:** the outline shifts to Grape on hover. Focus uses the global focus ring.
- **Bare title field (`.field-bare`):** looks like a heading until hovered. Give it a minimum width (`min-w-40`/`min-w-48`) inside wrapping rows so it never collapses to three letters.

### Chips
- **Status chips** in the host ledger: small filled tags. Green with ink text for «отвечает», red with white text for «фальстарт», plain text for «ход».
- **Notices (`.notice`):** a cream slip with an ink outline and Stuck shadow. `.notice-error` swaps in a red outline and dark-red bold text. Errors never sit as red text directly on indigo (2:1). Information that isn't an error (such as an old room having closed) uses a plain `.notice`, not red.

### Navigation
Role routes rather than a nav bar. The landing page is a stack of five role cards, each a player colour, with an Unbounded title and a Nunito hint. Inner pages use a quiet back button («← Паки», «← Игры») or an underlined «на главную» text link.

### Board (signature)
The game's centrepiece: grape theme headers pinned to the first column, followed by tilted Rough.js price cells. The column count is set by the longest theme; shorter themes leave empty slots and never borrow the next theme's cells. The TV variant widens the theme column (1.8fr, about 1.75rem titles) and lets rows share the screen's height.

### Avatar (signature)
A hand-drawn face generated from the player's name (head shape, eyes, mouth, hair) in their player colour, with moods such as `idle` and `answering`. It is the same person on every screen.

### Verdict Stamp & Revealed Answer (signature)
"ВЕРНО!" or "МИМО!" in Caveat at 3.75rem, inside a 7px coloured border, slapped on with a spring (scale 2.2 → 1, settling at −8°). On the TV the revealed answer is a filled Verdict Green slab with ink Unbounded text, never green text on cream.

### Big Buzzer (signature)
The phone's buzzer fills the space below the question: one huge rounded slab whose colour is the state: Verdict Green when open («ЖМИ»), Verdict Red during a false-start lock, the player's own colour when they're answering, and muted lavender (`#6a5fb8`) while closed, with a countdown to opening. Its label is cream Unbounded with an ink stroke. It stays pressable while closed, because an early press is a false start for the server to judge.

### Buzz Countdown (TV)
While the buzzer is open, four bars frame the question card on the TV: one per side, stopping short of the corners. Each is an ink-outlined pill on a dark groove, filled Verdict Green (the same green as the phone's «ЖМИ»), and shrinks from both ends towards its own middle. In the last 3 seconds the fill turns Verdict Red and pulses (no pulse under reduced motion or on pause). The space around the card is reserved for the whole question, so the card never shifts when the buzzer opens. After a wrong answer the bars resume from the question's remaining budget instead of refilling.

### Rules Deck (signature)
«Как играть», opened from the TV lobby. Eight slides authored on a fixed 1920×1080 stage that scales as a whole and letterboxes on any screen, so slide type is set in stage pixels (112px titles, 48px leads), deliberately outside the app's type ramp. It reuses the game's own pieces (Rough.js cards, avatars, doodles, verdict lettering). Content is visible from the first frame: motion only slides elements into place and never fades them in from nothing. Host controls (close, back, page count, next) sit outside the stage.

## Workspace: the host's desk

**North Star: "The host's ticket."** The host's side is a quiet desk of question tickets. Every question is a ticket: the public part on top, a dashed tear line with half-circle notches at both edges, and below it the answer key on an amber strip marked «видите только вы». The same ticket appears where a question is written (the pack editor) and where it is read aloud (the live screen), so the host recognises it instantly.

Scope: `client/src/workspace/` (tokens in `workspace.css`, `Shell`, primitives in `ui.tsx`), `routes/Host.tsx`, `routes/Editor.tsx`, `routes/Games.tsx`, `ui/host/*`, `ui/PlayerLedger.tsx`, `ui/Standings.tsx`, `ui/Timer.tsx`, `editor/*`, `games/*`. Every rule lives under the `.ws` class, so nothing leaks into game screens.

### Palette and theme
- **Restrained.** Indigo-tinted paper ground (ws-paper), white sheets (ws-sheet) with 1px hairlines (ws-line), ink text (ws-ink, ws-ink-soft, ws-ink-faint — all ≥4.5:1 on white).
- **One accent: Scene Indigo** (`#4a3aa8`, 8.6:1 on white) — the same indigo as the TV wall, the one thread between desk and game. It marks the primary action, the selection, the player with the move and the current cell.
- **Amber is for secrets only** (ws-key, ws-key-ink): answers, the answer key strip, the cheat sheet. Never decoration.
- **Green and red are verdicts only** (ws-yes, ws-no): the judge buttons, score deltas, «готов к игре» / errors.
- **Theme: light, dark or «как в системе».** The sun/moon/monitor menu at the right of every workspace top bar (`workspace/ThemeMenu.tsx`) sets it; the choice lives in `localStorage` (`svoyak:theme`, absent = system). The resolved theme is `data-theme="light|dark"` on `<html>`, set by an inline script in `index.html` before first paint (no white flash) and kept in step with the OS by `workspace/theme.ts` while «как в системе» is on. One dark block, `:root[data-theme='dark']`, swaps every `--ws-*` token (dark paper `#111018`, lighter indigo `#6a5bdf` fill and `#b5abff` text, dark amber strip); components only ever use tokens. Game screens ignore the attribute.
- Player colours and generated avatars still follow each player here (brand commitment); they are the only game element on the desk.

### Typography
One family: **Onest Variable**, installed locally (`@fontsource-variable/onest`, loaded only in workspace chunks). Fixed rem steps, no fluid sizes: page title 1.625rem/600, ticket question 1.5rem/500, round heading 1.25rem/600, body 1rem, UI 0.9375rem/500, small 0.875rem, meta 0.8125rem, label 0.75rem/600. Prices, scores, codes and counts use tabular figures (`.num`).

### Shape and depth
- Radii: kbd 0.3125rem, segment 0.4375rem, controls 0.5rem, segmented track 0.625rem, cards 0.75rem, tickets 0.875rem.
- Soft, low shadows with blur (`--ws-shadow-1` for controls and cards, `--ws-shadow-2` for the ticket). **No hard offset shadows and no 4px outlines in the workspace.**
- Tickets and theme cards use `overflow: clip`, never `hidden`: the tear notches stick out past the edge, and `hidden` let focus scroll the ticket sideways.

### Components
- **One container for every workspace page.** `Shell` has no width option: setup, lobby, live game, packs, pack editor and games all sit in the same `max-w-7xl` column (1.5rem gutter), and the top bar uses the same column, so switching tabs never moves an edge.
- **Shell:** sticky top bar — «Свояк», tabs Ведущий / Паки / Игры, status on the right. During a game the tabs give way to the round, «раунд N из M» and the room code; pause, undo, sound and the shortcuts popover sit on the right.
- **Buttons (`.ws-btn`):** secondary (white, hairline), `-primary` (indigo), `-yes` / `-no` (verdicts), `-ghost`, `-quiet-danger`; sizes `-sm`, default, `-lg`, `-xl` (the host's main moves, 3.25rem tall). Primary moves carry their key (`.ws-kbd`: Пробел, +, −), hidden below `lg` where there is no keyboard.
- **Fields:** `.ws-input` (1px, indigo focus ring), `.ws-input-bare` for editable headings, `.ws-switch` for on/off settings, `.ws-check` + `.ws-option` rows for picking packs and games (selected rows tint accent-soft).
- **Segmented control (`.ws-seg`):** pace presets, question type, game source.
- **Ticket (`.ws-ticket` + `.ws-tear` + `.ws-key`):** see North Star. Live screen: theme · price badge · timer, the question, the key, then a one-line instruction for the current phase and the actions for it.
- **Board (`ui/host/HostBoard.tsx`):** themes as rows, prices as buttons. Played cells are struck through once; the question in play is ringed in indigo.
- **Players (`PlayerLedger`):** a list in a card; the verdict shows as a «+300» / «−300» delta and a brief green/red row tint (the stamp and confetti stay on the TV).
- **Pack editor:** a sticky outline of rounds and themes on the left (red dot = unfilled questions); questions collapse to price · question · answer rows and open into the ticket in place.
- **Destructive actions:** `ConfirmDelete` — a quiet button that turns into «Удалить насовсем» + «Отмена» in place. No modals.
- **Empty states** explain what will appear and how (`EmptyState`); loading uses skeleton blocks, not spinners in content.

### Named rules
**The Desk-Is-Not-The-Show Rule.** No Rough.js, doodles, Caveat, Unbounded, hard shadows or confetti on workspace screens. Feedback is a state change in place.

**The One-Next-Move Rule.** At every phase the live screen says in plain words what is happening and offers one primary action with its key; everything else is secondary or ghost.

**The Min-Width Rule.** Workspace containers reset `min-inline-size` to 0 (in `workspace.css`). Without it a long question in a truncated row widens the page sideways.

## Do's and Don'ts

### Do:
- **Do** wrap every screen in `.on-scene` and every card in `.on-paper`, and use `.text-soft` for secondary text.
- **Do** give every important game surface a 4px Marker Ink outline and a hard ink shadow from the Shadow Vocabulary (workspace screens excepted — see "The host's desk").
- **Do** use the `-ink` colour variants for coloured text on cream, and Marker Ink for labels on Verdict Green.
- **Do** keep phones and the TV viewport-locked, and size TV text with `clamp(…, min(vw, dvh), …)`.
- **Do** start mobile grids at `grid-cols-1` and give flexible titles a minimum width so buttons wrap below them.
- **Do** save springs, stamps, confetti and idle sway for peak moments (buzz, verdict, round intro, victory) and for the screen's one main button.
- **Do** honour `prefers-reduced-motion` and the `.calm` mode, which keep only fades.

### Don't:
- **Don't** use blurred shadows, gradients on cards, glassmorphism or thin 1px borders. They break the paper-and-marker illusion.
- **Don't** put Marker Ink text directly on Scene Indigo, or the old dark-theme tokens (`bg-surface`, `bg-surface-2`, `border-line`, `text-muted`, `bg-good`, `bg-bad`, `text-bg`) anywhere. They are leftovers from before the hand-drawn theme. `--color-ink` now resolves to near-black, so `text-ink` on `bg-surface` is about 1.2:1.
- **Don't** write unlayered global element rules (`button { … }`). They override every Tailwind utility. Global rules go in `@layer base` with `:where()`.
- **Don't** animate text the host has to read aloud. A question must be fully visible the moment it opens.
- **Don't** pull fonts, icons or sounds from a CDN. Everything ships locally.
- **Don't** use a stock icon set on game screens. Icons and doodles there are hand-drawn SVG paths in `design/Doodles.tsx`. The workspace uses `lucide-react` line icons at one stroke, bundled locally.
- **Don't** set sentences in Unbounded or numbers in Nunito.

### Known drift (to fix)
- `ui/Buzzer.tsx` and `ui/Screen.tsx` are no longer imported anywhere and can be deleted, along with the dark-theme block in `index.css` once nothing else depends on it.
