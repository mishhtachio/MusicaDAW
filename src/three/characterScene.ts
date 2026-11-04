import * as THREE from 'three';
import {
  createProceduralCharacter,
  updateCharacterIdle,
  resetCharacterPose,
  type CharacterRig,
} from './proceduralCharacter';
import {
  loadGLBCharacter,
  instantiateGLBCharacter,
  type GLBCharacterInstance,
} from './glbCharacterLoader';

export interface SceneController {
  canvas: HTMLCanvasElement;
  rig: CharacterRig;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
  dispose: () => void;
  handleResize: () => void;
}

export function initProceduralCharacterScene(container: HTMLElement): SceneController {
  // 1. Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // Elegant dark slate backdrop

  // Optional subtle atmospheric fog
  scene.fog = new THREE.FogExp2(0x0f172a, 0.08);

  // 2. Camera setup
  const aspect = container.clientWidth / container.clientHeight || 1;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 50);
  camera.position.set(0, 1.4, 4.2);
  camera.lookAt(0, 1.0, 0);

  // 3. Renderer setup
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  // 4. Lighting setup (Soft, studio toy lighting)
  const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 1.4);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
  mainLight.position.set(3, 5, 4);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 15;
  mainLight.shadow.bias = -0.001;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
  fillLight.position.set(-3, 3, -2);
  scene.add(fillLight);

  // 5. Build procedural character & platform (with automatic Blender .glb enhancement)
  const { rig, platform } = createProceduralCharacter();
  scene.add(platform);
  scene.add(rig.root);

  let glbInstance: GLBCharacterInstance | null = null;
  loadGLBCharacter().then((loaded) => {
    if (loaded) {
      glbInstance = instantiateGLBCharacter(loaded);
      rig.root.visible = false;
      scene.add(glbInstance.root);
    }
  });

  // 6. Interactive Orbit / Drag controls (without external OrbitControls library)
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let sphericalCoords = { radius: 4.2, theta: 0, phi: Math.PI / 2 - 0.15 };

  const updateCameraFromSpherical = () => {
    // Clamp phi so camera cannot flip upside down
    sphericalCoords.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.02, sphericalCoords.phi));

    const x =
      sphericalCoords.radius *
      Math.sin(sphericalCoords.phi) *
      Math.sin(sphericalCoords.theta);
    const y = sphericalCoords.radius * Math.cos(sphericalCoords.phi) + 0.4;
    const z =
      sphericalCoords.radius *
      Math.sin(sphericalCoords.phi) *
      Math.cos(sphericalCoords.theta);

    camera.position.set(x, y, z);
    camera.lookAt(0, 1.0, 0);
  };

  const onPointerDown = (e: PointerEvent) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    renderer.domElement.style.cursor = 'grabbing';
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    sphericalCoords.theta -= deltaX * 0.008;
    sphericalCoords.phi -= deltaY * 0.008;

    updateCameraFromSpherical();

    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    isDragging = false;
    renderer.domElement.style.cursor = 'grab';
  };

  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // 7. Animation Loop with THREE.Clock
  const clock = new THREE.Clock();
  let animationFrameId: number;
  let isPlaying = true;
  let accumulatedTime = 0;

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (isPlaying) {
      accumulatedTime += delta;
      if (glbInstance) {
        glbInstance.update(delta);
      } else {
        updateCharacterIdle(rig, accumulatedTime);
      }
    }

    renderer.render(scene, camera);
  };

  animate();

  // 8. Resizing handler
  const handleResize = () => {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height || 1;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener('resize', handleResize);

  return {
    canvas: renderer.domElement,
    rig,
    get isPlaying() {
      return isPlaying;
    },
    play: () => {
      isPlaying = true;
    },
    pause: () => {
      isPlaying = false;
    },
    reset: () => {
      accumulatedTime = 0;
      resetCharacterPose(rig);
      sphericalCoords = { radius: 4.2, theta: 0, phi: Math.PI / 2 - 0.15 };
      updateCameraFromSpherical();
    },
    handleResize,
    dispose: () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      // Clean up Three.js scene geometries and materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    },
  };
}

