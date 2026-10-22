# 🚜 Agri-Rover 3D Sandbox

An interactive, browser-based 3D digital twin playground and physical kinematics simulator for autonomous agricultural rovers, directly inspired by the **Microduck Sandbox** (Pollen Robotics / Hugging Face Spaces).

---

## ✨ Features

- **🎮 3D WebGL / Three.js Arena**:
  - Full-fidelity 3D agricultural field with procedural soil furrows, crop rows, boundary fences, and sun shadows.
  - **3D Serpentine Route Ribbon**: Glowing neon trajectory line illustrating the exact path (4 straight lanes + 3 headland turn arcs, following Ospina & Noguchi 2025).
  - **⚽ Interactive Physics Ball**: A dynamic 3D soccer ball in the field that the rover can bump, push, and kick around the arena (just like the Microduck Sandbox ball!).
  - **Dynamic Volumetric Headlights**: Dual front spotlights projecting realistic light beams and shadows.
  - **Wheel Dust Particles**: Puffs of soil kicked up from all 4 wheels when driving and turning.

- **🤖 Procedural Rover Robot**:
  - Articulated steering knuckles (front wheels turn with steering input).
  - Continuous rotating LiDAR scanner dome with laser aperture.
  - Dual GNSS RTK antenna masts and status LEDs.
  - Suspension pitch dynamics (body tilts forward on braking, backward on acceleration).
  - **Dynamic Repaint Palette**: 5 color swatches (Microduck Yellow, Cyber Cyan, Tractor Green, Mars Orange, Carbon Black) that instantly repaint the rover with sound effects.

- **📹 Multi-Mode Camera System**:
  - **Chase Camera (`C`)**: Smoothly tracks behind and above the rover as it navigates turns (default).
  - **Free Orbit Controls**: Drag anywhere with the mouse to detach into free orbit, scroll to zoom in/out.
  - **FPV / Bumper Camera (`V`)**: Front cockpit bumper point of view.
  - **Top-Down Aerial Cam (`T`)**: Orthographic-style bird's-eye view of the full serpentine route.

- **⏱️ Startup Mission Setup & Closed-Loop ETA**:
  - On launch, operator sets the target mission duration in **hours** (with quick presets: `0.5h`, `1.0h`, `1.5h`, `2.0h`).
  - Rover starts stopped and auto-scales nominal cruising speed so the route completes within the user's ETA.
  - Real-time countdown timer, route completion bar, and schedule drift ($\Delta T$) meter.

- **🔊 Web Audio API Synthesizer (Zero External Audio Files)**:
  - Electric motor hum pitch-shifting and filtering dynamically with wheel speed.
  - Robotic quack / horn buzzer (`H` key).
  - Mechanical UI button clicks and mission launch chimes.
  - Ball collision thumps and tire braking chirps.
  - Sound mute / unmute toggle.

- **📟 BIOS Boot Terminal ("Honest Loader")**:
  - Microduck-style diagnostic loader console displaying live subsystem initialization checks before entering the 3D scene.
  - Launch directly into BIOS loader using the `?boot=1` URL query parameter.

- **⚡ Live Backend Sync or 100% Standalone**:
  - Automatically attempts to connect to `ws://localhost:8000/ws/dashboard` to sync real-time telemetry with the FastAPI backend.
  - If the backend is offline, runs 100% in client-side simulation mode with zero errors.

---

## ⌨️ Controls & Shortcuts

| Key | Action |
| --- | --- |
| **W / Up Arrow** | Accelerate forward |
| **S / Down Arrow** | Reverse |
| **A / Left Arrow** | Steer left |
| **D / Right Arrow** | Steer right |
| **Space** | Handbrake / Emergency Stop |
| **Shift** | Speed boost |
| **C** | Toggle Chase Camera |
| **V** | Cockpit / FPV Camera |
| **T** | Top-Down Aerial Camera |
| **M** | Toggle Mode (Autonomous ↔ Manual) |
| **H** | Quack / Horn |
| **R** | Reset route & reopen Mission Setup modal |
| **Mouse Drag** | Free Orbit Camera |
| **Mouse Scroll** | Zoom In / Out |

---

## 🚀 Running the Simulator

Inside this directory (`rover-simulator-sandbox`):

```bash
# 1. Install dependencies (already installed)
npm install

# 2. Start the Vite development server
npm run dev
```

Open your browser at:
```
http://localhost:5174
```

Or open directly with the BIOS loader:
```
http://localhost:5174/?boot=1
```
