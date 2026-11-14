# Home Local Dashboard — Build Handoff Spec

> **For the building agent:** Greenfield only. Create a **new empty repo or folder** named `home-dashboard/`. Do **not** use or modify any Agora Pricing Calculator files — that repo is unrelated; this markdown may have been temporarily hosted there by mistake. Prefer working vertical slices. **First milestone is HomeKit control from a browser, not a pretty UI.**

**Goal:** A Mac-hosted **iPad wall-panel website** (Safari / Add to Home Screen) that feels like a Rehome-style multi-face Apple Home view, while acting as an **additional controller** beside Apple Home — **no re-pairing and no migration** of existing HomeKit/Homebridge devices. **Home Assistant is optional** on the same Mac (alongside Homebridge + Plex) as an **integration provider** to reuse mature vendor integrations — not as the dashboard hub and not as a replacement for Apple Home.

**UX reference:** [Rehome faces](https://userehome.com/pages/app) — swipeable full-screen faces, large tiles, ambient modes. Copy the **interaction model**; HA is a backend provider only (user never lives in HA’s UI for this project).

**Architecture:** iPad Safari → authenticated Fastify API + normalized registry on always-on Mac → **HomeKit Catalyst bridge** (existing Apple Home accessories) + **Home Assistant adapter** (Sonos, Plex, Apple TV, Rachio, Nest, TVs, consoles, … when HA covers them) + **direct adapters only** when HA cannot meet the need. Frontend never talks to HA or HomeKit directly. Secrets stay on the Mac. Cameras stream only on demand.

**Tech stack:**
- **UI:** Vite + React + TypeScript; iPad-first landscape; Safari PWA
- **API:** Node.js + TypeScript + Fastify (preferred)
- **HomeKit:** Mac Catalyst app with HomeKit entitlement (or proven open-source Catalyst bridge) on localhost only
- **Home Assistant (optional):** runs independently on Mac; dashboard uses HA REST + WebSocket APIs via long-lived access token
- **Direct fallbacks:** only when HA lacks required capability (e.g. Ring live WebRTC gap) — evaluate HA first for Sonos, Plex, Apple TV, Rachio, Nest before writing custom adapters
- **Realtime:** WebSocket with auth (API fans out HomeKit + HA state)
- **Process:** `launchd` for API (+ HA if used); Login Item for Catalyst GUI app; coexist with Homebridge + Plex

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
| Apple TV / HomePod via pyatv (not HomeKit API) | **Superseded — evaluate HA first** | Custom pyatv only if HA Apple TV integration has a capability gap |
| Sonos local API | **Superseded — evaluate HA first** | Prefer HA Sonos; SoCo direct only if needed |
| Samsung / Fire / Pioneer / Xbox | **Via HA when possible** | Xbox before PS5; PS5 optional/community |
| Plex (already on Mac) | **Accept via HA** | Active sessions / now playing on media face |
| Miko smart valve | **Investigate later** | After core HA integrations |
| myQ garage | **Explicitly deferred** | Cloud integrations restricted |
| Ring: validate OAuth + one camera before multi-cam UI | **Accept** | Try HA Ring first; keep direct if live view insufficient |
| Rachio SHVK001 | **Evaluate HA Rachio first** | Else Smart Hose Timer cloud API |
| Nest | **Evaluate HA Nest (SDM) first** | Else direct SDM; never Homebridge Nest plugins |
| Optional HA as provider (not hub) | **Accept (addendum)** | Reuse integrations; do not import/re-pair HomeKit devices into HA |
| Unified rooms (HK + HA tiles together) | **Accept** | Apple Home rooms primary; simple entity→room map |
| Replace `?token=` URL auth with panel pairing + sessions | **Accept** | See §7 |
| HTTPS on LAN | **Accept as target** | `mkcert` or Tailscale Serve; don’t block Phase 0 on TLS |
| CloudFront remote access | **Design hook only** | LAN first |
| Richer device model (stale/online/writable/dedupe) | **Accept** | See §3 |
| Mac sleep/wake + Homebridge + Plex + HA coexistence | **Accept** | See §8 |
| Keep Rehome-like faces UX | **Accept** | After HomeKit POC |
| Expand Phase 0 for HA | **Reject** | Phase 0 stays Catalyst HomeKit only |

**First acceptance milestones (do not skip ahead to UI polish):**
- **Phase 0 gate:** Catalyst bridge alone can discover and control existing **Hue**, **Kasa**, and **native HomeKit Hunter fan** (no pairing changes). Prove this with the bridge’s own minimal test UI, unit harness, or localhost curl against the bridge — **not** the React dashboard.
- **Phase 1 gate:** Browser talks to the Fastify API, which proxies the bridge, and controls those **same** devices. Only then invest in faces/UX.

Scene execution and live characteristic notifications should still be validated during Phase 0, but they are **non-blocking** for the first accessory-control demo (Hue + Kasa + Hunter fan is enough to prove feasibility).

---

## 1. Product requirements

### 1.1 Hard constraints
1. **No re-pairing / resetting / migrating** existing HomeKit or Homebridge devices.
2. **Do not use HA to import existing HomeKit accessories** if that changes their pairing. HA is for devices/services **not** already owned by the Catalyst HomeKit path.
3. Dashboard is an **additional controller** alongside Apple Home — one cohesive UI, not “HomeKit app + HA app.”
4. Prefer HomeKit when a device is already in Apple Home; avoid duplicate tiles.
5. For non-HomeKit devices: **HomeKit? → else HA integration? → else direct adapter** (see §4A).
6. Secrets stay on the Mac backend — never in the browser. Frontend must not connect to HA or HomeKit directly.
7. Do not expose the Catalyst bridge (or raw HA) to the public internet.
8. **Phase 0 unchanged** — Catalyst HomeKit POC only; no HA work in Phase 0.

### 1.2 Must have (core)
1. HomeKit discovery/control for existing Apple Home accessories (Phase 0–2).
2. Control existing: Hue, Kasa, Hunter (native HomeKit), Bond/Hunter via Homebridge, Yale lock (with confirm), other Homebridge accessories, Dreo if already in HomeKit.
3. iPad wall-panel UX: swipeable faces, large taps, face picker, Add to Home Screen.
4. **Unified rooms:** HomeKit + HA devices on the **same** room faces (simple configurable HA entity → Apple Home room map).
5. Optional HA adapter + evaluate HA for: Sonos, Plex, Apple TV, Rachio SHVK001, Nest, Samsung/SmartThings, Xbox (PS5 optional).
6. Direct adapters only for meaningful HA capability gaps (especially Ring live view if HA is insufficient).
7. Ambient: clock, weather, calendar, photos, night/flow (non-blocking).
8. Per-adapter health; HA down must not break HomeKit controls (and vice versa).

### 1.3 Explicit non-goals (v1)
- Replacing Apple Home or requiring HA for lights/plugs already in HomeKit.
- Building dashboards/automations inside HA UI (HA is a backend integration host).
- Elaborate bi-directional room sync — simple persistent mapping is enough.
- Homebridge Nest plugins.
- myQ garage.
- Assuming HomePods/Apple TVs appear in `HMHome.accessories`.
- Polished UI before Phase 0 HomeKit proof.
- Implementing every HA integration at once.

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

#### B. Entertainment / media (prefer HA; not public HomeKit accessory API)
| Device | Preferred path | Fallback | Priority |
|---|---|---|---|
| Sonos | **HA Sonos** | Direct SoCo | First HA demo candidate |
| Plex Media Server (on Mac) | **HA Plex** | Direct Plex API | First HA demo candidate |
| Apple TV | **HA Apple TV** | Direct pyatv | Evaluate HA before custom |
| HomePod | HA / pyatv best-effort | — | Limited; degrade gracefully |
| Samsung TV | **HA SmartThings / Samsung** | Direct | After Sonos/Plex proof |
| Xbox Series X | **HA Xbox** | — | Before PS5 |
| PlayStation 5 | Community HA (optional) | — | Optional if reliable |
| Fire TV | HA ADB | — | Later |
| Pioneer VSX-934 | HA Pioneer/Onkyo | Direct network | Later |

#### C. Cloud / specialty
| Device | Preferred path | Fallback | Notes |
|---|---|---|---|
| Ring cameras | Evaluate **HA Ring** | Direct Partner/unofficial | Do not assume HA gives unrestricted WebRTC live |
| Google Nest | Evaluate **HA Nest (SDM)** | Direct SDM OAuth | No Homebridge Nest plugins |
| Rachio SHVK001 | Evaluate **HA Rachio** | Smart Hose Timer cloud API | Hose timer, not classic zones |
| Bond / Dreo | Prefer existing **HomeKit** | HA only if extra value | Avoid duplicate tiles |
| Miko | Investigate later | — | After core |
| myQ | — | — | **Deferred** |

---

## 2. System architecture

```
┌────────────────────────────────────────────────────────────┐
│ iPad Safari PWA  (paired panel session — not ?token= URL)  │
│ ONE UI: rooms mix HomeKit + HA tiles (provider hidden)     │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTPS or HTTP+session (LAN)
┌────────────────────────▼───────────────────────────────────┐
│ home-dashboard-api (Fastify)  launchd on Mac               │
│ registry · room map · auth · ws · adapters · action log    │
└──┬───────────────────────┬───────────────────┬─────────────┘
   │                       │                   │
   ▼                       ▼                   ▼
HomeKit Catalyst      Home Assistant      Direct (only if
localhost only        REST + WS API       HA capability gap)
(existing Home +      (Sonos, Plex, ATV,  e.g. Ring live
 Homebridge devices)  Rachio, Nest, TV,   WebRTC if needed
                      Xbox, …)
```

Mac already runs **Homebridge** + **Plex**; HA (if enabled) runs alongside — different ports; don’t fight them.

---

## 3. Normalized device model

```ts
export type Provider =
  | "homekit"
  | "homeassistant"
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
- **Apple Home rooms** = primary room definitions for the dashboard.
- Map HA entities into those rooms via simple persistent config (`data/ha-room-map.json`); no elaborate sync.
- Deduplicate when the same physical device appears twice (**prefer HomeKit**).
- UI hides provider in normal tiles; show provider only in diagnostics/detail.
- UI must not show stale state as “live” without a stale badge (`availability: "stale"` if `now - lastSeenAt > threshold`).
- Optimistic UI allowed, but **reconcile** from `ActionResult.confirmed` / subsequent events.
- Unsupported commands → clear error, not silent no-op.
- HomeKit: real characteristic metadata + permissions.
- HA: capabilities from entity domain + `supported_features` / available services — never assume every `media_player` can pause, etc.

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

## 4A. Integration selection rules (reduce custom work)

For each device/service:

1. Already works via **Catalyst HomeKit bridge**? → use that; do not also expose via HA.
2. Else, does **Home Assistant** provide a reliable integration with the needed controls? → use HA adapter.
3. Else, implement a **direct** manufacturer adapter only for a clear capability gap.
4. Never require re-pairing Apple Home devices.
5. HA HomeKit Bridge (exposing HA into Apple Home) is **out of scope** for now — optional future evaluation only.

**Clear “evaluate HA before writing custom” list:** Sonos, Plex, Apple TV, Rachio SHVK001, Nest.  
**Consoles:** Xbox first (established HA); PS5 optional/community.  
**Ring:** evaluate HA for status/events/snapshots; keep direct path if live video is insufficient.

This addendum should **simplify** the project (fewer custom APIs), not enlarge Phase 0 or invent a second dashboard.

---

## 4B. Home Assistant adapter (optional provider)

### 4B.1 Role
HA runs independently on the Mac next to Homebridge + Plex. Dashboard Fastify adapter uses:
- HA **REST API** (states, services)
- HA **WebSocket API** (live state changes)

Auth: **long-lived access token** stored on Mac backend (`600` file or Keychain).

### 4B.2 Adapter responsibilities
- Connection config + health + reconnect
- Entity discovery / state fetch / WS subscriptions
- Service/action calls for supported features only
- Entity → Apple Home room mapping (simple JSON)
- Normalize into existing `Device` model (`provider: "homeassistant"`)
- Domain mapping examples (derive real caps from features):
  - `light` → lighting
  - `switch` → on/off
  - `fan` → fan
  - `media_player` → entertainment
  - `climate` → thermostat
  - `camera` → camera (no assumed unrestricted WebRTC)
  - `sensor` / `binary_sensor` → status
  - `button` → actions

### 4B.3 Unified rooms (required)
Example Living Room face (illustrative, not placement assumptions):
- Hue / Kasa / Hunter → HomeKit
- Sonos / Apple TV / Samsung / Xbox / Plex session → HA

One room UI. No provider switcher. Provider visible only in diagnostics.

Config sketch:
```json
{
  "media_player.living_room_sonos": { "roomId": "<homekit-room-uuid>", "roomName": "Living Room" },
  "media_player.plex_plex_for_samsung_tv": { "roomId": "<…>", "roomName": "Living Room" }
}
```

### 4B.4 First HA success demo (after Phase 0–1 HomeKit)
1. Install/configure HA on Mac (Docker or native) — do not disturb Homebridge/Plex.
2. Enable Sonos **or** Plex integration in HA.
3. Wire HA adapter + room map.
4. Show **HomeKit tile + HA tile on the same room page**, both controllable via unified API.
5. Kill HA → HomeKit still works.

### 4B.5 Non-goals for HA layer
- Do not rebuild Lovelace as the product UI.
- Do not migrate HomeKit devices into HA.
- Do not enable every integration at once.

---

## 5. Adapter notes (HA-first, then direct)

### 5.1 Sonos
**Prefer HA Sonos.** Direct SoCo only if HA lacks needed controls. Browser never speaks UPnP.

### 5.2 Plex
**Prefer HA Plex** (server already on Mac): active sessions, now playing, device, basic transport where supported.

### 5.3 Apple TV / HomePod
**Evaluate HA Apple TV before custom pyatv.** HomePod best-effort; degrade gracefully.

### 5.4 Rachio SHVK001
**Evaluate HA Rachio first.** Else Smart Hose Timer cloud API (`listBaseStations`, `listValves`, `startWatering`, `stopWatering`). Show last successful update; valve state can lag.

### 5.5 Nest
**Evaluate HA Nest (official SDM path) before** implementing custom SDM OAuth in our API. If HA works, Nest is just HA entities. If not, direct SDM with prior setup caveats (consumer Google account, $5 Device Access, project UUID ≠ GCP id). Never Homebridge Nest plugins.

### 5.6 Ring
Evaluate HA Ring for status/events/snapshots. **Do not assume** HA provides unrestricted live WebRTC. Keep direct Partner/unofficial path for on-demand live view if needed. One-cam proof before multi-cam; tear down on leave.

### 5.7 Samsung / Xbox / Fire / Pioneer / PS5
Via HA when available. **Xbox before PS5.** PS5 optional. Pioneer via HA Onkyo/Pioneer if adequate.

### 5.8 Dreo / Bond / Miko
Prefer HomeKit/Homebridge. HA only for extra value. Miko after core. myQ deferred.

---

## 6. iPad UX (Rehome-style) — after Phase 0

Keep:
- Swipeable full-screen faces + face picker per `panelId`
- Large one-tap tiles; **unified room views** (HomeKit + HA tiles together, provider hidden)
- Camera face; music/media (Sonos/Plex/ATV); clock/weather/calendar/photos; night mode
- Safari Add to Home Screen; adapter health badges
- Frontend protocol-agnostic (only talks to normalized API — never HA or HomeKit directly)

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
- Coexist with Homebridge + Plex + optional HA (ports, CPU)
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
- Thin browser page that toggles the same Hue / Kasa / Hunter fan through the API.
- **Gate:** browser → API → bridge → real devices.
- Clock / swipe shell may start but must not delay this proof. **Still no HA required here.**

### Phase 2 — Full HomeKit integration + room UI foundation
- Lights, plugs, fans, locks (confirm unlock), scenes, Homebridge accessories.
- Rooms; characteristic-driven controls; dedupe; stale/online handling.
- Rehome-like faces for HomeKit-only rooms first.

### Phase 3 — Optional Home Assistant adapter + first unified-room demo
- Install HA alongside Homebridge + Plex (document ports).
- Implement `homeassistant` provider (REST + WS, long-lived token).
- Simple entity→room map.
- Enable **Sonos or Plex** in HA first.
- **Gate:** same room page shows HomeKit device + HA device; both work via unified API; HA down ≠ HomeKit down.
- Then evaluate HA for Apple TV, Rachio, Nest **before** writing custom adapters for those.

### Phase 4 — Expand via HA (prefer) / direct (gap only)
- Apple TV, Rachio SHVK001, Nest via HA if adequate; else direct.
- Samsung / Xbox (PS5 optional) via HA.
- Entertainment / media faces using normalized devices.

### Phase 5 — Ring + specialty
- HA Ring evaluation; direct live view if needed; one-cam then multi-cam with teardown.
- Dreo/Miko only if still needed.

### Phase 6 — Dashboard polish + remote hook
- Ambient faces, night mode, monitoring, error recovery.
- Optional authenticated remote access design — LAN remains default.

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

# Optional HA provider (after Phase 0–1)
HOME_ASSISTANT_URL=http://127.0.0.1:8123
HOME_ASSISTANT_TOKEN=
HOME_ASSISTANT_ENABLED=false

# Direct fallbacks — only if HA cannot meet the need
RACHIO_API_KEY=
SONOS_DIRECT_ENABLED=false
PYATV_DIRECT_ENABLED=false
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
- Do NOT re-pair or migrate any HomeKit/Homebridge devices. Do NOT import those into HA.
- Dashboard is one cohesive UI (extra controller beside Apple Home).
- Phase 0 FIRST: Catalyst HomeKit bridge only (no React, no HA). Required demo = Hue + Kasa + Hunter fan. Scenes + live notifications = non-blocking for first demo. Verify signing in Xcode empirically.
- Phase 1: Fastify API + browser controls those same devices.
- Phase 2: fuller HomeKit rooms/faces.
- Phase 3+: optional Home Assistant as a provider (REST+WS, long-lived token). First HA demo = Sonos or Plex on the SAME room page as HomeKit tiles. Evaluate HA for Apple TV, Rachio, Nest before writing custom adapters. Xbox before PS5. Direct adapters only for real capability gaps (e.g. Ring live view).
- myQ deferred. Do not build HA Lovelace as the product. Prefer fewer custom APIs — this should simplify, not explode scope.
```

---

## 14. Success definition

**Gate A (Phase 0):** Catalyst bridge controls existing Hue, Kasa, and HomeKit Hunter fan with no pairing changes (no React, no HA).

**Gate B (Phase 1):** Browser controls those same devices through the API → bridge.

**Gate C (Phase 3 HA):** HA optional; Sonos or Plex via HA appears on the **same room** as HomeKit tiles; HA outage does not break HomeKit.

**Gate D (usable wall panel):** iPad PWA swipes faces; unified rooms; entertainment/climate/water via HA-first (direct only if needed); on-demand cameras; ambient/night; adapters fail independently.
