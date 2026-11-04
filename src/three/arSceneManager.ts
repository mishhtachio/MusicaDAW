import * as THREE from 'three';
import {
  createProceduralCharacter,
  updateCharacterIdle,
  type CharacterRig,
} from './proceduralCharacter';
import {
  loadGLBCharacter,
  instantiateGLBCharacter,
  type LoadedGLBCharacter,
  type GLBCharacterInstance,
} from './glbCharacterLoader';

export interface ARCharacterInstance {
  key: string;
  rig?: CharacterRig;
  glbInstance?: GLBCharacterInstance;
  platform?: THREE.Group;
  subScene: THREE.Scene;
  currentPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  currentRadius: number;
  targetRadius: number;
  scaleAlpha: number;
}

export interface ARSceneManager {
  render: (activePositions: Map<string, { x: number; y: number; radiusPx: number }>) => void;
  clear: () => void;
  dispose: () => void;
  handleResize: (width: number, height: number) => void;
  setDebug: (enabled: boolean) => void;
}

/**
 * AR Three.js Scene Manager for rendering procedural 3D characters directly over physical tiles.
 *
 * Perspective Camera Setup:
 * Matched to the exact steep top-down overhead perspective from CharacterDemo:
 * - Camera is positioned at a steep forward angle (~71.7° elevation above horizon, phi = 0.32 rad).
 * - Looking down at the character:
 *   - The large rounded dome of the amber/orange beanie cap is prominent at the top.
 *   - The shiny eyes with white specular highlight dots and mouth peek out cleanly beneath the cap brim.
 *   - The sky-blue torso with 2 white buttons and belt are centered.
 *   - The coral-red sneakers rest grounded directly at the physical tile center (NDC y = -0.2104).
 * - Uses Three.js Scissor & Viewport test per detected tile:
 *   - Renders each character in isolated perspective space with zero off-axis distortion.
 *   - 100% transparent background outside the character geometry.
 */
export function createARSceneManager(
  canvas: HTMLCanvasElement,
  initialWidth: number,
  initialHeight: number
): ARSceneManager {
  // 1. Perspective camera with identical focal parameters to CharacterDemo
  const camera = new THREE.PerspectiveCamera(45, 1.0, 0.1, 50);

  // Steep top-down overhead perspective matching media_1793477004321_db879e6f.png:
  // phi = 0.32 rad (~18.3° from vertical Y-axis, 71.7° above the table plane)
  // Target set to y=1.15 with distance 4.2 gives generous headroom so the beanie cap & pompom
  // have full clearance and are never clipped by the viewport/scissor bounds.
  const phi = 0.32;
  const camDistance = 4.2;
  const camY = camDistance * Math.cos(phi) + 0.40; // ~ 4.38
  const camZ = camDistance * Math.sin(phi);        // ~ 1.32
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, 1.15, 0);
  camera.updateMatrixWorld();

  // 2. WebGL Renderer with alpha transparency and soft shadow capability
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0); // 100% transparent background
  renderer.autoClear = false;
  renderer.setSize(initialWidth, initialHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Pool of active character instances mapped by cellKey ('row-col')
  const characters = new Map<string, ARCharacterInstance>();
  const clock = new THREE.Clock();

  let masterGLB: LoadedGLBCharacter | null = null;
  loadGLBCharacter().then((loaded) => {
    masterGLB = loaded;
  });

  let width = initialWidth;
  let height = initialHeight;

  function createInstance(key: string, initialPos: { x: number; y: number; radiusPx: number }): ARCharacterInstance {
    const subScene = new THREE.Scene();

    // Studio lighting matching CharacterDemo
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 1.4);
    hemiLight.position.set(0, 20, 0);
    subScene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
    mainLight.position.set(3, 5, 4);
    subScene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    fillLight.position.set(-3, 3, -2);
    subScene.add(fillLight);

    let rig: CharacterRig | undefined;
    let glbInstance: GLBCharacterInstance | undefined;
    let platform: THREE.Group | undefined;

    if (masterGLB) {
      glbInstance = instantiateGLBCharacter(masterGLB);
      subScene.add(glbInstance.root);
    } else {
      const proc = createProceduralCharacter({ includePlatform: false });
      rig = proc.rig;
      platform = proc.platform;
      subScene.add(platform);
      subScene.add(rig.root);
    }

    return {
      key,
      rig,
      glbInstance,
      platform,
      subScene,
      currentPos: { x: initialPos.x, y: initialPos.y },
      targetPos: { x: initialPos.x, y: initialPos.y },
      currentRadius: initialPos.radiusPx,
      targetRadius: initialPos.radiusPx,
      scaleAlpha: 0.05, // Pop-in transition
    };
  }

  function handleResize(newWidth: number, newHeight: number) {
    width = newWidth;
    height = newHeight;
    renderer.setSize(width, height);
  }

  function render(activePositions: Map<string, { x: number; y: number; radiusPx: number }>) {
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    const activeKeys = new Set(activePositions.keys());

    // 1. Sync active positions to instances
    for (const [key, pos] of activePositions.entries()) {
      let instance = characters.get(key);
      if (!instance) {
        instance = createInstance(key, pos);
        characters.set(key, instance);
      }
      instance.targetPos.x = pos.x;
      instance.targetPos.y = pos.y;
      instance.targetRadius = pos.radiusPx;
    }

    // 2. Clear full canvas to transparent
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.clear();

    // 3. Render each active character in its isolated perspective viewport
    renderer.setScissorTest(true);

    const keysToDelete: string[] = [];

    for (const [key, instance] of characters.entries()) {
      if (activeKeys.has(key)) {
        // Smooth lerp toward target screen position and size
        instance.currentPos.x += (instance.targetPos.x - instance.currentPos.x) * 0.28;
        instance.currentPos.y += (instance.targetPos.y - instance.currentPos.y) * 0.28;
        instance.currentRadius += (instance.targetRadius - instance.currentRadius) * 0.28;
        instance.scaleAlpha += (1 - instance.scaleAlpha) * 0.22;
      } else {
        // Removed tile shrinks out smoothly
        instance.scaleAlpha += (0 - instance.scaleAlpha) * 0.25;
        if (instance.scaleAlpha < 0.04) {
          keysToDelete.push(key);
          continue;
        }
      }

      // Viewport size scaled to compact miniature toy proportions directly on the physical tile
      const vpSize = Math.round(instance.currentRadius * 1.55 * instance.scaleAlpha);
      if (vpSize <= 4) continue;

      // Feet sole projection alignment:
      // In Three.js window coordinates, (0, 0) is at bottom-left.
      // With our top-down perspective camera, the feet sole is at NDC y = -0.2481,
      // which corresponds to (-0.2481 + 1) / 2 = 0.3760 of the viewport height from the bottom.
      // Top of cap is at NDC y = 0.6143 (0.807 of vpSize), providing generous headroom inside the scissor box.
      const vpX = Math.round(instance.currentPos.x - vpSize * 0.5);
      const vpY = Math.round((height - instance.currentPos.y) - vpSize * 0.3760);

      // Clamp scissor to prevent out-of-bounds rendering
      const scX = Math.max(0, vpX);
      const scY = Math.max(0, vpY);
      const scW = Math.max(0, Math.min(width - scX, vpSize - (scX - vpX)));
      const scH = Math.max(0, Math.min(height - scY, vpSize - (scY - vpY)));

      if (scW <= 0 || scH <= 0) continue;

      renderer.setViewport(vpX, vpY, vpSize, vpSize);
      renderer.setScissor(scX, scY, scW, scH);

      // Animate Blender GLB or Procedural character
      if (instance.glbInstance) {
        instance.glbInstance.update(delta);
      } else if (instance.rig) {
        updateCharacterIdle(instance.rig, elapsed);
      }

      // Render through perspective camera
      renderer.render(instance.subScene, camera);
    }

    renderer.setScissorTest(false);

    // Clean up instances that finished shrinking
    for (const key of keysToDelete) {
      const inst = characters.get(key);
      if (inst) {
        inst.subScene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else if (obj.material) {
              obj.material.dispose();
            }
          }
        });
        characters.delete(key);
      }
    }
  }

  function clear() {
    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.clear();
  }

  function dispose() {
    clear();
    characters.forEach((instance) => {
      instance.subScene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
    });
    characters.clear();
    renderer.dispose();
  }

  function setDebug(_enabled: boolean) {
    // Debug hook if needed
  }

  return {
    render,
    clear,
    dispose,
    handleResize,
    setDebug,
  };
}
