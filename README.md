# DaddyDAW - Tangible Music Learning for Children

DaddyDAW is a browser-based tangible music-learning application designed for children. Children compose music by placing physical rectangular tiles on a handmade piano-roll board that a stationary smartphone camera views and augments with synchronized audio playback and visual feedback.

The application contains two integrated modes:
1. **🎹 Manual Sequencer (Stage 1)**: Interactive on-screen piano roll with Web Audio playback and configurable grid dimensions.
2. **📷 Camera Calibration (Stage 2)**: Reusable camera module and 4-corner manual perspective calibration system that maps the physical handmade board to a normalized logical grid.

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

To expose the server on your local Wi-Fi network for mobile phone testing:
```bash
npm run dev -- --host
```

### 3. Run Test Suite
```bash
npm run test
```
Runs both Stage 1 audio/composition tests and Stage 2 perspective homography/geometry tests.

### 4. Build for Production
```bash
npm run build
```

### 5. Code Quality Check
```bash
npm run lint
```

---

## 📷 Stage 2: Camera Access & Calibration Guide

### 1. Camera Permissions & Secure Context Requirements
Browsers strictly enforce that `navigator.mediaDevices.getUserMedia()` is only available in a **Secure Context**:
- `http://localhost:5173` or `http://127.0.0.1:5173` (considered secure by default).
- `https://...` (production or tunneled domain).
- **Mobile LAN testing over HTTP (e.g., `http://192.168.x.x:5173`)**:
  Mobile Chrome blocks camera access on plain HTTP over local IP addresses. To test on an Android phone over local Wi-Fi, use one of the following methods:
  - **Option A (Recommended: ADB Port Forwarding via USB)**:
    Connect your phone via USB with USB debugging enabled, then run:
    ```bash
    adb reverse tcp:5173 tcp:5173
    ```
    Then open `http://localhost:5173` in Android Chrome. Chrome treats localhost as a secure context!
  - **Option B (Chrome Flag)**:
    In Android Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://<your-pc-ip>:5173`, enable the flag, and relaunch Chrome.
  - **Option C (HTTPS via Vite)**:
    Install `@vitejs/plugin-basic-ssl` to serve over HTTPS with a self-signed certificate.

### 2. Physical Board Setup & Stationary Rig
- Position your smartphone on a stationary stand or mug facing downward at the handmade board.
- The physical board is initially 5 rows × 4 columns.
- Ensure adequate lighting with minimal harsh glare.

### 3. Board Calibration & Marker Detection Steps
1. In the app header, tap **📷 Camera Calibration**.
2. Tap **Start Camera** (or **Use Simulated Feed** to test without a physical camera).
3. **5×4 Grid Geometry (Excludes Pitch Column)**:
   - The 4 corner markers belong strictly on the 4 outer corners of the **5-row × 4-column note grid** (Steps 1, 2, 3, 4).
   - The pitch column (`C6`, `A5`, `G5`, `E5`, `D5`) sits to the **left outside** the 4 corners, leaving all 4 columns completely clear for placing note tiles.
4. **Automatic Marker Detection**:
   - **🔴🟢🔵🟡 Color Stickers**: Place 4 colored dot stickers on the 4 corners of the note grid:
     - **Red** = Top-Left
     - **Green** = Top-Right
     - **Blue** = Bottom-Right
     - **Yellow/Orange** = Bottom-Left
   - Tap **⚡ Auto-Detect Markers** or enable **Live Track** to continuously adjust the grid in real-time as you move the board.
   - **⚫ Black Dots**: Alternatively, switch marker type to Black Dots if using dark drawn markers.
5. **Manual Adjustment**:
   - You can drag any of the 4 colored pins (**TL** Red, **TR** Green, **BR** Blue, **BL** Orange) at any time to fine-tune alignment.
6. The perspective homography automatically warps the 5×4 note grid, projects the pitch badges outside on the left, and projects the step numbers (`1`, `2`, `3`, `4`) along the top.
7. Tap **⬅ Return to Manual Roll** to return to the sequencer at any time. All calibrated coordinates remain saved in memory.

---

## 📐 Board Geometry & Architectural Assumptions

- **Non-Uniform, Handmade Board Assumption**:
  Because the physical board is drawn by hand by children or teachers and is not a precision-printed template, automated line detection in camera feeds can be prone to false edges or ink irregularities. As specified, the initial Stage 2 calibration maps the user-defined outer quadrilateral boundary and subdivides it into equal logical cells using a projective homography ($3 \times 3$ matrix $H$).
- **Perspective Distortion Correction**:
  Implemented in `src/geometry/perspectiveTransform.ts` via Paul Heckbert's closed-form quadrilateral projective mapping. It handles perspective foreshortening (where rows or columns closer to the camera lens appear larger than those farther away).
- **Separation of Concerns**:
  - `src/vision/tileDetector.ts`: Deterministic computer-vision tile detector with contour, aspect-ratio, area, and center-to-board mapping.
  - `src/vision/temporalStability.ts`: State machine for temporal debouncing and hand-occlusion absorption.
  - `src/hooks/useTileDetection.ts`: Controlled-rate camera processing hook connecting vision detections to the shared composition model.
  - `src/geometry/perspectiveTransform.ts`: Pure geometric transformation functions (`computeHomography`, `invertMatrix3x3`, `boardToImage`, `imageToBoard`, `pointToCellIndex`). Completely independent of React.
  - `src/camera/cameraManager.ts`: Device enumeration, constraints, error categorization, stream lifecycle.
  - `src/camera/markerDetector.ts`: Real-time corner marker detection for hand-drawn black dots and colored stickers.
  - `src/hooks/useCamera.ts`: Reactive state hook for media streams and mock fallbacks.
  - `src/components/Calibration/`: Responsive SVG overlay with pointer events and camera feed display.

---

## 🎵 Stage 3: Deterministic Physical Tile Detection & Audio Sync

### 1. Detection Strategy & Pipeline
- **Isolated Computer Vision Module (`ITileDetector`)**:
  Implemented in `src/vision/tileDetector.ts` without heavy external WASM dependencies. Runs on an offscreen downscaled canvas (480×360) at a controlled rate (~8 FPS) to prevent UI/audio thread congestion.
- **Pipeline**:
  1. **Foreground Segmentation**: Separates tile materials (color saturation $S \ge 0.22$ or contrast $L < \text{paperLum} - 45$) from white/light paper and black marker grid lines.
  2. **Connected Component Extraction**: Finds non-paper candidate blobs strictly within the calibrated board quad.
  3. **Geometric & Aspect Ratio Filtering**: Discards thin grid strokes (aspect ratio $> 4.2$ or area $< 16\text{px}$) and large hand occlusions.
  4. **Centroid Transformation**: Calculates candidate center $(cx, cy)$ and projects it via inverse homography $H^{-1}$ to board space $(u, v)$.
  5. **Cell & Pitch Mapping**: Resolves nearest row (0 to 4) and column (0 to 3). Maps row $\to$ pitch (`C6`, `A5`, `G5`, `E5`, `D5`) and col $\to$ onset step (1 to 4).
  6. **Conflicting Detections Policy**: If multiple contours map to the same cell, the candidate closest to cell center with highest geometric confidence wins. At most one note occupies a cell.

### 2. Temporal Stability & Hand Occlusion Filter
- **Debounced Addition**: A tile must be consistently observed for **3 consecutive frames** before creating a note.
- **Hand Occlusion Absorption**: When children place or move tiles, their hands temporarily obscure the board. The stability state machine requires **5 consecutive missing frames** (~0.6–0.8s) before a note is removed. A hand passing over a tile will not delete it.

### 3. Audio Clock & Seamless Musical Playback
- Detections update the shared `Composition` model used by both Manual and Camera modes.
- Updates are dispatched directly to `audioEngine.updateComposition(notes)` without restarting or stuttering playback. Notes sound cleanly on the next musical beat boundary.

### 4. Recommended Physical Tile Characteristics
- **Shape**: Rectangular blocks or cardstock tiles with aspect ratio roughly 1.5:1 to 2.5:1.
- **Contrast**: High contrast against white paper (e.g. cyan/turquoise cardstock, magenta, red, blue, green, or foam tiles with high-contrast outlines).
- **Size**: Approximately 30% to 70% of a grid cell.

---

## 🔍 Verification Performed

- **TypeScript Compilation**: Clean build (`tsc -b && vite build`) with zero type errors.
- **Linter**: Zero warnings and zero errors via `oxlint`.
- **Automated Test Suite (`npm run test`)**:
  - `verify-logic.mjs`: Stage 1 pitch frequencies, composition toggling, expandability.
  - `verify-stage2.mjs`: Stage 2 perspective homography roundtrips, corner marker detection, and 5×4 grid boundary tests.
  - `verify-stage3.mjs`:
    - Coordinate-to-cell and cell-to-pitch mapping across all rows and columns.
    - Detection filtering: area thresholds, aspect ratio limits, out-of-bounds rejection.
    - Conflicting detections policy: duplicate candidates in the same cell strictly resolved to highest confidence.
    - Temporal stability state machine: verified 3-frame addition debounce, hand occlusion absorption over 3 missing frames, and 5-frame removal.
- **Dev Server**: Running live with Vite HMR at `http://localhost:5173/` and `http://192.168.137.60:5173/`.

---

## ⚠️ Known Limitations & Setup Advice

- **Lighting**: Ensure even, diffuse lighting across the notebook page. Avoid strong specular glare or direct harsh flashlights which wash out color saturation.
- **Stationary Phone**: The camera phone should be placed on a stationary stand or mug facing downward at the board for reliable continuous tracking.
- **Stage Scope**: Three.js AR 3D model overlays are reserved for future stages. Stage 3 provides real-time SVG augmented feedback and deterministic audio playback directly from physical tiles.
