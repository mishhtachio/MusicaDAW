import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface LoadedGLBCharacter {
  gltf: any;
  root: THREE.Group;
  animations: THREE.AnimationClip[];
  clipNames: string[];
}

export interface GLBCharacterInstance {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  currentAction: THREE.AnimationAction | null;
  playAnimation: (name?: string) => void;
  update: (delta: number) => void;
}

// Cached master GLB asset
let cachedGLB: LoadedGLBCharacter | null = null;
let loadPromise: Promise<LoadedGLBCharacter | null> | null = null;

function getCandidatePaths(): string[] {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return [
    `${cleanBase}models/character.glb`,
    `${cleanBase}models/ch1.glb`,
    '/models/character.glb',
    '/models/ch1.glb',
  ];
}

export const CANDIDATE_GLB_PATHS = getCandidatePaths();

/**
 * Checks whether a URL is accessible and is not an HTML 404 rewrite fallback.
 */
async function isValidModelUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-15' } });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      // Vercel SPA rewrite fallback returning index.html for a missing asset
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function tryLoadGLB(loader: GLTFLoader, url: string): Promise<LoadedGLBCharacter | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;

        // Enable shadows on all meshes
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Compute bounding box to normalize height and ground feet at Y = 0
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Target height ~ 0.6 to 1.15 units
        const targetHeight = 0.6;
        const scale = size.y > 0 ? targetHeight / size.y : 1;
        root.scale.set(scale, scale, scale);

        // Ground feet: offset so bottom of bounding box sits at Y = 0
        const bottomY = box.min.y * scale;
        root.position.y = -bottomY;

        // Center horizontally
        root.position.x = -center.x * scale;
        root.position.z = -center.z * scale;

        const container = new THREE.Group();
        container.name = 'GLBCharacterNormalizedContainer';
        container.add(root);

        const animations = gltf.animations || [];
        const clipNames = animations.map((clip) => clip.name);

        const loaded: LoadedGLBCharacter = {
          gltf,
          root: container,
          animations,
          clipNames,
        };

        console.log(`[GLB Loader] Successfully loaded Blender character from '${url}': ${clipNames.length} animations:`, clipNames);
        resolve(loaded);
      },
      undefined,
      (err) => {
        console.warn(`[GLB Loader] Could not parse '${url}':`, err);
        resolve(null);
      }
    );
  });
}

/**
 * Loads and normalizes a Blender .glb export file.
 * Automatically checks candidate paths (e.g. /models/character.glb, /models/ch1.glb).
 * Centers the pivot at the character's feet (Y = 0) and normalizes height.
 */
export async function loadGLBCharacter(specificUrl?: string): Promise<LoadedGLBCharacter | null> {
  if (cachedGLB) return cachedGLB;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const loader = new GLTFLoader();
    const urlsToTry = specificUrl ? [specificUrl] : getCandidatePaths();

    for (const url of urlsToTry) {
      const isValid = await isValidModelUrl(url);
      if (!isValid) continue;

      const result = await tryLoadGLB(loader, url);
      if (result) {
        cachedGLB = result;
        return result;
      }
    }

    console.info('[GLB Loader] No custom Blender model found. Using procedural character fallback.');
    return null;
  })();

  return loadPromise;
}

/**
 * Creates an independent clone of the Blender character with its own
 * AnimationMixer so multiple characters can play on different tiles simultaneously.
 */
export function instantiateGLBCharacter(master: LoadedGLBCharacter): GLBCharacterInstance {
  // SkeletonUtils.clone is required for rigged/skinned character meshes in Three.js
  const clonedRoot = SkeletonUtils.clone(master.root) as THREE.Group;

  let mixer: THREE.AnimationMixer | null = null;
  const actions = new Map<string, THREE.AnimationAction>();
  let currentAction: THREE.AnimationAction | null = null;

  if (master.animations.length > 0) {
    mixer = new THREE.AnimationMixer(clonedRoot);

    for (const clip of master.animations) {
      const action = mixer.clipAction(clip);
      actions.set(clip.name, action);
      // Play all exported actions simultaneously (handles multi-object Blender animations like CurveAction & CurveAction.001)
      action.play();
    }

    const defaultClip =
      master.animations.find((a) => /idle/i.test(a.name)) ||
      master.animations[0];

    if (defaultClip) {
      currentAction = actions.get(defaultClip.name) || null;
    }
  }

  const playAnimation = (name?: string) => {
    if (!mixer) return;
    const targetAction = name ? actions.get(name) : currentAction;
    if (targetAction && targetAction !== currentAction) {
      currentAction?.fadeOut(0.2);
      targetAction.reset().fadeIn(0.2).play();
      currentAction = targetAction;
    }
  };

  const update = (delta: number) => {
    if (mixer) {
      mixer.update(delta);
    }
  };

  return {
    root: clonedRoot,
    mixer,
    actions,
    currentAction,
    playAnimation,
    update,
  };
}
