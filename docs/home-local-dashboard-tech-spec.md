# Home Local Dashboard — Build Handoff Spec

> **For the building agent:** This is a greenfield project. Do **not** modify the Agora pricing calculator files in this repo (`index.html`, `script.js`, `style.css`, `README.md`). Create a **new project directory** (recommended: `home-dashboard/`) or a separate repo. Implement phase by phase. Prefer working vertical slices over a big-bang rewrite.

**Goal:** A local Mac-hosted website that shows and controls the user’s existing Apple Home (60+ devices already room-organized in HomeKit / Homebridge) **plus** non-HomeKit systems: Ring live cameras, Rachio water valve, Sonos, and Google Nest — without re-pairing HomeKit accessories into Home Assistant.

**Architecture:** One browser UI → one local backend API on the Mac → pluggable adapters (HomeKit bridge process, Ring, Nest SDM, Rachio, Sonos). Secrets stay on the server. Cameras open live views on click (WebRTC).

**Tech stack (recommended):**
- **UI:** Vite + React + TypeScript (or Next.js if you prefer one process); keep UI simple and fast on LAN/mobile Safari
- **API:** Node.js (Fastify or Express) + TypeScript **or** Python (FastAPI) — pick one and stick to it
- **HomeKit bridge:** Separate Mac Catalyst / Swift app with HomeKit entitlement (or reuse Homecast / Prefab / Casa / HomeClaw as the HomeKit data plane and proxy through your API)
- **Realtime:** WebSocket or SSE from API → browser for state changes
- **Secrets:** `.env` + macOS Keychain optional; never ship tokens to the browser
- **Deploy target:** Always-on process on the user’s Mac (`launchd`), bind `127.0.0.1` by default; optional LAN bind behind a simple shared secret

---

## 1. Product requirements

### 1.1 Must have
1. **HomeKit rooms + accessories** as already configured in the Apple Home app (Hue lights, Kasa plugs, Dreo/Hunter fans, Homebridge-exposed devices, scenes if easy).
2. Read state + basic control (on/off, brightness, fan speed where characteristics exist).
3. **Ring cameras:** list devices; **click → live view** in the page (WebRTC).
4. **Rachio:** show valve/hub status; start/stop watering with duration.
5. **Sonos:** discover speakers on LAN; play/pause, volume, now-playing, optional grouping.
6. **Google Nest via official SDM API** (not Homebridge Nest plugins): thermostats + camera live view where supported.
7. Single cohesive local website (one origin), mobile-usable on phone on the same LAN.
8. Clear offline / auth-error states per adapter (HomeKit up but Nest down should not blank the whole UI).

### 1.2 Explicit non-goals (v1)
- Do **not** migrate or re-pair the 60+ HomeKit devices into Home Assistant.
- Do **not** rely on Homebridge Nest plugins (user already confirmed they are broken for them).
- Do **not** expect HomePods / Apple TVs via public HomeKit API (omit or mark unsupported).
- Do **not** build cloud hosting; this is Mac-local first.
- Do **not** require rewriting device room assignments; use HomeKit rooms as source of truth for HomeKit gear.

### 1.3 Device inventory context (user environment)
| Category | Examples | Source of truth |
|---|---|---|
| Lights | Philips Hue | HomeKit |
| Plugs | Kasa | HomeKit |
| Fans | Dreo, Hunter | HomeKit |
| Misc | Homebridge accessories | HomeKit (via Homebridge) |
| Speakers / hubs | HomePods, Apple TVs | **Out of scope** for HomeKit public API |
| Cameras | Ring | Ring Partner / unofficial API adapter |
| Irrigation | Rachio Wi‑Fi hub + valve | Rachio cloud API |
| Audio | Sonos | Local UPnP (SoCo / equivalent) |
| Nest | Cams / thermostats | Google SDM (Device Access) |

---

## 2. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  http://127.0.0.1:8787  (or http://mac.local:8787) │
│  Rooms · Cameras · Water · Music · Nest                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST + WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│  home-dashboard-api  (Node or Python)                       │
│  /api/health  /api/homekit/*  /api/ring/*  /api/nest/*      │
│  /api/rachio/*  /api/sonos/*  /ws                           │
│  adapters/ + token refresh + normalize Device model         │
└─┬──────────┬──────────┬──────────┬──────────┬───────────────┘
  │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼
HomeKit    Ring       Nest SDM   Rachio     Sonos LAN
Catalyst   cloud      Google     cloud      UPnP
bridge     WebRTC     WebRTC     valve API  SoCo
localhost  WHEP       Generate   start/stop
:PORT                 WebRtcStream
```

### 2.1 Normalized device model (API → UI)

Every adapter maps into this shape (TypeScript sketch):

```ts
export type Provider = "homekit" | "ring" | "nest" | "rachio" | "sonos";

export type Capability =
  | "on_off"
  | "brightness"
  | "color_temp"
  | "fan_speed"
  | "live_view"
  | "valve"
  | "thermostat"
  | "media_playback"
  | "volume";

export interface Device {
  id: string;                 // `${provider}:${nativeId}`
  provider: Provider;
  name: string;
  room?: string;              // HomeKit room name when known
  online: boolean;
  capabilities: Capability[];
  state: Record<string, unknown>; // provider-specific but documented
  updatedAt: string;          // ISO
}

export interface Room {
  id: string;
  name: string;
  provider: "homekit" | "virtual";
  deviceIds: string[];
}
```

UI rules:
- HomeKit devices render under real HomeKit rooms.
- Ring / Nest cameras render under a **Cameras** section (and optionally tagged with a manual room later).
- Rachio under **Water**.
- Sonos under **Music** (speaker name ≈ room).

---

## 3. HomeKit bridge (Mac)

### 3.1 Constraint (critical)
Apple does **not** expose HomeKit to plain macOS scripts, Terminal, or native AppKit apps. Access requires:
- Mac Catalyst (or iOS) app
- `com.apple.developer.homekit` entitlement
- `NSHomeKitUsageDescription`
- User authorization prompt
- **Apple Developer account** (user has one)
- Development signing or Mac App Store; **Developer ID / notarized-only builds generally cannot include HomeKit**

`HMHomeManager` on the same Mac signed into the same iCloud Home sees the existing home — **no re-pairing**.

### 3.2 Recommended approach
**Option A (faster):** Use an existing open-source HomeKit→HTTP bridge as a subprocess dependency:
- Homecast, Prefab, Casa, or HomeClaw (Mac Catalyst + local HTTP/CLI)

**Option B (more control):** Build a minimal Catalyst menu-bar app that:
1. Loads `HMHomeManager`
2. Enumerates homes → rooms → accessories → services → characteristics
3. Exposes localhost REST + optional WebSocket characteristic updates
4. Supports write for common types: `powerState`, `brightness`, `rotationSpeed`, etc.

### 3.3 Bridge HTTP contract (your API should normalize from this)

Minimum endpoints the bridge (or your adapter wrapping it) must support:

```
GET  /homes
GET  /homes/:homeId/rooms
GET  /homes/:homeId/accessories
GET  /homes/:homeId/accessories/:id
PUT  /homes/:homeId/accessories/:id/characteristics
     body: { characteristicType: string, value: number|bool|string }
GET  /homes/:homeId/scenes
POST /homes/:homeId/scenes/:id/execute
```

HomeKit characteristic mapping (minimum):
| Trait | HomeKit type (typical) | UI control |
|---|---|---|
| On/Off | `powerState` | toggle |
| Brightness | `brightness` 0–100 | slider |
| Fan speed | `rotationSpeed` | slider / presets |
| Current temp | `currentTemperature` | read-only |

Omit accessories with no controllable/readable characteristics of interest. Log HomePods/Apple TVs as skipped if absent from `HMHome.accessories`.

### 3.4 Process model
- Bridge app must stay running while dashboard is used.
- API health check should report `homekit: up|down`.
- Document: register Mac UDID for development provisioning if using personal team builds.

---

## 4. Adapter specs

### 4.1 Sonos (easiest after HomeKit rooms UI)
- **Transport:** Local LAN UPnP (Python `soco` or Node Sonos libraries / `node-sonos-http-api`).
- **No cloud required** for basic control.
- **Endpoints:**
  - `GET /api/sonos/speakers`
  - `POST /api/sonos/speakers/:id/play|pause|next|previous`
  - `POST /api/sonos/speakers/:id/volume` `{ level: 0-100 }`
  - `GET /api/sonos/speakers/:id/state` (transport + track + art URL)
- **Notes:** Browser cannot talk UPnP directly (CORS / protocol) — always proxy via API.
- **v1 UI:** list speakers, now playing, play/pause, volume. Grouping nice-to-have.

### 4.2 Rachio
- **Transport:** Cloud HTTPS `https://api.rach.io/1` (+ Smart Hose Timer APIs on `cloud-rest.rach.io` if valve is a hose timer).
- **Auth:** API key / bearer from Rachio account (user generates in Rachio app / developer settings).
- **No local LAN API** — acceptable; dashboard backend calls cloud.
- **Endpoints:**
  - `GET /api/rachio/status` — base station + valves
  - `POST /api/rachio/valves/:id/start` `{ durationSeconds: number }`
  - `POST /api/rachio/valves/:id/stop`
- **Docs:** https://rachio.readme.io/
- **UI:** Water card with status + Start (preset durations 5/10/30 min) + Stop.

### 4.3 Google Nest — official SDM (Device Access)

#### 4.3.1 Reality check for the user / builder
Homebridge Nest plugins failing does **not** mean Nest access is impossible. The supported path is Google’s **Device Access / Smart Device Management (SDM) API**. It still exists for personal/sandbox use as of 2026.

Common reasons “getting a Nest key didn’t work”:
1. Used a **Google Workspace** account — **not allowed**; need consumer Gmail (or consumer Google account).
2. Skipped the **US$5 one-time Device Access registration** — cannot create a project without it.
3. Created GCP OAuth client but never created a **Device Access project** and pasted the OAuth Client ID there.
4. Wrong redirect URI / tried to use a “simple API key” instead of **OAuth 2.0**.
5. Device still on a **legacy Nest account** (must be migrated to Google account).
6. OAuth consent / test-user not added while app is in testing.
7. Confused **GCP Project ID** with **Device Access Project ID** (UUID) — SDM URLs need the Device Access UUID.

#### 4.3.2 Setup checklist (document in README; implement OAuth in app)
1. Consumer Google account that owns the Nest devices in Google Home.
2. Pay Device Access registration: https://console.nest.google.com/device-access / registration docs.
3. Google Cloud project: enable **Smart Device Management API**.
4. Create OAuth 2.0 Client ID (Web application). Add redirect URI for local callback, e.g. `http://127.0.0.1:8787/api/nest/oauth/callback` (also keep Google’s PCM flow docs in mind during initial linking).
5. Device Access Console → Create project → paste **OAuth Client ID** → get **Device Access Project ID** (UUID).
6. Personal use can stay in **Sandbox**.
7. OAuth link account → store refresh token encrypted/on disk → auto-refresh access tokens.
8. Optional later: Pub/Sub events (can disable for v1 and poll).

Official get-started: https://developers.google.com/nest/device-access/get-started

#### 4.3.3 API usage
- List devices: `GET https://smartdevicemanagement.googleapis.com/v1/enterprises/{projectId}/devices`
- Thermostat commands: `ThermostatMode.SetMode`, setpoint commands per SDM thermostat guide.
- Camera live view (modern): `sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream` with SDP offer; browser plays WebRTC.
- SDP offer constraints (Nest): Unified plan; media lines audio → video → application; audio `recvonly`; Opus; offer ends with newline.

#### 4.3.4 Dashboard endpoints
```
GET  /api/nest/status          # linked? device count? last error?
GET  /api/nest/oauth/start     # redirect to Google
GET  /api/nest/oauth/callback
GET  /api/nest/devices
POST /api/nest/thermostats/:id/mode
POST /api/nest/thermostats/:id/setpoint
POST /api/nest/cameras/:id/webrtc  # body: { offerSdp } → { answerSdp, mediaSessionId, expiresAt }
```

#### 4.3.5 UI
- Thermostat card: mode, ambient temp, setpoint controls.
- Camera tile: thumbnail/placeholder → click opens live WebRTC player modal.
- Settings page: “Connect Nest” button + clear error messages for the failure modes above.

### 4.4 Ring cameras (click → live view)

#### 4.4.1 Preferred: Ring Partner API (official)
- OAuth 2.0; **all Ring API calls server-to-server** (CORS blocks browser).
- Live video: WebRTC via **WHEP**  
  `POST /v1/devices/{device_id}/media/streaming/whep/sessions` with SDP  
  `DELETE .../sessions/{session_id}` to close
- Base: `https://api.amazonvision.com` (per Ring Partner docs)
- Docs: https://developer.amazon.com/docs/ring/api-documentation.html  
- Hello world (Next.js live stream sample): https://github.com/AmazonAppDev/ring-api-helloworld

**Partner API access** may require Ring developer / partner onboarding. If the user cannot get Partner credentials yet, implement the adapter interface and a stub, then fall back to Option B.

#### 4.4.2 Fallback: unofficial Ring API / go2rtc
- Community stacks (e.g. go2rtc Ring source, open-source Ring clients) can produce WebRTC from refresh tokens.
- Mark as **best-effort / may break**; isolate behind `RING_MODE=partner|unofficial|disabled`.
- Still proxy through the local API; never put Ring credentials in frontend.

#### 4.4.3 Dashboard endpoints
```
GET  /api/ring/status
GET  /api/ring/devices
POST /api/ring/cameras/:id/live/start   # returns session + SDP answer or WHEP relay instructions
POST /api/ring/cameras/:id/live/stop
```

#### 4.4.4 UI
- Camera grid (Ring + Nest).
- Click → full-bleed or modal live player.
- Show connection state; auto-stop stream on modal close.

---

## 5. Backend API surface (aggregate)

```
GET  /api/health
     → { ok, adapters: { homekit, sonos, rachio, nest, ring } }

GET  /api/rooms
GET  /api/devices
GET  /api/devices/:id
POST /api/devices/:id/actions
     body: { action: string, params?: object }
     # examples: { action: "set_on", params: { on: true } }
     #           { action: "set_brightness", params: { brightness: 40 } }
     #           { action: "set_volume", params: { level: 15 } }

WS   /ws
     server → client: { type: "device.updated", device: Device }
```

Action router dispatches by `device.provider` to the correct adapter.

Auth for LAN mode (optional v1.1): shared bearer token in `Authorization` header + same token in frontend settings (stored in localStorage is OK for LAN-only).

---

## 6. Frontend UX

### 6.1 Pages / sections
1. **Home** — rooms from HomeKit; devices as compact controls (not a card farm of marketing tiles).
2. **Cameras** — Ring + Nest tiles; click for live view.
3. **Water** — Rachio.
4. **Music** — Sonos.
5. **Settings** — adapter status, OAuth connect buttons (Nest/Ring), API base URL, LAN token.

### 6.2 Design constraints (user preference)
- One clear composition per section; avoid generic purple SaaS dashboard look.
- No cluttered hero with stats.
- Mobile Safari on iPhone must work on LAN.
- Live camera view is the only “heavy” overlay.

### 6.3 State
- Initial fetch rooms/devices.
- Subscribe WebSocket for updates.
- Optimistic UI for toggles; reconcile on adapter error toast.

---

## 7. Suggested repo layout

```
home-dashboard/
  README.md
  docs/
    nest-setup.md
    ring-setup.md
    homekit-bridge.md
  apps/
    web/                 # Vite React UI
    api/                 # Node or Python API
  packages/
    shared/              # Device types, zod schemas
  bridge/                # optional Swift Catalyst project OR notes linking to external bridge
  .env.example
  docker-compose.yml     # optional; Sonos discovery often needs host networking — prefer native Mac process
```

`.env.example` keys:
```
PORT=8787
BIND_HOST=127.0.0.1
LAN_TOKEN=

HOMEKIT_BRIDGE_URL=http://127.0.0.1:8080

RACHIO_API_KEY=

SONOS_ENABLED=true

NEST_CLIENT_ID=
NEST_CLIENT_SECRET=
NEST_PROJECT_ID=          # Device Access UUID
NEST_REDIRECT_URI=http://127.0.0.1:8787/api/nest/oauth/callback
# NEST_REFRESH_TOKEN filled after OAuth

RING_MODE=disabled        # partner | unofficial | disabled
RING_CLIENT_ID=
RING_CLIENT_SECRET=
RING_REFRESH_TOKEN=
```

---

## 8. Implementation phases (build in this order)

### Phase 0 — Scaffold
- Create `home-dashboard/` monorepo.
- API health endpoint + empty web shell.
- Config loading from `.env`.
- README with run instructions for Mac.

**Done when:** `GET /api/health` works; blank UI loads.

### Phase 1 — HomeKit rooms + controls
- Run/integrate Catalyst HomeKit bridge (existing project or minimal custom).
- Adapter: list rooms/devices; toggle + brightness (+ fan speed if present).
- UI: rooms view.

**Done when:** User can turn a Hue light and a Kasa plug from the local site using existing Home rooms. No re-pairing.

### Phase 2 — Sonos
- LAN discovery + playback controls + now playing.
- Music section in UI.

**Done when:** Play/pause/volume works for at least one speaker.

### Phase 3 — Rachio
- API key auth; status; start/stop watering.
- Water section.

**Done when:** Valve starts for N seconds and stops from UI.

### Phase 4 — Nest SDM
- Implement OAuth + token persistence.
- List thermostats/cameras.
- Thermostat controls.
- WebRTC live view for supported cams.
- `docs/nest-setup.md` with the failure modes from §4.3.1.

**Done when:** Thermostat readable/controllable; one Nest cam live view works **or** clear setup diagnostics explain what’s missing (account type, $5 registration, project UUID, refresh token).

### Phase 5 — Ring live view
- Partner API path first; unofficial fallback behind flag.
- Cameras page merges Ring + Nest.
- Click-to-live; stop on close.

**Done when:** At least one Ring camera streams in-browser, or Settings shows blocked Partner access with next steps.

### Phase 6 — Hardening
- `launchd` plist to start API (+ instructions for bridge app Login Item).
- Per-adapter circuit breaking; UI badges.
- Basic auth token for LAN bind.
- Logging without leaking secrets.

---

## 9. Testing plan

### Automated
- Unit tests for device ID normalization and action routing.
- Contract tests with recorded HTTP fixtures for Rachio/Nest list responses (no live secrets in CI).
- WebRTC player smoke test can be manual.

### Manual acceptance (on user’s Mac)
1. HomeKit: light on/off in two different rooms.
2. Homebridge accessory appears under correct room.
3. Sonos volume change audible.
4. Rachio start/stop confirmed in Rachio app.
5. Nest thermostat setpoint change reflected on device.
6. Nest cam live view ≤ ~5s to first frame after click (best effort).
7. Ring live view same.
8. Kill Nest credentials → Cameras/Nest show error; HomeKit section still works.

---

## 10. Security
- Bind `127.0.0.1` by default.
- If LAN bind enabled, require `LAN_TOKEN`.
- Store OAuth refresh tokens with file permissions `600`.
- Never log access tokens.
- Camera streams only created on user click; tear down on navigate away.
- Warn that Ring/Nest video leaves the LAN via vendor cloud (inherent).

---

## 11. README must include
1. Why Home Assistant re-pairing is out of scope.
2. HomeKit entitlement / Developer account / bridge must stay running.
3. Nest Device Access $5 + consumer Google account checklist.
4. Rachio API key steps.
5. Ring Partner vs unofficial mode.
6. How to run: bridge → api → web.
7. Troubleshooting matrix (adapter → symptom → fix).

---

## 12. Prompt starter for the building Cursor agent

Copy this into the other chat along with this file:

```text
Build the project described in docs/home-local-dashboard-tech-spec.md (or the pasted spec).

Constraints:
- Greenfield under home-dashboard/ (do not touch unrelated calculator files).
- Do not re-pair HomeKit devices into Home Assistant.
- Do not use Homebridge Nest plugins; use Google SDM Device Access.
- HomeKit access must go through a Mac Catalyst HomeKit bridge (integrate existing open source or minimal custom).
- Implement Phase 0 → Phase 1 first and stop for a demo checkpoint, then continue phases in order.
- Keep secrets server-side. Default bind 127.0.0.1.
- Prefer a working thin slice over perfect abstractions.
```

---

## 13. Open decisions (builder may choose; document choice in README)
| Topic | Default choice |
|---|---|
| API language | Node + TypeScript (Fastify) |
| UI | Vite + React + TypeScript |
| HomeKit bridge | Integrate existing open-source Catalyst bridge first; custom only if needed |
| Ring | `RING_MODE=partner` when credentials exist, else `disabled` with UI CTA |
| Nest events | Poll every 30–60s in v1; Pub/Sub later |
| Monorepo tool | pnpm workspaces or npm workspaces |

---

## 14. Success definition
A phone on the home Wi‑Fi (or Safari on the Mac) can open the local site and:
- Control existing HomeKit/Homebridge devices by room without re-setup,
- Start/stop Rachio,
- Control Sonos,
- Operate Nest via SDM (not Homebridge),
- Click a Ring (and Nest) camera to see live video,

with adapters failing independently and setup docs that explain Nest “API key” confusion vs OAuth Device Access.
