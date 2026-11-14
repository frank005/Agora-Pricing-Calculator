# Home Local Dashboard — Build Handoff Spec

> **For the building agent:** Greenfield only. Create a **new empty repo or folder** named `home-dashboard/`. Do **not** use or modify any Agora Pricing Calculator files — that repo is unrelated; this markdown may have been temporarily hosted there by mistake. Prefer working vertical slices. **First milestone is HomeKit control from a browser, not a pretty UI.**

**Goal:** A Mac-hosted **iPad wall-panel website** (Safari / Add to Home Screen) that feels like a Rehome-style multi-face Apple Home view, while acting as an **additional controller** beside Apple Home — **no re-pairing, no Home Assistant, no device migration.**

**UX reference:** [Rehome faces](https://userehome.com/pages/app) — swipeable full-screen faces, large tiles, ambient modes. Copy the **interaction model**, not Home Assistant.

**Architecture:** iPad Safari → authenticated local API on always-on Mac (already runs Homebridge) → pluggable adapters (HomeKit Catalyst bridge, media, Ring, Nest SDM, Rachio SHVK001, Sonos, ambient). Secrets stay on the Mac. Cameras stream only on demand.

**Tech stack:**
- **UI:** Vite + React + TypeScript; iPad-first landscape; Safari PWA
- **API:** Node.js + TypeScript + Fastify (preferred)
- **HomeKit:** Mac Catalyst app with HomeKit entitlement (or proven open-source Catalyst bridge) on localhost only
- **Media extras:** `pyatv` for Apple TV / HomePod capabilities; SoCo/local API for Sonos
- **Realtime:** WebSocket with auth
- **Process:** `launchd` for API; documented Login Item / always-open for Catalyst GUI app

---

## 0. External review decisions (ChatGPT recommendations)

Keep ~80% of the prior architecture. Decisions:

| Recommendation | Decision | Notes |
|---|---|---|
| Validate Catalyst HomeKit bridge before UI polish | **Accept — now Phase 0** | Bridge-only demo first; browser/API = Phase 1; no React in Phase 0 |
| Scenes + live notifications block first demo | **Clarify — non-blocking** | Still validate; Hue/Kasa/Hunter fan enough for first proof |
| Treat Developer ID as known-insufficient | **Clarify — verify in Xcode** | Record actual provisioning result; don’t assume |
| Preserve all HomeKit/Homebridge pairings | **Accept (hard rule)** | Dashboard = extra controller only |
| Expand inventory (Yale, Bond, Dreo, etc.) | **Accept** | Prefer HomeKit path when already exposed |
| Apple TV / HomePod via pyatv (not HomeKit API) | **Accept** | Separate media adapters; don’t pretend they’re HMAccessory |
| Sonos local API | **Accept** | Priority entertainment adapter |
| Samsung TV / Fire TV ADB / Pioneer VSX-934 | **Defer to backlog** | Not required for first acceptance; add after core home works |
| Miko smart valve | **Investigate later** | Unknown protocol — spike only after Rachio |
| myQ garage | **Explicitly deferred** | Cloud integrations restricted |
| Ring: validate OAuth + one camera before multi-cam UI | **Accept** | No continuous multi-stream assumption |
| Rachio SHVK001 = Smart Hose Timer API | **Accept** | Not the irrigation-controller API |
| Nest = official SDM only | **Accept** | No Homebridge Nest / no HA |
| Replace `?token=` URL auth with panel pairing + sessions | **Accept** | See §7 |
| HTTPS on LAN | **Accept as target** | `mkcert` or Tailscale Serve; don’t block Phase 0 on TLS |
| CloudFront remote access | **Design hook only** | LAN first; leave authenticated tunnel option documented |
| Richer device model (stale/online/writable/dedupe) | **Accept** | See §3 |
| Mac sleep/wake + Homebridge coexistence | **Accept** | See §8 |
| Keep Rehome-like faces UX | **Accept** | After HomeKit POC |
| Reorder phases: HomeKit → foundation → entertainment → Nest/Rachio → Ring | **Accept with tweak** | Ambient clock can stub early; photos/calendar not on critical path |
| Require Home Assistant | **Reject** | User’s 60+ devices already in HomeKit/Homebridge; HA is not easier |
| Build full entertainment stack before Nest/Ring | **Partial reject** | Sonos + pyatv yes; Samsung/Fire/Pioneer wait |

**First acceptance milestones (do not skip ahead to UI polish):**
- **Phase 0 gate:** Catalyst bridge alone can discover and control existing **Hue**, **Kasa**, and **native HomeKit Hunter fan** (no pairing changes). Prove this with the bridge’s own minimal test UI, unit harness, or localhost curl against the bridge — **not** the React dashboard.
- **Phase 1 gate:** Browser talks to the Fastify API, which proxies the bridge, and controls those **same** devices. Only then invest in faces/UX.

Scene execution and live characteristic notifications should still be validated during Phase 0, but they are **non-blocking** for the first accessory-control demo (Hue + Kasa + Hunter fan is enough to prove feasibility).

---

## 1. Product requirements

### 1.1 Hard constraints
1. **No re-pairing / resetting / migrating** existing HomeKit or Homebridge devices.
2. **No Home Assistant** as a required hub.
3. Dashboard is an **additional controller** alongside Apple Home.
4. Prefer a single HomeKit path when a device is already in Home; avoid duplicate direct integrations for the same physical device.
5. Secrets and vendor APIs stay on the Mac backend — never in the browser.
6. Do not expose the Catalyst HomeKit bridge or device APIs to the public internet.

### 1.2 Must have (core)
1. HomeKit discovery: homes, rooms, accessories, scenes, characteristic read/write, live updates.
2. Control existing: Hue, Kasa, Hunter (native HomeKit), Bond/Hunter via Homebridge, Yale lock (with confirm), other Homebridge accessories, Dreo if already in HomeKit.
3. iPad wall-panel UX: swipeable faces, large taps, face picker, Add to Home Screen.
4. Sonos local control + now playing.
5. Apple TV / HomePod via **pyatv** (best-effort capabilities).
6. Rachio **SHVK001** Smart Hose Timer (base station + valve start/stop/duration).
7. Nest thermostat (+ cams if SDM model supports WebRTC) via Device Access / SDM.
8. Ring cameras: discover + **on-demand** live view (not perpetual multi-stream).
9. Ambient: clock, weather, calendar, photos, night/flow (non-blocking for device control).
10. Per-adapter health; one adapter down must not blank the UI.

### 1.3 Explicit non-goals (v1)
- Home Assistant install or migration.
- Homebridge Nest plugins.
- myQ garage.
- Assuming HomePods/Apple TVs appear in `HMHome.accessories`.
- Polished UI before Phase 0 HomeKit proof.
- Public internet exposure without an authenticated tunnel design.

### 1.4 Device inventory

#### A. Existing HomeKit / Homebridge (source of truth = Apple Home rooms)
| Device | Path | Notes |
|---|---|---|
| Philips Hue lights | HomeKit | Read + on/off + brightness (+ color if exposed) |
| Kasa plugs | HomeKit | On/off |
| Hunter fan (native HomeKit) | HomeKit | On/off + rotationSpeed if present |
| Bond Bridge + Hunter fans | HomeKit via Homebridge | Same characteristic model |
| Dreo DR-HTF024S | HomeKit if exposed; else Dreo adapter later | Prefer HomeKit first |
| Yale smart lock | HomeKit | **Confirm UI** before unlock; lock OK one-tap |
| Other Homebridge accessories | HomeKit | Render by service/characteristic metadata |

#### B. Entertainment (separate adapters — not public HomeKit accessory API)
| Device | Path | Priority |
|---|---|---|
| Sonos | Local UPnP / SoCo | **P0 entertainment** |
| Apple TV | pyatv | P1 |
| HomePod | AirPlay / pyatv (limited) | P1 best-effort |
| Samsung TV | SmartThings or local | **Backlog** |
| Fire TV | ADB | **Backlog** |
| Pioneer VSX-934 | Network AVR protocol | **Backlog** |

#### C. Cloud / specialty
| Device | Path | Priority |
|---|---|---|
| Ring cameras | Partner API preferred; unofficial = best-effort | Validate 1 cam before multi-cam UI |
| Google Nest thermostat (+ cams) | Official SDM / Device Access | OAuth; isolate failures |
| Rachio SHVK001 | Smart Hose Timer API (`listBaseStations`, `listValves`, `startWatering`, `stopWatering`) | Poll v1; webhooks later |
| Miko smart valve | TBD spike | After Rachio |
| myQ | — | **Deferred** |

---

## 2. System architecture

```
┌────────────────────────────────────────────────────────────┐
│ iPad Safari PWA  (paired panel session — not ?token= URL)  │
│ Faces: Home Modular+ · Modular · Cameras · Music · Clock…  │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTPS or HTTP+session (LAN)
┌────────────────────────▼───────────────────────────────────┐
│ home-dashboard-api (Fastify)  launchd on Mac               │
│ registry · auth · ws · adapters · action log               │
└──┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┘
   │     │     │     │     │     │     │     │
   ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
HomeKit Ring  Nest  Rachio Sonos pyatv Weather Photos
localhost only     SHVK001  LAN  ATV/HP  ICS/OM  dir
Catalyst
(+ Homebridge devices already in Home)
```

Mac already runs **Homebridge** — API and bridge must coexist (different ports; don’t fight HB).

---

## 3. Normalized device model

```ts
export type Provider =
  | "homekit"
  | "ring"
  | "nest"
  | "rachio"
  | "sonos"
  | "pyatv"
  | "dreo"
  | "virtual";

export type Availability = "online" | "offline" | "unknown" | "stale";

export interface CapabilitySpec {
  name: string;                 // e.g. "on_off", "brightness", "lock", "live_view"
  writable: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface Device {
  /** Stable dashboard id — do not key off display name */
  id: string;                   // e.g. homekit:<accessoryUUID>
  provider: Provider;
  nativeId: string;             // provider-native immutable id
  physicalKey?: string;         // optional dedupe key across providers
  name: string;
  roomId?: string;              // HomeKit room id when from Home
  roomName?: string;
  availability: Availability;
  lastSeenAt: string;           // ISO last successful status
  capabilities: CapabilitySpec[];
  state: Record<string, unknown>;
  readOnly: boolean;            // true if no writable caps
}

export interface Room {
  id: string;
  name: string;
  source: "homekit" | "virtual";
  deviceIds: string[];
}

export interface ActionRequest {
  action: string;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ActionResult {
  ok: boolean;
  confirmed: boolean;           // true only if integration confirmed
  device?: Device;
  error?: { code: string; message: string };
}
```

Rules:
- HomeKit rooms = source of truth for HomeKit devices.
- Non-HomeKit devices use virtual rooms or manual `roomId` mapping in config.
- Deduplicate when the same physical device would appear twice (prefer HomeKit).
- UI must not show stale state as “live” without a stale badge (`availability: "stale"` if `now - lastSeenAt > threshold`).
- Optimistic UI allowed, but **reconcile** from `ActionResult.confirmed` / subsequent characteristic events.
- Unsupported commands → clear error, not silent no-op.
- HomeKit: use real characteristic types / metadata and **permissions**; never assume every accessory has brightness/lock/etc.

---

## 4. HomeKit Catalyst bridge (Phase 0 — validate first)

### 4.1 Why
Public HomeKit is not available to plain macOS scripts. Catalyst + entitlement + user auth is the way to see the **existing** home with no re-pairing.

### 4.2 Minimal POC acceptance (before dashboard UI)

**Blocking for Phase 0 demo (required):**
1. Discover homes, rooms, accessories (and list scenes if present).
2. Read state of a Philips Hue light.
3. Toggle a Kasa plug.
4. Control native HomeKit Hunter fan.
5. No HomeKit pairing changes.

**Validate in Phase 0, but do not block the first demo:**
6. Execute an existing HomeKit scene (optional for first demo).
7. Receive characteristic updates when devices change in Apple Home (optional for first demo; still do before calling Phase 0 “complete”).
8. Recover after app restart and after Mac sleep/wake (before Phase 1).

**Signing / entitlements — verify in Xcode, do not assume:**
9. Enable HomeKit capability, add usage description, run on this Mac, and **record what actually works**: development team provisioning, Mac Catalyst destination, entitlement presence, authorization prompt.
10. Treat claims like “Developer ID-only cannot use HomeKit” as a **hypothesis to confirm**, not a pre-established fact. If a signing path fails, document the exact Xcode/signing error and the path that succeeded. The Catalyst bridge is the main platform-specific uncertainty in this project — resolve it empirically.

### 4.3 Lifecycle reality
Do **not** assume a reliable fully headless HomeKit daemon. Start **foreground-capable** (menu bar / visible app). Document Login Item. Bridge listens on **127.0.0.1 only**; API proxies to it.

**No React/Vite work in Phase 0.** Frontend effort waits until Phase 0 blocking controls work.

### 4.4 Characteristic handling
- Enumerate services/characteristics from HomeKit metadata.
- Map common types (power, brightness, rotationSpeed, targetLockState, etc.) dynamically.
- Honor read/write permissions.
- Time out writes; surface `HMError` equivalents to API.

### 4.5 Optional shortcut
Integrating Homecast / Prefab / Casa / HomeClaw is OK **if** POC checklist above still passes on this Mac.

---

## 5. Adapter notes

### 5.1 Sonos
Local LAN; proxy via API. Play/pause/volume/now playing. Browser never speaks UPnP.

### 5.2 Apple TV / HomePod (pyatv)
Separate adapter. Power/input/playback where pyatv supports. HomePod may be limited — degrade gracefully.

### 5.3 Rachio SHVK001 (Smart Hose Timer)
Use **Smart Hose Timer** APIs (not classic zone controller assumptions):
- List base stations / valves
- `startWatering` `{ valveId, durationSeconds }`
- `stopWatering`
- History/scheduling if cheap
- Poll initially; show **last successful update** time (valve state can lag; respect async `matches`-style freshness when present)
- Webhooks later optional

### 5.4 Nest (SDM)
- Consumer Google account; Device Access $5 registration; OAuth (not a simple API key).
- Distinguish **GCP project** vs **Device Access project UUID**.
- Secure refresh tokens; handle expiry.
- Validate **this user’s** thermostat traits before UI assumptions.
- Camera WebRTC is **model-dependent**.
- Isolate Nest failures from HomeKit.

### 5.5 Ring
- Validate developer/Partner OAuth access before multi-cam UI.
- Prove **one** camera live stream end-to-end first.
- Expect session limits, reconnects, timeouts, unavailable states.
- Credentials backend-only.
- Unofficial mode = best-effort flag.
- **Do not** assume N cameras can stream continuously forever; start on view, stop on leave.

### 5.6 Dreo / Miko
- Dreo: only if missing from HomeKit.
- Miko: investigation spike after Rachio works.

---

## 6. iPad UX (Rehome-style) — after Phase 0

Keep:
- Swipeable full-screen faces + face picker per `panelId`
- Large one-tap tiles; room views; camera face; music; clock/weather/calendar/photos; night mode
- Safari Add to Home Screen; adapter health badges
- Frontend protocol-agnostic (only talks to normalized API)

Minimum test matrix: define **minimum iPadOS** (recommend 16+ or 17+) and verify Safari WebSocket + WebRTC + standalone PWA.

Default faces ON: Home Modular Plus → Home Modular → Home Camera → Modular → Clock.  
Picker adds: Photos, Analog, Flow, Weather, Calendar, Water, Music, Rooms.

---

## 7. Auth & security

**Reject** persistent secrets in the URL (`?token=`).

### v1 LAN auth
1. API generates a one-time **panel pairing code** (or QR) from Settings on a trusted device.
2. iPad opens app → enters code once → receives **HttpOnly session cookie** (or secure storage token) bound to `panelId`.
3. WebSocket must authenticate (same session) + validate Origin.
4. Catalyst bridge: **localhost only**.
5. Rate-limit actions; validate payloads.
6. **Action log** (who/panel, device, action, result, time).
7. Sensitive actions (Yale **unlock**): confirmation modal; optional PIN later.
8. Cloud credentials: file mode `600` or Keychain.
9. TLS: prefer `mkcert` local CA on Mac + trust on iPad, **or** Tailscale Serve. HTTP allowed only on trusted LAN during early phases, with session auth still required.
10. Future CloudFront / remote: only via authenticated tunnel or reverse proxy to API — never raw bridge ports. Document the hook; don’t build CDN in Phase 0–2.

---

## 8. Mac process reliability

Validate and document:
- Boot → `launchd` starts API
- Catalyst bridge auto-launch (Login Item) + HomeKit auth persistence
- Coexist with Homebridge (ports, CPU)
- Sleep/wake recovery (re-subscribe HomeKit + reconnect adapters)
- Network blips; WS reconnect with backoff
- API crash restart; per-adapter circuit breakers
- User logout implications (LaunchAgents vs daemons)

---

## 9. API surface (minimum)

```
GET  /api/health
POST /api/auth/pair          # one-time code → session
POST /api/auth/logout

GET  /api/rooms
GET  /api/devices
GET  /api/devices/:id
POST /api/devices/:id/actions

GET  /api/panel/config?panelId=
PUT  /api/panel/config?panelId=

GET  /api/weather
GET  /api/calendar/upcoming
GET  /api/photos/random

WS   /ws                     # authed; device.updated events
```

Bridge (localhost): homes/rooms/accessories/characteristics/scenes as needed; API normalizes.

---

## 10. Implementation phases (risk-first)

### Phase 0 — HomeKit proof of concept (NO frontend)
- Create/sign Catalyst bridge in Xcode; verify entitlements/provisioning empirically (§4.2).
- Discover rooms/accessories.
- **Required demo:** read/write Hue, Kasa, Hunter fan via bridge (test UI or localhost HTTP on the bridge).
- Also validate (non-blocking for first demo): scene execute, live characteristic notifications, restart + sleep/wake.
- **Gate:** Phase 0 blocking controls work. Stop and report. Do not build React yet.

### Phase 1 — Backend API + browser control of the same devices
- Fastify API proxies localhost bridge; device registry; session auth; WebSocket.
- Thin browser page (even a single debug view is fine) that toggles the same Hue / Kasa / Hunter fan through the API.
- **Gate:** browser → API → bridge → real devices. Only after this, invest in Rehome faces.
- Clock face / swipe shell may start here but must not delay the API control proof.

### Phase 2 — Full HomeKit integration
- Lights, plugs, fans, locks (confirm unlock), scenes, Homebridge accessories.
- Rooms; characteristic-driven controls; dedupe; stale/online handling.

### Phase 3 — Entertainment (core)
- Sonos.
- Apple TV + HomePod via pyatv (best-effort).
- Backlog (separate later): Samsung, Fire TV ADB, Pioneer VSX-934.

### Phase 4 — Rachio SHVK001 + Nest SDM
- Hose timer base station/valve poll + start/stop + lastUpdated.
- Nest OAuth, thermostat, optional Nest cam WebRTC.

### Phase 5 — Ring + specialty
- Validate Ring access; one-cam live; then multi-cam face with session teardown.
- Dreo direct only if needed; Miko spike.

### Phase 6 — Dashboard polish + remote hook
- Ambient faces (weather/calendar/photos), night mode, monitoring, error recovery.
- Optional authenticated remote access design (CloudFront/tunnel) — LAN remains default.

---

## 11. Testing

### Phase 0 manual gate
**Blocking demo:**
- [ ] Hue read + toggle (via bridge, not React)
- [ ] Kasa toggle
- [ ] Hunter fan control
- [ ] Zero pairing changes in Home app
- [ ] Signing/entitlements path documented from actual Xcode result

**Should validate before Phase 1 (non-blocking for first demo):**
- [ ] Scene execute
- [ ] Update when changed from Apple Home app
- [ ] Restart bridge; still authorized; still controls
- [ ] Sleep/wake; subscriptions recover

### Phase 1 manual gate
- [ ] Same Hue / Kasa / Hunter fan controllable from a browser via the API

### Ongoing
- Adapter isolation: kill Nest creds → HomeKit still works
- Ring: stream starts on open, stops on leave; timeout UI
- Lock: unlock requires confirm
- Command timeout + error toast
- iPad Safari WebSocket + one WebRTC cam

---

## 12. Repo layout

```
home-dashboard/
  README.md
  docs/
    nest-setup.md
    ring-setup.md
    homekit-bridge.md
    rachio-shvk001.md
  apps/
    web/
    api/
  bridge/          # Catalyst project or submodule notes
  data/            # panel configs, photos (gitignored secrets)
  .env.example
```

`.env.example` (no secrets in git):
```
PORT=8787
BIND_HOST=0.0.0.0
SESSION_SECRET=
HOMEKIT_BRIDGE_URL=http://127.0.0.1:8080
RACHIO_API_KEY=
SONOS_ENABLED=true
PYATV_ENABLED=true
NEST_CLIENT_ID=
NEST_CLIENT_SECRET=
NEST_PROJECT_ID=
NEST_REDIRECT_URI=
RING_MODE=disabled
PHOTOS_DIR=./data/photos
CALENDAR_ICS_URL=
WEATHER_LAT=
WEATHER_LON=
```

---

## 13. Prompt starter for the building Cursor

```text
Build from this Home Local Dashboard tech spec in a NEW empty folder/repo named home-dashboard.
Ignore any Agora/calculator repo context — irrelevant.

Hard rules:
- Do NOT install Home Assistant or re-pair any HomeKit/Homebridge devices.
- Dashboard is an extra controller beside Apple Home.
- Phase 0 FIRST: Catalyst HomeKit bridge only (no React). Required demo = Hue + Kasa + Hunter fan. Scenes + live notifications = validate but non-blocking for that first demo. Verify signing/entitlements in Xcode; do not assume Developer ID vs other provisioning outcomes before testing.
- Phase 1: Fastify API + browser controls those same devices. Then faces/UX.
- Later: session auth, Rehome-like iPad faces, Sonos + pyatv, Rachio SHVK001, Nest SDM, Ring on-demand streams.
- Samsung/Fire/Pioneer/Miko/myQ are backlog/deferred unless asked.
- Do not expand scope. Prefer working integration over polished UI early.
```

---

## 14. Success definition

**Gate A (Phase 0):** Catalyst bridge controls existing Hue, Kasa, and HomeKit Hunter fan with no pairing changes (no React required).

**Gate B (Phase 1):** Browser controls those same devices through the API → bridge.

**Gate C (usable wall panel):** iPad PWA swipes faces; rooms/scenes; Sonos; Rachio SHVK001; Nest; on-demand cameras; ambient/night; adapters fail independently; no HA required.
