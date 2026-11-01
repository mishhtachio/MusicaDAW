import * as THREE from 'three';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  shadowMesh?: THREE.Mesh;
}

/**
 * Creates a cute, stylized, toy-like miniature 3D humanoid character
 * entirely from primitive Three.js geometries and standard materials.
 *
 * Proportion highlights:
 * - Large, expressive rounded head with cute cap/beanie accessory
 * - Distinct shiny eyes with specular highlights & sweet smile
 * - Rosy blush cheeks
 * - Compact rounded torso with cute belly button / button detail
 * - Short limbs with proper anatomical pivot groups (shoulders and hips)
 * - Grounded rounded feet standing on a circular platform
 */
export function createProceduralCharacter(options?: { includePlatform?: boolean }): { rig: CharacterRig; platform: THREE.Group } {
  const includePlatform = options?.includePlatform ?? true;
  const root = new THREE.Group();
  root.name = 'ProceduralCharacterRoot';

  // --- Shared Palettes & Materials (Reused efficiently) ---
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdfc4,
    roughness: 0.55,
    metalness: 0.05,
  });

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, // Sky blue hoodie/sweater
    roughness: 0.45,
    metalness: 0.1,
  });

  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark navy shorts/pants
    roughness: 0.7,
  });

  const shoesMaterial = new THREE.MeshStandardMaterial({
    color: 0xf43f5e, // Coral-red sneakers
    roughness: 0.35,
    metalness: 0.1,
  });

  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Warm amber cap
    roughness: 0.4,
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Deep shiny obsidian
    roughness: 0.1,
    metalness: 0.8,
  });

  const eyeHighlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const blushMaterial = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    roughness: 0.8,
    transparent: true,
    opacity: 0.65,
  });

  const mouthMaterial = new THREE.MeshBasicMaterial({
    color: 0x881337,
  });

  // ==========================================
  // 1. LEGS & FEET (Pivoting at hips)
  // ==========================================
  const legRadius = 0.13;
  const legHeight = 0.38;
  const legGeo = new THREE.CylinderGeometry(legRadius, legRadius * 0.9, legHeight, 16);
  const footGeo = new THREE.SphereGeometry(0.18, 16, 12);
  footGeo.scale(1, 0.7, 1.35); // Slightly elongated, flattened rounded shoe

  // Left Leg Group (pivot at hip)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.25, 0.65, 0);

  const leftLegMesh = new THREE.Mesh(legGeo, pantsMaterial);
  leftLegMesh.castShadow = true;
  leftLegMesh.receiveShadow = true;
  leftLegMesh.position.set(0, -legHeight / 2, 0);
  leftLegGroup.add(leftLegMesh);

  const leftFoot = new THREE.Mesh(footGeo, shoesMaterial);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  leftFoot.position.set(0, -legHeight, 0.05);
  leftLegGroup.add(leftFoot);

  // Right Leg Group (pivot at hip)
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.25, 0.65, 0);

  const rightLegMesh = new THREE.Mesh(legGeo, pantsMaterial);
  rightLegMesh.castShadow = true;
  rightLegMesh.receiveShadow = true;
  rightLegMesh.position.set(0, -legHeight / 2, 0);
  rightLegGroup.add(rightLegMesh);

  const rightFoot = new THREE.Mesh(footGeo, shoesMaterial);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  rightFoot.position.set(0, -legHeight, 0.05);
  rightLegGroup.add(rightFoot);

  root.add(leftLegGroup);
  root.add(rightLegGroup);

  // ==========================================
  // 2. BODY / TORSO (Attached above hips)
  // ==========================================
  const body = new THREE.Group();
  body.position.set(0, 0.68, 0); // Root of torso

  // Cute chubby capsule/pear-shaped torso
  const torsoGeo = new THREE.CapsuleGeometry(0.38, 0.38, 16, 24);
  const torsoMesh = new THREE.Mesh(torsoGeo, bodyMaterial);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoMesh.position.set(0, 0.38, 0);
  body.add(torsoMesh);

  // Little belt / waistband ring
  const beltGeo = new THREE.TorusGeometry(0.39, 0.04, 12, 32);
  const beltMesh = new THREE.Mesh(beltGeo, pantsMaterial);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.position.set(0, 0.18, 0);
  body.add(beltMesh);

  // Two decorative cute button pins on hoodie
  const buttonGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const button1 = new THREE.Mesh(buttonGeo, buttonMat);
  button1.rotation.x = Math.PI / 2;
  button1.position.set(0, 0.44, 0.38);
  body.add(button1);

  const button2 = new THREE.Mesh(buttonGeo, buttonMat);
  button2.rotation.x = Math.PI / 2;
  button2.position.set(0, 0.30, 0.39);
  body.add(button2);

  // ==========================================
  // 3. ARMS & HANDS (Pivoting at shoulders)
  // ==========================================
  const armRadius = 0.11;
  const armLength = 0.42;
  const armGeo = new THREE.CylinderGeometry(armRadius, armRadius * 0.95, armLength, 16);
  const handGeo = new THREE.SphereGeometry(0.12, 16, 16);

  // Left Arm Group (pivot at shoulder)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.44, 0.55, 0);

  const leftArmMesh = new THREE.Mesh(armGeo, bodyMaterial);
  leftArmMesh.castShadow = true;
  leftArmMesh.receiveShadow = true;
  leftArmMesh.position.set(0, -armLength / 2, 0);
  leftArmGroup.add(leftArmMesh);

  const leftHandMesh = new THREE.Mesh(handGeo, skinMaterial);
  leftHandMesh.castShadow = true;
  leftHandMesh.receiveShadow = true;
  leftHandMesh.position.set(0, -armLength - 0.04, 0);
  leftArmGroup.add(leftHandMesh);

  // Right Arm Group (pivot at shoulder)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.44, 0.55, 0);

  const rightArmMesh = new THREE.Mesh(armGeo, bodyMaterial);
  rightArmMesh.castShadow = true;
  rightArmMesh.receiveShadow = true;
  rightArmMesh.position.set(0, -armLength / 2, 0);
  rightArmGroup.add(rightArmMesh);

  const rightHandMesh = new THREE.Mesh(handGeo, skinMaterial);
  rightHandMesh.castShadow = true;
  rightHandMesh.receiveShadow = true;
  rightHandMesh.position.set(0, -armLength - 0.04, 0);
  rightArmGroup.add(rightHandMesh);

  body.add(leftArmGroup);
  body.add(rightArmGroup);

  // ==========================================
  // 4. HEAD & FACE & ACCESSORY (Pivoting at neck)
  // ==========================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.78, 0); // Neck pivot

  // Cute oversized round head
  const headRadius = 0.56;
  const headGeo = new THREE.SphereGeometry(headRadius, 32, 28);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.position.set(0, headRadius * 0.88, 0);
  headGroup.add(headMesh);

  // Big shiny cartoon eyes
  const eyeRadius = 0.085;
  const eyeGeo = new THREE.SphereGeometry(eyeRadius, 16, 16);
  const highlightGeo = new THREE.SphereGeometry(eyeRadius * 0.36, 12, 12);

  // Left Eye
  const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  leftEye.position.set(-0.19, headRadius * 0.90, headRadius * 0.88);
  const leftHighlight = new THREE.Mesh(highlightGeo, eyeHighlightMaterial);
  leftHighlight.position.set(-0.025, 0.025, eyeRadius * 0.82);
  leftEye.add(leftHighlight);
  headGroup.add(leftEye);

  // Right Eye
  const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
  rightEye.position.set(0.19, headRadius * 0.90, headRadius * 0.88);
  const rightHighlight = new THREE.Mesh(highlightGeo, eyeHighlightMaterial);
  rightHighlight.position.set(-0.025, 0.025, eyeRadius * 0.82);
  rightEye.add(rightHighlight);
  headGroup.add(rightEye);

  // Cute blushing rosy cheeks
  const cheekGeo = new THREE.SphereGeometry(0.11, 16, 12);
  cheekGeo.scale(1.2, 0.6, 0.3);

  const leftCheek = new THREE.Mesh(cheekGeo, blushMaterial);
  leftCheek.position.set(-0.31, headRadius * 0.74, headRadius * 0.82);
  leftCheek.rotation.y = -0.3;
  headGroup.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, blushMaterial);
  rightCheek.position.set(0.31, headRadius * 0.74, headRadius * 0.82);
  rightCheek.rotation.y = 0.3;
  headGroup.add(rightCheek);

  // Sweet gentle curved smile (using half torus arc)
  const mouthGeo = new THREE.TorusGeometry(0.09, 0.022, 12, 24, Math.PI * 0.85);
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMaterial);
  mouthMesh.position.set(0, headRadius * 0.72, headRadius * 0.94);
  mouthMesh.rotation.z = Math.PI + (Math.PI * 0.15) / 2;
  mouthMesh.rotation.x = -0.15;
  headGroup.add(mouthMesh);

  // Optional Cute Accessory: Stylish Beanie / Cap on head
  const capCrownGeo = new THREE.SphereGeometry(headRadius * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const capCrown = new THREE.Mesh(capCrownGeo, capMaterial);
  capCrown.position.set(0, headRadius * 0.95, 0);
  capCrown.rotation.x = -0.12; // tilted back slightly
  headGroup.add(capCrown);

  const capBrimGeo = new THREE.TorusGeometry(headRadius * 0.98, 0.06, 12, 32);
  const capBrim = new THREE.Mesh(capBrimGeo, capMaterial);
  capBrim.position.set(0, headRadius * 1.05, 0);
  capBrim.rotation.x = Math.PI / 2 - 0.12;
  headGroup.add(capBrim);

  // Cute pompom on top of cap
  const pompomGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const pompom = new THREE.Mesh(pompomGeo, buttonMat);
  pompom.position.set(0, headRadius * 1.52, -0.08);
  headGroup.add(pompom);

  body.add(headGroup);
  root.add(body);

  // ==========================================
  // 5. CIRCULAR DISPLAY PLATFORM / PEDESTAL
  // ==========================================
  const platform = new THREE.Group();
  platform.name = 'PedestalPlatform';

  if (includePlatform) {
    // Stepped round circular dais
    const basePlatformGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.16, 48);
    const basePlatformMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Slate blue dais
      roughness: 0.6,
    });
    const basePlatform = new THREE.Mesh(basePlatformGeo, basePlatformMat);
    basePlatform.position.set(0, -0.08, 0);
    basePlatform.receiveShadow = true;
    platform.add(basePlatform);

    // Upper illuminated ring disc
    const topDiscGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.04, 48);
    const topDiscMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.2,
    });
    const topDisc = new THREE.Mesh(topDiscGeo, topDiscMat);
    topDisc.position.set(0, 0.01, 0);
    topDisc.receiveShadow = true;
    platform.add(topDisc);
  }

  // Soft contact drop shadow under the feet
  const shadowGeo = new THREE.PlaneGeometry(1.2, 0.8);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const gradient = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
    gradient.addColorStop(0.5, 'rgba(15, 23, 42, 0.3)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
    sCtx.fillStyle = gradient;
    sCtx.fillRect(0, 0, 128, 128);
  }
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.035, 0.05);
  platform.add(contactShadow);

  const rig: CharacterRig = {
    root,
    body,
    headGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
    shadowMesh: contactShadow,
  };

  return { rig, platform };
}

/**
 * Updates character joints for a smooth, life-like idle breathing & bobbing animation.
 *
 * Designed around natural biomechanical harmonics:
 * - Breathing / torso scale & subtle Y-bob
 * - Feet stay grounded to the pedestal while knees have subtle elastic flex
 * - Head gently cocks and rotates curiosity-style
 * - Arms swing in gentle anti-phase with slight elbow bend
 */
export function updateCharacterIdle(rig: CharacterRig, elapsed: number) {
  const breathFreq = 2.0; // gentle breaths per second
  const swayFreq = 1.0;   // slower head & body sway

  // 1. Torso vertical bounce & breathing expansion
  const breathCycle = Math.sin(elapsed * breathFreq);
  const swayCycle = Math.cos(elapsed * swayFreq);

  // Subtle Y translation for bobbing (keeping feet grounded)
  // Base body resting Y is 0.68
  const bobY = 0.68 + Math.abs(breathCycle) * 0.035;
  rig.body.position.y = bobY;

  // Subtle torso stretch on inhale, squish on exhale
  rig.body.scale.set(
    1 + breathCycle * 0.015,
    1 + breathCycle * 0.025,
    1 + breathCycle * 0.015
  );

  // Subtle natural body tilt
  rig.body.rotation.z = swayCycle * 0.025;
  rig.body.rotation.y = Math.sin(elapsed * 0.8) * 0.04;

  // 2. Head idle movement (curious tilted toy expression)
  // Base head resting is at neck
  rig.headGroup.rotation.z = Math.sin(elapsed * 1.2) * 0.06; // slight cute head tilt
  rig.headGroup.rotation.y = Math.cos(elapsed * 0.9) * 0.12; // gentle looking around
  rig.headGroup.rotation.x = -0.03 + Math.sin(elapsed * breathFreq) * 0.03; // slight nod

  // 3. Arms subtle idle swing
  // Left arm
  rig.leftArmGroup.rotation.x = Math.sin(elapsed * swayFreq + 0.5) * 0.14;
  rig.leftArmGroup.rotation.z = -0.12 + Math.cos(elapsed * breathFreq) * 0.04;

  // Right arm (counter-phase swing)
  rig.rightArmGroup.rotation.x = -Math.sin(elapsed * swayFreq + 0.5) * 0.14;
  rig.rightArmGroup.rotation.z = 0.12 - Math.cos(elapsed * breathFreq) * 0.04;

  // 4. Legs stay grounded while hips flex softly to match bob
  const kneeFlex = (bobY - 0.68) * 0.4;
  rig.leftLegGroup.rotation.x = -kneeFlex;
  rig.rightLegGroup.rotation.x = -kneeFlex;

  // 5. Contact shadow pulses softly with breathing height
  if (rig.shadowMesh) {
    const shadowScale = 1 - (bobY - 0.68) * 1.5;
    rig.shadowMesh.scale.set(shadowScale, shadowScale, 1);
  }
}

/**
 * Resets the rig to its neutral T-pose / standing rest pose.
 */
export function resetCharacterPose(rig: CharacterRig) {
  rig.body.position.set(0, 0.68, 0);
  rig.body.rotation.set(0, 0, 0);
  rig.body.scale.set(1, 1, 1);

  rig.headGroup.rotation.set(0, 0, 0);

  rig.leftArmGroup.rotation.set(0, 0, -0.1);
  rig.rightArmGroup.rotation.set(0, 0, 0.1);

  rig.leftLegGroup.rotation.set(0, 0, 0);
  rig.rightLegGroup.rotation.set(0, 0, 0);

  if (rig.shadowMesh) {
    rig.shadowMesh.scale.set(1, 1, 1);
  }
}

