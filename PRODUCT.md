# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Свояк is built for one company: the owner hosts «Своя игра» evenings for their own friends and family. Nobody outside that circle is a target user, and there are no plans to give it to strangers.

- **Host**: the owner, at a laptop. Picks packs, reads every question aloud, opens the buzzer, judges answers and steers the evening. Often the same person who writes or imports the questions in the editor.
- **Players**: guests in the room, each on their own phone. They join by QR code in seconds, with no install and no account, and mostly press one button, then type answers in the final.
- **Shared screen**: a living-room TV showing the board, questions, answers and scores. Nobody operates it; people read it from the sofa.

## Product Purpose

Run a home quiz evening in the «Своя игра» format, with the host in charge and guests playing on their own phones. All game logic lives on the server, so a phone only needs to buzz and type. Success means the evening flows: guests get in without help, nobody argues about who pressed first, the host never loses track or control, and everyone can read the TV.

## Positioning

**Open decision.** The owner hasn't settled what sets this apart from SIGame, Kahoot or a paper board, and future work must not claim a position for them. Strengths visible in the code, recorded as observations only:

- The host sets the pace: no reading or answering timers, and the host opens the buzzer.
- The buzzer is fair: presses carry client timestamps with latency correction, so the earliest press wins, not the fastest connection.
- It runs offline on a LAN, with local fonts, synthesized sounds and local media.
- Packs are the owner's own: an editor, JSON and SIGame `.siq` import, and evenings built from several packs.

## Operating Context

- Played at home, everyone in one room. The host's laptop runs `npm run dev`, and phones on the same Wi‑Fi open the join link from a QR code. A tunnel is the fallback when the router isolates clients.
- The host's laptop screen may be seen by guests. Answers on it stay hidden or deliberately revealed: the cheat sheet is collapsed by default.
- The TV is viewed from across the room, so legibility at distance outranks density.
- Guests talk out loud. Spoken answers, banter and the host's judgement are part of the game, and the app supports them rather than replacing them.
- Roles have fixed routes: `/host`, `/join` → `/play`, `/board`, `/editor`, `/games`, and `/style` (the live style guide).

## Capabilities and Constraints

- **Russian-only UI.** All copy is in Russian; no i18n is planned.
- **Guests' own phones.** It must work on any phone the guests bring, including older Android phones and iPhones, joined by QR with no install. iOS Safari has no `navigator.vibrate`, so sound covers for haptics there.
- **TV across the room.** The board screen fits the TV viewport with no scrolling, and its text must read from a sofa.
- **Host screen is semi-public.** Anything shown on `/host` may be seen by players. Secrets (answers, the cheat sheet) are hidden by default or clearly marked as host-only.
- **Server is authoritative.** Each role receives a projection of the game state, so answers and other players' bets never reach a player's data.
- **Survives reloads and restarts.** Rooms autosave. Sessions are stored per role in `localStorage` and restore after a reload.
- **Offline-capable.** No external services at runtime: no CDN fonts, no remote sounds, no analytics.
- Game mechanics and their terms (кот в мешке, аукцион, модификаторы, финал, фальстарт, право хода) are defined in `README.md`, which is the source of truth for rules.

## Brand Commitments

- Name: **Свояк**. Tagline in use: «Своя игра для своей компании».
- Each player's avatar is generated from their name and keeps the same face and colour on every screen.

## Evidence on Hand

- Real packs in `data/packs/`: «Алматы и Астана» and the «Коваль #1–#5» series. Their media lives in `uploads/<pack>/`.
- There are no testimonials, user counts or press, and future work must not invent any.

## Product Principles

1. **The host leads, the app assists.** Don't automate away the host's pace or judgement.
2. **Zero friction for guests.** Scan, type a name, play. Any extra step on a phone is a cost paid by every guest, every evening.
3. **Every screen fits its distance.** The phone is used up close and in a hurry, the host laptop at arm's length, the TV from across the room.
4. **Fair and trusted.** Who pressed first and what the score is must never be in doubt.
5. **Never strand the evening.** Reloads, dropped Wi‑Fi and a restarted server shouldn't end the game.

## Accessibility & Inclusion

- Respect `prefers-reduced-motion`. A calm mode on `/style` keeps only fades.
- Text on the TV and phones must keep readable contrast, and colour must never be the only signal (verdicts also carry words and stamps).
