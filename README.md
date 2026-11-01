# MusicaDAW - Tangible Music Learning & AR Sequencer

**MusicaDAW** (featuring the **Freejam** design system) is a browser-based tangible digital audio workstation (DAW) designed for children and beginners. Users compose music by placing physical tiles on a handmade paper music-roll board. A stationary smartphone camera captures the board in real time, detecting tile shapes and positions to produce synchronized polyphonic Web Audio playback and render animated procedural 3D characters in augmented reality (AR) standing directly on the physical tokens.

---

## ✨ Current Features & Capabilities

### 1. 🎨 Freejam Tactile UI (Figma Design System)
- **Playful Claymorphic Palette:** Cream and butter-yellow backdrop (`#FFF8DC` / `#FDE68A`) with tactile, rounded, friendly UI elements.
- **Top Header:**
  - **Yellow Back/Toggle Button (`←`):** Smoothly flips between the **Camera View** and the **Touch Note Sequencer**.
  - **Title:** Centered bold **"Freejam"**.
  - **Blue Settings Gear (`⚙️`):** Opens the slide-over settings drawer for BPM control, multi-track layering, and board clearing.
- **Instrument Selector Bar:**
  - 4 glossy, bubbly music badges (`♪`) with sheen highlights and active glowing rings.
  - Quick-switch between sound sets with instant audio previews.
- **Center Rounded Viewport Card:**
  - 28px rounded corners with soft drop shadows.
  - Houses either the live camera AR feed or the interactive touch piano roll.
  - Displays a live floating status chip (e.g., *"🎹 4 Circles Active"* or *"🥁 2 Triangles Active"*).
- **Tactile Transport Controls:**
  - **Overlay (`📷`):** One-tap toggle for the 3D procedural AR character.
  - **Play / Pause (`⏸` / `▶`):** Large center golden button with physical press feedback.
  - **Loop (`🔄`):** Restarts and loops playback from Step 1.
- **Bottom Save Pill:**
  - Full-width emerald-teal capsule button (`#2DD4BF`) with checkmark animation on track save.

### 2. 📱 Full Screen Camera & AR Mode (Portrait & Landscape)
- **Corner Reticle Button (`⛶`):** Tapping the top-right corner bracket icon launches full-screen edge-to-edge camera immersion (`100vw \times 100vh`).
- **Responsive Rotation:** Supports both **Portrait** and **Landscape** orientations seamlessly. When rotating your phone sideways to landscape, the 5×4 physical music roll board expands across the wide screen without stretching or distorting the 3D characters.
- **Floating HUD:** Features top-corner exit/minimize controls, 3D AR character toggle, play/pause, and quick track saving.

### 3. 🤖 Procedural 3D Character & AR Scene (Three.js)
- **100% Procedural Geometry:** Built entirely from basic Three.js primitives (spheres, capsules, toruses, cylinders) and standard materials — **zero external assets, Blender files, or GLTF downloads**.
- **Cute Stylized Proportions:** Oversized rounded head, warm amber/orange beanie cap with pompom, shiny cartoon eyes with white specular highlight dots, blushing cheeks, smile, cyan hoodie with white buttons, dark belt, and coral-red sneakers.
- **Harmonic Idle Animation:** Natural sine-wave breathing, subtle knee flexing, curious head tilt, counter-phase arm swinging, and soft pulsing contact shadow under the shoes.
- **Steep Top-Down Perspective:** Overhead perspective projection (\(\phi = 0.32\text{ rad}\), \(\approx 71.7^\circ\) elevation) accurately framed with \(\approx 20\%\) vertical headroom so the beanie cap and pompom are never clipped during bounce.
- **Isolated Viewport & Scissor Rendering:** Each detected physical tile renders in an isolated sub-viewport, eliminating off-axis perspective distortion anywhere on the table and anchoring feet directly to physical tile centers (`NDC y = -0.2481`).

### 4. 🎹 Two-Instrument Physical Sequencer (Piano + Drums)
- **🎹 Piano Mode (Circular Physical Tiles):**
  - Detects circular paper cutouts / sticker tokens.
  - Maps columns 1–4 to time steps.
  - Maps rows 0–4 to melodic pitches: **C6 (1046.5Hz)**, **A5 (880Hz)**, **G5 (784Hz)**, **E5 (659Hz)**, **D5 (587Hz)**.
- **🥁 Drums Mode (Triangular Physical Tiles):**
  - High-precision deterministic triangle detector using Douglas-Peucker polygon approximation, angle verification (\(18^\circ\text{--}144^\circ\)), and convex-hull inscribed triangle area ratio separation (\(\ge 0.85\)).
  - Strictly rejects circles (\(\le 0.45\)) and rectangles (\(\le 0.52\)).
  - Maps rows 0–4 to drum voices:
    - Row 0: **Hi-Hat** (crisp metallic burst)
    - Row 1: **Clap** (multi-burst envelope)
    - Row 2: **Snare** (body tone + noise snap)
    - Row 3: **Tom** (resonant pitch sweep)
    - Row 4: **Kick** (punchy low 150Hz \(\to\) 40Hz drop)

### 5. 🎛️ Multi-Track Arranger & Sound Combiner
- Save separate named tracks for Piano and Drums.
- **Simultaneous Playback:** Layer saved Piano tracks with live or saved Drum tracks on the same synchronized Web Audio clock.
- Dedicated drawer to preview, mute/unmute, and delete tracks, with persistent storage in `localStorage`.

### 6. 👁️ Robust Computer Vision & Board Calibration
- **Closed-Form Projective Homography (\(3 \times 3\) Matrix \(H\)):** Reverses camera perspective tilt and maps the physical handmade notebook page to normalized logical grid coordinates.
- **Corner Marker Detection:** Automatic detection of 4 corner markers:
  - **Color Stickers:** Red (TL), Green (TR), Blue (BR), Yellow (BL).
  - **Dark Dots:** High-contrast drawn black dots.
- **Manual Touch Pins:** Drag any corner handle at any time to fine-tune alignment.
- **Controlled Processing Rate:** Downscaled offscreen canvas processing (~8–10 FPS) prevents audio stutter or UI thread congestion.
- **Temporal Stability & Hand Occlusion Filter:**
  - **3-frame debounce** for adding new notes.
  - **5-frame absorption buffer** for hand occlusion (children reaching over the board will not accidentally delete notes).

---

## 🚀 Installation & Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

To expose the server on your local Wi-Fi network for testing on a phone or tablet:
```bash
npm run dev -- --host
```

### 3. Run Automated Tests
```bash
npm run test
```
Executes all 4 test suites:
- `scripts/verify-logic.mjs`: Audio frequencies, composition models, board expansion.
- `scripts/verify-stage2.mjs`: Projective homography roundtrips, corner sorting, grid mapping.
- `scripts/verify-stage3.mjs`: Circularity scoring, boundary tracing, temporal hand occlusion absorption.
- `scripts/verify-stage4.mjs`: Inscribed triangle fit ratio, circle/square mutual rejection, drum voice mapping, multi-track simultaneous scheduling.

### 4. Build for Production
```bash
npm run build
```

### 5. Code Quality Check
```bash
npx oxlint
```

---

## 📱 Mobile Camera & Setup Instructions

### 1. Camera Permissions & Secure Contexts
Browsers strictly enforce that `navigator.mediaDevices.getUserMedia()` is only available in a **Secure Context**:
- `http://localhost:5173` (treated as secure by default).
- `https://...` (production or tunneled domain).
- **Testing on Mobile over Wi-Fi (`http://192.168.x.x:5173`)**:
  Mobile browsers restrict camera access over plain HTTP local IP addresses. To test on a mobile phone:
  - **Option A (Recommended: USB ADB Port Forwarding)**:
    Connect phone via USB with USB debugging enabled, then run:
    ```bash
    adb reverse tcp:5173 tcp:5173
    ```
    Then open `http://localhost:5173` in mobile Chrome (Chrome treats `localhost` as secure!).
  - **Option B (Chrome Flag)**:
    In mobile Chrome, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://<your-pc-ip>:5173`, enable the flag, and relaunch Chrome.

### 2. Board Setup
1. Draw a 5-row × 4-column grid on white paper or cardstock.
2. Mark the 4 outer corners of the note area with colored dots or stickers (Red = TL, Green = TR, Blue = BR, Yellow = BL).
3. Place your phone on a stand or mug facing downward at the board.
4. Open the camera view, tap the **⛶** reticle button for full screen, and place circular tiles for Piano or triangular tiles for Drums!

---

## 🏗️ Architecture & Project Structure

```
DaddyDAW/
├── src/
│   ├── audio/
│   │   ├── audioEngine.ts          # Polyphonic Web Audio synth, drum generators, and multi-track scheduler
│   │   ├── drumMapping.ts          # Drum voices (Hi-Hat, Clap, Snare, Tom, Kick) and audio synthesis
│   │   └── pitchMapping.ts         # Equal-tempered pentatonic frequencies (C6, A5, G5, E5, D5)
│   ├── camera/
│   │   ├── cameraManager.ts        # getUserMedia stream lifecycle, device enumeration, constraints
│   │   └── markerDetector.ts       # Computer-vision detector for color stickers & dark drawn dots
│   ├── components/
│   │   ├── freejam/
│   │   │   ├── FreejamHeader.tsx        # Yellow mode toggle, Freejam title, blue settings button
│   │   │   ├── FreejamInstrumentBar.tsx # 4 glossy bubbly music note badges
│   │   │   ├── FreejamViewportCard.tsx  # Central rounded yellow card with corner reticle button
│   │   │   ├── FreejamTransport.tsx     # Tactile circular buttons (Overlay, Play/Pause, Loop)
│   │   │   ├── FreejamSaveButton.tsx    # Teal capsule save button
│   │   │   ├── FreejamSettingsDrawer.tsx# Modal sheet for BPM, multi-track mixing, and board reset
│   │   │   └── FreejamFullscreenAR.tsx  # Edge-to-edge AR camera view (portrait & landscape)
│   │   ├── Calibration/
│   │   │   ├── CameraFeed.tsx           # Video container with fallback simulated feed
│   │   │   ├── ARThreeLayer.tsx         # Three.js transparent WebGL overlay layer
│   │   │   ├── CalibrationOverlay.tsx   # Interactive SVG grid lines, corner pins, and tile markers
│   │   │   └── CalibrationScreen.tsx    # Calibration controller coordinating camera, vision, and AR
│   │   ├── PianoRoll.tsx                # Interactive touch note roll
│   │   └── TrackManager.tsx             # Multi-track library and layer arranger
│   ├── geometry/
│   │   └── perspectiveTransform.ts      # Closed-form 3x3 projective homography & coordinate transformations
│   ├── hooks/
│   │   ├── useAudioEngine.ts            # React hook for audio playback and multi-track synthesis
│   │   ├── useCamera.ts                 # React hook for camera stream access
│   │   └── useTileDetection.ts          # React hook connecting vision detections to composition model
│   ├── three/
│   │   ├── arSceneManager.ts            # Isolated viewport/scissor Three.js AR manager with overhead perspective
│   │   ├── characterScene.ts            # Character scene runner and lighting
│   │   └── proceduralCharacter.ts       # Pure Three.js procedural humanoid geometry and idle animation
│   ├── vision/
│   │   ├── tileDetector.ts              # Deterministic color segmentation and circular tile detection
│   │   ├── triangleDetector.ts          # High-precision inscribed triangle fit & polygon approximation
│   │   └── temporalStability.ts         # Temporal debouncer and hand occlusion absorption state machine
│   ├── styles/
│   │   └── freejam.css                  # Freejam design system styles & fullscreen responsive rules
│   ├── App.tsx                          # Root application component
│   └── main.tsx                         # React 18 DOM mount point
├── scripts/                             # Automated test scripts (Stage 1 to Stage 4)
└── README.md                            # Project documentation
```

---

## 📄 License

MIT License. Designed and built with React, Vite, TypeScript, and Three.js.
