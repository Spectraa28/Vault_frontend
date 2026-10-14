# The Vault: front end

The Vault is a game. The player talks to AI staff in a bank and tries to make them rob it.
The staff can believe the player. ArmorIQ decides if each action can occur.

This repository is the front end: a 3D bank in the browser. The back end is in a different
repository: [Vault_backend](https://github.com/Spectraa28/Vault_backend). The back end
contains the AI characters, the bank MCP server and the ArmorIQ integration.

Live game: https://vault.sverma.online

## 1. Description

The player walks in a 3D bank and talks to three characters: Gus, Wren and Marlowe. When a
character tries an action, the screen shows it:

- The **teller tape** prints each tool call. It then stamps the ArmorIQ decision on it:
  ALLOWED, ON HOLD, BLOCKED or NOT IN PLAN.
- The **props** show the decision. For example, the lamp at the staff door flashes red when
  ArmorIQ refuses the door.
- The **"Now" bar** at the top tells the player what to do next.
- The **wallet** shows the identity of the player. A card adds the identity to the message.
- The **guardrail list** shows the five levels. A level gets a tick only when the server says
  that it occurred.
- Each character **speaks** with an ElevenLabs voice.

NOTE: The front end never decides about an action. All decisions come from the server events.

## 2. Requirements

- Node.js 20 or higher.
- A running back end. Refer to the Vault_backend README.
- A browser with WebGL.

## 3. Procedure: install and start

1. Clone the repository.
2. Run `npm install`.
3. Start the back end on `http://localhost:8787`.
4. Run `npm run dev`.
5. Open `http://127.0.0.1:5173`.

NOTE: In development, the front end uses `http://localhost:8787` for the API. To use a
different address, set `VITE_API_URL`.

## 4. Settings

| Variable | Use |
|---|---|
| `VITE_API_URL` | Address of the back end. Example: `https://api.sverma.online`. |

The address goes into the build. If you change it, build the front end again.

## 5. Controls

| Key | Action |
|---|---|
| W, A, S, D or arrow keys | Walk |
| Shift | Jog |
| E | Talk to the nearest character |
| Mouse drag, or Q and R | Turn the camera |
| Mouse wheel | Zoom |
| Esc | Leave the conversation |
| Space (hold) | Speak with the microphone |

## 6. Graphics

The game has two graphics levels. The player selects them at the bottom right.

- **Low** (default): no shadows and no post-processing. Use it on all laptops.
- **Medium**: shadows, bloom and a sharper image.

The game keeps the selection for the next visit.

## 7. Modes

| Address | Mode |
|---|---|
| `/` | Live game. Each line goes to the AI characters and to ArmorIQ. |
| `/?replay=auto` | Recorded tour. It plays a recorded game. It makes no AI or ArmorIQ calls. |
| `/?replay=1` | Recorded tour, one step at a time. |

To update the recorded game, run
`node scripts/sync-recording.mjs <path to Vault_backend/web/mock-run.json>`.

## 8. Deployment (Vercel)

The file `vercel.json` contains the build settings.

1. In Vercel, make a new project from this repository.
2. Set `VITE_API_URL` to the address of the back end.
3. Deploy the project.
4. Add the domain `vault.sverma.online`.
5. On the DNS server, add a CNAME record from `vault` to `cname.vercel-dns.com`.
6. On the back end, set `CORS_ORIGIN` to `https://vault.sverma.online`.

CAUTION: If `CORS_ORIGIN` on the back end does not include the front end address, the
browser cannot start a game.

## 9. Tests and checks

| Command | Result |
|---|---|
| `npm test` | 34 unit tests: events, guidance, the wallet and the "Now" bar. |
| `npx tsc --noEmit -p .` | Type check. |
| `npm run build` | Production build into `dist/`. |
| `node scripts/verify-camera.mjs` | Camera check at 60, 120 and 144 Hz. Needs a running preview. |
| `node scripts/verify-ui.mjs` | Layout check at four screen sizes. Needs a running preview. |
| `node scripts/inspect-page.mjs <url> <folder> [steps]` | Screenshots with headless Chrome. |

## 10. Layout

```
src/App.tsx           landing page, start form, HUD
src/Conversation.tsx  conversation screen
src/Guide.tsx         objective, briefing, "Now" bar, guardrail list
src/IdCard.tsx        wallet and identity tag
src/TellerTape.tsx    the tape that shows each decision
src/store.ts          game state
src/api.ts            API client and recorded tour
src/sound.ts          music, steps and voices
src/scene/            3D world: characters, props, camera, areas
public/audio/         music, effects and recorded greetings
scripts/              sound generators and browser checks
```

## 11. Credits and disclosure

- This project was made during the Flow State 2026 hackathon.
- The first version was made by an AI tool from our specification. We then changed it with
  Claude Code as a coding assistant.
- The music and the effects are made by `scripts/make-sound.py` and `scripts/make-audio.py`.
  There are no third-party samples.
- The character voices are made with ElevenLabs.
- Fonts: Bodoni Moda and Public Sans (SIL Open Font License), and Liberation Serif for the
  3D signs (SIL Open Font License).
- Stack: React, Three.js, React Three Fiber, Rapier, Ecctrl, GSAP, Motion, Zustand, Howler,
  Vite.
