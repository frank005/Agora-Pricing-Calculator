# Home Local Dashboard — Build Handoff Spec

> **For the building agent:** This is a greenfield project. Do **not** modify the Agora pricing calculator files in this repo (`index.html`, `script.js`, `style.css`, `README.md`). Create a **new project directory** (recommended: `home-dashboard/`) or a separate repo. Implement phase by phase. Prefer working vertical slices over a big-bang rewrite.

**Goal:** A local Mac-hosted **iPad wall-panel website** (Safari, no App Store install required) that feels like a modern Apple Home / Rehome-style multi-face dashboard: swipeable full-screen “faces,” large across-the-room tiles, ambient clock/weather modes — while controlling the user’s existing Apple Home (60+ HomeKit/Homebridge devices) **plus** Ring, Rachio, Sonos, and Nest — without Home Assistant and without re-pairing.

**UX reference:** [Rehome app faces](https://userehome.com/pages/app) — 10 swipeable faces, one job each, readable from across the room, runs in Safari on old iPads. We copy the **interaction model**, not their Home Assistant dependency.

**Architecture:** Safari on iPad → one local backend API on the Mac → pluggable adapters (HomeKit bridge, Ring, Nest SDM, Rachio, Sonos) + light ambient data (weather, calendar, photos). Secrets stay on the server. Cameras open live views on click (WebRTC).

**Tech stack (recommended):**
- **UI:** Vite + React + TypeScript; **iPad-first** landscape wall panel; touch targets ≥ 48–64px; swipeable faces; works in Safari (add to Home Screen as web app)
- **API:** Node.js (Fastify or Express) + TypeScript **or** Python (FastAPI) — pick one and stick to it
- **HomeKit bridge:** Separate Mac Catalyst / Swift app with HomeKit entitlement (or reuse Homecast / Prefab / Casa / HomeClaw as the HomeKit data plane and proxy through your API)
- **Realtime:** WebSocket or SSE from API → browser for state changes
- **Ambient data:** Weather (Open-Meteo or Apple WeatherKit if keyed), calendar (CalDAV / Google Calendar OAuth / ICS URL), local photo album folder or iCloud shared album URL the user configures
- **Secrets:** `.env` + macOS Keychain optional; never ship tokens to the browser
- **Deploy target:** Always-on process on the user’s Mac (`launchd`), **LAN bind** so the iPad can reach `http://mac-name.local:8787` (token auth); `127.0.0.1` only is insufficient for wall iPad use

---

## 1. Product requirements

### 1.1 Must have
1. **iPad wall-panel UX (Rehome-like):** swipeable full-screen **faces**; large tiles readable across a room; one primary job per face; works in **Safari on iPad** (Add to Home Screen); landscape primary.
2. **HomeKit rooms + accessories** as already configured in the Apple Home app (Hue lights, Kasa plugs, Dreo/Hunter fans, Homebridge-exposed devices, scenes).
3. Read state + basic control (on/off, brightness, fan speed where characteristics exist) with **one-tap** large controls (glide/brightness optional later).
4. **Ring cameras:** list devices; **click → live view** in the page (WebRTC); dedicated multi-camera face.
5. **Rachio:** show valve/hub status; start/stop watering with duration (tile on Home Modular Plus or Water face).
6. **Sonos:** discover speakers on LAN; play/pause, volume, now-playing on Modular / Music surfaces.
7. **Google Nest via official SDM API** (not Homebridge Nest plugins): thermostats + camera live view where supported.
8. Ambient faces: **clock**, **weather**, **calendar**, optional **photos**, quiet **night/flow** face.
9. Single cohesive local website (one origin); also usable on iPhone, but **iPad is the design target**.
10. Clear offline / auth-error states per adapter (HomeKit up but Nest down should not blank the whole UI).

### 1.2 Explicit non-goals (v1)
- Do **not** require Home Assistant (Rehome does; we deliberately do not).
- Do **not** migrate or re-pair the 60+ HomeKit devices into Home Assistant.
- Do **not** rely on Homebridge Nest plugins (user already confirmed they are broken for them).
- Do **not** expect HomePods / Apple TVs via public HomeKit API (omit or mark unsupported; use Sonos for music face).
- Do **not** build cloud hosting; this is Mac-local first (iPad talks to Mac over home Wi‑Fi).
- Do **not** require rewriting device room assignments; use HomeKit rooms as source of truth for HomeKit gear.
- Do **not** ship a native App Store app in v1 (Safari web app is enough, like Rehome).

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
┌──────────────────────────────────────────────────────────────┐
│  iPad Safari (Add to Home Screen)  wall panel / kiosk        │
│  Swipeable FACES: Home+ · Modular · Cameras · Clock · …      │
│  http://mac.local:8787/?panelId=kitchen&token=…              │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST + WebSocket
┌───────────────────────────▼──────────────────────────────────┐
│  home-dashboard-api  (on always-on Mac)                      │
│  /api/health  /api/panel/*  /api/homekit/*  /api/ring/*      │
│  /api/nest/*  /api/rachio/*  /api/sonos/*                    │
│  /api/weather  /api/calendar/*  /api/photos/*  /ws            │
└─┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────┘
  ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
HomeKit Ring   Nest  Rachio Sonos Weather Cal  Photos
bridge  live   SDM   valve  LAN   Open-   ICS  local
        view         cloud  UPnP  Meteo        folder
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
     → { ok, adapters: { homekit, sonos, rachio, nest, ring, weather, calendar, photos } }

GET  /api/panel/config?panelId=
PUT  /api/panel/config?panelId=

GET  /api/rooms
GET  /api/devices
GET  /api/devices/:id
POST /api/devices/:id/actions
     body: { action: string, params?: object }
     # examples: { action: "set_on", params: { on: true } }
     #           { action: "set_brightness", params: { brightness: 40 } }
     #           { action: "set_volume", params: { level: 15 } }

GET  /api/weather
GET  /api/calendar/upcoming
GET  /api/photos/random

WS   /ws
     server → client: { type: "device.updated", device: Device }
```

Action router dispatches by `device.provider` to the correct adapter.

Auth for iPad/LAN: shared bearer token (`Authorization` or `?token=`) required when not on loopback; store once in the panel’s LocalStorage after first-run prompt.

---

## 6. iPad wall-panel UX (Rehome-style faces)

Reference: https://userehome.com/pages/app — “10 faces. Five on from the start. Add the rest in the face picker. Once. For every iPad in your home.” Swipe between faces; each face has one job; readable across the room; Safari-only.

### 6.1 Interaction model (copy this)
| Rehome pattern | Our implementation |
|---|---|
| Full-screen faces, swipe horizontal | CSS scroll-snap or Framer Motion / custom pager; one face = 100vw×100vh (or 100dvh) |
| Face picker (enable/order faces once per iPad) | LocalStorage (or server `panel` config keyed by `panelId` query param) |
| Five faces on by default | Default enabled set below |
| Large one-tap tiles | Min touch target 64×64; primary controls full tile tap |
| Across-the-room readability | Display type ≥ 48–72px for time/temp; avoid dense lists on control faces |
| Safari / old iPads | No App Store; progressive enhancement; avoid bleeding-edge-only APIs; test iPadOS Safari |
| Local network only | iPad → `http://<mac>.local:8787/?token=…` or token prompt once |
| Add to Home Screen | `manifest.webmanifest` + apple-mobile-web-app meta for standalone chrome-less mode |
| Guided access / kiosk | Document: iPad Guided Access or Screen Time; keep screen awake via `nosleep` / video hack / guided access |

### 6.2 Face catalog (map Rehome → our stack)

Ship these faces. **Default ON (first five, in order):** Home Modular Plus → Home Modular → Home Camera → Modular → Clock.  
**Available in picker:** Photos, Analog, Flow, Weather, Calendar, Water, Music/Sonos, Rooms (drill-down), Settings (hidden from swipe or last).

| Face | Job (one sentence) | Data sources | Controls |
|---|---|---|---|
| **Photos** | Family photos with time soft-behind | Local `/media/photos` folder or configured album URL; clock overlay | Swipe/idle advance; tap → next |
| **Home Modular Plus** | Status + key controls on one glance | Nest thermostat, weather, calendar “today”, Ring/Nest doorbell/cam snapshot, HomeKit scenes, time | Tap scene; tap thermostat; tap doorbell tile → live view |
| **Analog** | Clock readable across the room | Local time | None (ambient) |
| **Home Modular** | Large tiles for lights, locks, thermostat, scenes | HomeKit accessories + Nest thermostat + scenes | One tap each tile; long-press → detail sheet (brightness/fan) |
| **Flow** | Quiet night face | Dim clock + optional next alarm/calendar | Minimal; auto-dim |
| **Modular** | Info grid: date, month, now playing, sunrise, clock, weather | Weather API, Sonos now-playing, sun times | Tap now-playing → Music face |
| **Weather** | Today as one large number + wind/humidity/sunrise | Weather API | None / open detail |
| **Calendar** | This week + what’s on today | Google Calendar OAuth or ICS URL | Read-only v1 |
| **Clock** | Time as large as the screen allows | Local time | None |
| **Home Camera** | Cameras side by side | Ring + Nest cams (snapshots idle; WebRTC on tap/expand) | Tap camera → live view modal or focus that tile |
| **Water** (ours) | Irrigation at a glance | Rachio | Start presets / Stop |
| **Music** (ours) | What’s playing + volume | Sonos | Play/pause/volume |
| **Rooms** (ours) | One HomeKit room per sub-view | HomeKit rooms | Same controls as Modular, filtered |

### 6.3 Why this fits without Home Assistant
Rehome’s hub is Home Assistant. Ours is:
- **HomeKit Catalyst bridge** = lights, plugs, fans, Homebridge gear, scenes, rooms
- **Nest SDM** = thermostat + Nest cams (what Rehome would pull from HA)
- **Ring** = doorbell/cams
- **Sonos** = “what is playing”
- **Rachio** = water (extra vs Rehome)
- **Weather / calendar / photos** = ambient faces (same idea as Rehome’s non-device faces)

No HA install required. The iPad never holds Ring/Nest secrets; it only talks to the Mac API.

### 6.4 Layout & visual rules (wall panel)
- **Landscape iPad first**; portrait acceptable but secondary.
- Prefer **full-bleed faces** (edge-to-edge), not inset dashboard chrome.
- Idle after N seconds on ambient faces: hide any residual chrome; show only the face.
- **Night mode:** after sunset or schedule, force Flow/Analog, lower brightness (CSS + optional `screen.brightness` N/A on web — dim via dark UI).
- Avoid purple SaaS / cream-serif clichés; pick one clear visual direction with CSS variables.
- Motion: face swipe + tile press feedback + live-view open — intentional, not noisy.
- Do **not** put stats strips, promo chips, or floating badges on the primary Home faces.

### 6.5 Panel config API
```
GET  /api/panel/config?panelId=kitchen-ipad
PUT  /api/panel/config?panelId=kitchen-ipad
     body: {
       enabledFaces: ["homePlus","homeModular","cameras","modular","clock",...],
       order: [...],
       photoSource: "local",
       calendarSource: "ics",
       weatherLatLon: [lat, lon],
       nightMode: { start: "22:00", end: "06:30", face: "flow" }
     }
```
Persist on Mac disk (`data/panels/<panelId>.json`). Each physical iPad uses a stable `panelId` in the URL or first-run setup.

### 6.6 Ambient adapters (new, lightweight)
```
GET /api/weather
GET /api/calendar/upcoming
GET /api/photos/random   # or album listing
```
- Weather: Open-Meteo (no key) default.
- Calendar: user-provided ICS URL first (simplest); Google OAuth optional.
- Photos: directory watched on the Mac (`PHOTOS_DIR`); serve resized JPEGs.

### 6.7 State
- Initial fetch panel config + rooms/devices + weather.
- Subscribe WebSocket for device updates (Home Modular tiles update live).
- Optimistic UI for toggles; reconcile on adapter error toast (non-blocking on ambient faces).
- Camera streams only while Home Camera face focused or modal open; tear down on swipe away.

### 6.8 iPad deployment checklist (README)
1. Mac API + HomeKit bridge running; LAN bind + token.
2. On iPad Safari open `http://<mac>.local:8787/?panelId=kitchen&token=…`
3. Share → **Add to Home Screen**.
4. Optional: Guided Access; start on charger; disable Auto-Lock or use guided access.
5. Face picker: enable Photos / Calendar / Water / Music as desired.
6. Confirm landscape lock if mounting in a stand.

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
BIND_HOST=0.0.0.0          # iPad on LAN must reach the Mac; pair with LAN_TOKEN
LAN_TOKEN=                 # required when BIND_HOST is not loopback

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

PHOTOS_DIR=./data/photos
CALENDAR_ICS_URL=
WEATHER_LAT=
WEATHER_LON=
```

---

## 8. Implementation phases (build in this order)

### Phase 0 — Scaffold + face shell (iPad-first)
- Create `home-dashboard/` monorepo.
- API health + `.env` (LAN bind + token).
- Web shell with **horizontal swipe faces**, face picker, Add-to-Home-Screen manifest.
- Ship ambient stubs: **Clock**, **Analog**, **Flow** (no devices yet).

**Done when:** iPad Safari can Add to Home Screen, swipe 3 ambient faces, survives reload with face order in LocalStorage/`panelId`.

### Phase 1 — Home Modular + HomeKit
- Integrate Catalyst HomeKit bridge.
- Adapter: rooms/devices/scenes; toggle + brightness (+ fan speed).
- Faces: **Home Modular** (large tiles), **Rooms** drill-down.

**Done when:** From wall iPad, one tap toggles Hue + Kasa using existing HomeKit rooms/scenes. No re-pairing.

### Phase 2 — Home Modular Plus + ambient data
- Weather (Open-Meteo), calendar ICS, time already present.
- Nest thermostat tile if Phase 4 not ready yet: placeholder “Connect Nest”.
- Scenes + weather + calendar + thermostat slot on **Home Modular Plus**.
- **Modular** info grid face (date, weather, sunrise, now-playing placeholder).

**Done when:** Plus face shows live weather + today’s calendar + HomeKit scenes.

### Phase 3 — Sonos Music face + Modular now-playing
- LAN discovery; play/pause/volume; now-playing metadata/art.
- **Music** face; Modular face shows current track.

**Done when:** Audible control from iPad; art visible on Modular.

### Phase 4 — Rachio Water face
- API key; status; start/stop; optional tile on Home Modular Plus.

**Done when:** Valve start/stop from Water face on iPad.

### Phase 5 — Nest SDM
- OAuth + token persistence; thermostats; WebRTC cams.
- Wire thermostat into Home Modular / Plus; Nest cams into Camera face.
- `docs/nest-setup.md` with §4.3.1 failure modes.

**Done when:** Thermostat works on Modular tiles; Nest live view works **or** Settings diagnostics are clear.

### Phase 6 — Home Camera face (Ring + Nest)
- Ring Partner (or unofficial flag); snapshots idle; WebRTC on tap.
- Multi-camera side-by-side face; tear down streams on swipe away.

**Done when:** At least one Ring or Nest cam live on iPad Camera face.

### Phase 7 — Photos + night mode + hardening
- Photos face from `PHOTOS_DIR`.
- Night mode schedule → Flow/Analog.
- `launchd`, bridge Login Item, LAN token, adapter health badges, Guided Access docs.

**Done when:** Kitchen iPad can sit on a stand all day: swipe faces, control home, cameras on demand, quiet at night.

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

Product intent: Rehome-like iPad wall panel (https://userehome.com/pages/app) — swipeable full-screen faces, large across-the-room tiles, Safari Add to Home Screen — but powered by HomeKit + Ring/Nest/Rachio/Sonos, NOT Home Assistant.

Constraints:
- Greenfield under home-dashboard/ (do not touch unrelated calculator files).
- Do not install or require Home Assistant; do not re-pair HomeKit devices.
- Do not use Homebridge Nest plugins; use Google SDM Device Access.
- HomeKit access must go through a Mac Catalyst HomeKit bridge (integrate existing open source or minimal custom).
- iPad-first UX: implement Phase 0 face shell before device polish.
- Implement Phase 0 → Phase 1 first and stop for a demo checkpoint on a real iPad Safari if possible, then continue phases in order.
- Keep secrets server-side. LAN bind + token so the iPad can reach the Mac.
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
An **iPad on the wall** (Safari Add to Home Screen), talking to the Mac over LAN, behaves like a Rehome-style multi-face Home panel:
- Swipe faces (Home Modular Plus / Modular / Cameras / Clock / …) with a face picker,
- One-tap large tiles control existing HomeKit/Homebridge devices by room/scene without re-setup,
- Thermostat (Nest SDM), Sonos now-playing, Rachio water, weather, calendar, photos as dedicated or composite faces,
- Tap a Ring or Nest camera for live video; streams stop when leaving the face,
- Night/Flow face for quiet hours,
- No Home Assistant required,

with adapters failing independently and setup docs that explain Nest “API key” confusion vs OAuth Device Access.

## 15. Rehome gap analysis (what we match / skip / extend)

| Rehome capability | Match? | How |
|---|---|---|
| Safari on iPad, no install | Yes | PWA / Add to Home Screen |
| Swipeable faces, face picker | Yes | §6 |
| Large one-tap light/lock/scene tiles | Yes | HomeKit bridge |
| Thermostat on Home faces | Yes | Nest SDM |
| Cameras side by side | Yes | Ring + Nest WebRTC |
| Weather / calendar / clock / photos / night flow | Yes | Ambient adapters |
| Works only with Home Assistant | **No — intentional** | HomeKit + direct adapters |
| $4.99 product / their HA add-on | Skip | Self-hosted on user’s Mac |
| 3D-printed stand | Out of scope | User’s existing stand |
| Sonos music face | Extend | Not emphasized on Rehome page; we add it |
| Rachio water | Extend | Ours |
| HomePods / Apple TV tiles | Weak | Public HomeKit API gap; Sonos covers audio |

Closest commercial cousins if useful for UI inspiration (HomeKit-native apps, not HA): Hearth, HomePad, Wallflower, Domus — but **deliverable is still our local website**, not wrapping those apps.
