const canvas = document.getElementById("scene");

// Color palette matching the reference image - pinkish maroon purple sunset
const palette = {
  skyTop: "#4a1840",
  skyMid: "#803058",
  skyHorizon: "#b06878",
  horizonGlow: "#c88088",

  mountainFar: "#8b5070",
  mountainMid: "#7a4060",

  lakeTop: "#7a4860",
  lakeMid: "#5a3048",
  lakeBottom: "#3a1828",

  treeSilhouette: "#2e0718",
  foreground: "#2e0718",

  moon: "#fff8fc",
  moonGlow: "#ffb8d0"
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-100, 100, 50, -50, -100, 100);

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h);
  const aspect = w / h;
  camera.left = -50 * aspect;
  camera.right = 50 * aspect;
  camera.top = 50;
  camera.bottom = -50;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// Scene composition constants
const HORIZON = 0; // y=0 is the water line

// =============== SKY ===============
function createSky() {
  const geo = new THREE.PlaneGeometry(300, 100);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      skyTop: { value: new THREE.Color(palette.skyTop) },
      skyMid: { value: new THREE.Color(palette.skyMid) },
      skyHorizon: { value: new THREE.Color(palette.skyHorizon) },
      horizonGlow: { value: new THREE.Color(palette.horizonGlow) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 skyTop, skyMid, skyHorizon, horizonGlow;
      varying vec2 vUv;
      void main() {
        float y = vUv.y;
        
        // Main sky gradient - smoother transition matching inspo
        vec3 color = mix(horizonGlow, skyHorizon, smoothstep(0.0, 0.25, y));
        color = mix(color, skyMid, smoothstep(0.15, 0.5, y));
        color = mix(color, skyTop, smoothstep(0.4, 0.9, y));
        
        // Soft warm glow at horizon - wider spread
        float xCenter = abs(vUv.x - 0.5) * 2.0;
        float glowX = 1.0 - smoothstep(0.0, 0.85, xCenter);
        float glowY = 1.0 - smoothstep(0.0, 0.4, y);
        float glow = glowX * glowY * 0.6;
        color = mix(color, horizonGlow, glow);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 50, -20);
  return mesh;
}

// =============== STARS ===============
function createStars() {
  const group = new THREE.Group();

  // Seeded random for consistent stars
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  let seed = 54321;
  const twinklingStars = [];

  // Main stars spread across the sky
  for (let i = 0; i < 150; i++) {
    // Spread across full screen width
    const x = (seededRandom(seed++) - 0.5) * 250;
    const y = seededRandom(seed++) * 42 + 8;

    // Mostly tiny stars with a few slightly larger ones
    const sizeRand = seededRandom(seed++);
    let size;
    if (sizeRand > 0.97) {
      size = 0.35 + seededRandom(seed++) * 0.15; // Few slightly larger
    } else if (sizeRand > 0.85) {
      size = 0.2 + seededRandom(seed++) * 0.1; // Some medium
    } else {
      size = 0.08 + seededRandom(seed++) * 0.1; // Mostly tiny
    }

    // Varying opacity - dimmer overall
    const baseOpacity = 0.3 + seededRandom(seed++) * 0.5;

    const geo = new THREE.CircleGeometry(size, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: baseOpacity
    });
    const star = new THREE.Mesh(geo, mat);
    star.position.set(x, y, -15);
    group.add(star);

    // 15% of stars will twinkle
    if (seededRandom(seed++) < 0.15) {
      twinklingStars.push({
        mesh: star,
        baseOpacity: baseOpacity,
        speed: 1.5 + seededRandom(seed++) * 2.5,
        phase: seededRandom(seed++) * Math.PI * 2
      });
    }
  }

  // Extra stars for the top-left corner
  for (let i = 0; i < 25; i++) {
    const x = -125 + seededRandom(seed++) * 80; // -125 to -45
    const y = 30 + seededRandom(seed++) * 20; // 30 to 50 (upper area)

    const sizeRand = seededRandom(seed++);
    let size;
    if (sizeRand > 0.9) {
      size = 0.25 + seededRandom(seed++) * 0.15;
    } else {
      size = 0.08 + seededRandom(seed++) * 0.12;
    }

    const baseOpacity = 0.3 + seededRandom(seed++) * 0.5;

    const geo = new THREE.CircleGeometry(size, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: baseOpacity
    });
    const star = new THREE.Mesh(geo, mat);
    star.position.set(x, y, -15);
    group.add(star);

    // 15% of these also twinkle
    if (seededRandom(seed++) < 0.15) {
      twinklingStars.push({
        mesh: star,
        baseOpacity: baseOpacity,
        speed: 1.5 + seededRandom(seed++) * 2.5,
        phase: seededRandom(seed++) * Math.PI * 2
      });
    }
  }

  // Store twinkling stars for animation
  window.twinklingStars = twinklingStars;

  return group;
}

// =============== MOON ===============
function createMoon() {
  const group = new THREE.Group();

  // Load moon textures
  const textureLoader = new THREE.TextureLoader();
  const moonTexture = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/lroc_color_poles_1k.jpg");
  const displacementMap = textureLoader.load("https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/ldem_3_8bit.jpg");

  // Outer atmospheric glow (largest, most diffuse)
  const outerGlowGeo = new THREE.CircleGeometry(20, 64);
  const outerGlowMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color("#ffc8d8") }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 3.0) * 0.2;
        gl_FragColor = vec4(color, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
  outerGlow.position.z = -2;
  group.add(outerGlow);

  // Inner glow
  const innerGlowGeo = new THREE.CircleGeometry(12, 64);
  const innerGlowMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color("#ffe8e8") }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0) * 0.4;
        gl_FragColor = vec4(color, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
  innerGlow.position.z = -1;
  group.add(innerGlow);

  // 3D Moon sphere with realistic texture
  const moonGeo = new THREE.SphereGeometry(8, 64, 64);
  const moonMat = new THREE.MeshPhongMaterial({
    color: 0xE396A2,
    map: moonTexture,
    displacementMap: displacementMap,
    displacementScale: 0.5,
    bumpMap: displacementMap,
    bumpScale: 0.3,
    reflectivity: 0,
    shininess: 0
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.rotation.y = Math.PI * 1.54;
  moon.rotation.x = Math.PI * 0.02;
  group.add(moon);

  // Add directional light for the moon - positioned more in front
  const moonLight = new THREE.DirectionalLight(0xffffff, 1.2);
  moonLight.position.set(0, 10, 100);
  group.add(moonLight);

  // Secondary fill light to reduce shadow
  const fillLight = new THREE.DirectionalLight(0xffffee, 0.6);
  fillLight.position.set(-30, -20, 50);
  group.add(fillLight);

  // Stronger ambient light on moon to soften shadows
  const ambientLight = new THREE.AmbientLight(0x666666, 0.8);
  group.add(ambientLight);

  group.position.set(35, 28, -10);
  return group;
}

// =============== MOUNTAINS ===============
// Simple smooth mountain using quadratic bezier-like curve
function createMountain(color, points, yOffset = 0) {
  const shape = new THREE.Shape();

  shape.moveTo(points[0].x, HORIZON); // Start at horizon instead of below
  shape.lineTo(points[0].x, points[0].y + yOffset);

  // Smooth curve through points
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y + yOffset);
  }

  shape.lineTo(points[points.length - 1].x, HORIZON);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, 100);

  // Use shader material for gradient - exactly matching reference
  // Pink/maroon at top, bright rosy pink at bottom
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#7a3058") },      // Pink maroon at peak
      bottomColor: { value: new THREE.Color("#c8788a") }    // Bright rosy pink at base
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, bottomColor;
      varying vec2 vPos;
      void main() {
        // Gradient from top (dark purple) to bottom (bright coral)
        float heightGrad = smoothstep(-2.0, 30.0, vPos.y);
        vec3 color = mix(bottomColor, topColor, heightGrad);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  return new THREE.Mesh(geo, mat);
}

// Far mountain - three peaks with smooth valleys
function createFarMountain() {
  const points = [];
  for (let x = -150; x <= 150; x += 2) {
    // Left peak - wider spread
    const leftPeak = 22 * Math.exp(-Math.pow((x + 70) / 32, 2));
    // Center peak (tallest, behind moon) - wider spread
    const centerPeak = 28 * Math.exp(-Math.pow(x / 34, 2));
    // Right peak - wider spread
    const rightPeak = 20 * Math.exp(-Math.pow((x - 75) / 30, 2));
    // Soft blend - slightly higher exponent for shallower valleys
    const softMax = Math.pow(Math.pow(leftPeak, 1.8) + Math.pow(centerPeak, 1.55) + Math.pow(rightPeak, 1.6), 1 / 1.6);
    // Lower base to create deeper valleys
    const peak = softMax;
    points.push({ x, y: HORIZON + peak });
  }
  return createMountain(palette.mountainFar, points);
}

// Mid mountain - slopes down from left, has a dip, rises on right
// Mountains have bright coral gradient like inspo image
function createMidMountain() {
  const group = new THREE.Group();

  // Create left mountain with bright gradient
  const leftShape = new THREE.Shape();
  const leftPoints = [];
  for (let x = -150; x <= 40; x += 2) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const y = HORIZON + Math.max(leftSlope, 2);
    leftPoints.push({ x, y });
  }

  // Stop at HORIZON instead of extending below into lake area
  leftShape.moveTo(-150, HORIZON);
  leftShape.lineTo(-150, leftPoints[0].y);
  leftPoints.forEach(p => leftShape.lineTo(p.x, p.y));
  leftShape.lineTo(40, HORIZON);
  leftShape.closePath();

  const leftGeo = new THREE.ShapeGeometry(leftShape);

  // Bright gradient shader for left mountain - dark solid color
  const leftMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#2e0718")
  });

  const leftMtn = new THREE.Mesh(leftGeo, leftMat);
  group.add(leftMtn);

  // Create right mountain with same bright gradient
  const rightPoints = [];
  for (let x = 30; x <= 150; x += 2) {
    const rightSlope = 15 * Math.exp(-Math.pow((x - 70) / 35, 2));
    const y = HORIZON + Math.max(rightSlope, 2);
    rightPoints.push({ x, y });
  }

  const rightShape = new THREE.Shape();
  // Stop at HORIZON instead of extending below into lake area
  rightShape.moveTo(30, HORIZON);
  rightShape.lineTo(30, rightPoints[0].y);
  rightPoints.forEach(p => rightShape.lineTo(p.x, p.y));
  rightShape.lineTo(150, HORIZON);
  rightShape.closePath();

  const rightGeo = new THREE.ShapeGeometry(rightShape);

  // Right mountain - same dark solid color
  const rightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#2e0718")
  });
  const rightMtn = new THREE.Mesh(rightGeo, rightMat);
  group.add(rightMtn);

  return group;
}

// =============== PINE TREES (LEFT SIDE) ===============
// Creates a single pine cone shaped tree silhouette
function createPineTreeShape(centerX, baseY, height, baseWidth) {
  const points = [];

  // Pine cone shape: narrow at top, gradually wider with jagged branches
  // Start from the tip
  points.push({ x: centerX, y: baseY + height });

  // Create layered branch silhouette going down
  const layers = 6 + Math.floor(Math.random() * 3);
  for (let i = 1; i <= layers; i++) {
    const progress = i / layers;
    const layerY = baseY + height * (1 - progress);
    // Width increases as we go down, pine cone shape
    const layerWidth = baseWidth * progress * 0.5;

    // Jagged branch tips - slight outward then inward
    const branchTipOut = layerWidth * (1.1 + Math.random() * 0.15);
    const branchTipIn = layerWidth * (0.85 + Math.random() * 0.1);

    // Left side branch tip
    points.push({ x: centerX - branchTipOut, y: layerY + height * 0.02 });
    // Left side branch base (tucked in)
    if (i < layers) {
      points.push({ x: centerX - branchTipIn, y: layerY - height * 0.01 });
    }
  }

  // Bottom center (trunk area merges with base)
  points.push({ x: centerX - baseWidth * 0.08, y: baseY });
  points.push({ x: centerX + baseWidth * 0.08, y: baseY });

  // Right side going back up
  for (let i = layers; i >= 1; i--) {
    const progress = i / layers;
    const layerY = baseY + height * (1 - progress);
    const layerWidth = baseWidth * progress * 0.5;

    const branchTipOut = layerWidth * (1.1 + Math.random() * 0.15);
    const branchTipIn = layerWidth * (0.85 + Math.random() * 0.1);

    if (i < layers) {
      points.push({ x: centerX + branchTipIn, y: layerY - height * 0.01 });
    }
    points.push({ x: centerX + branchTipOut, y: layerY + height * 0.02 });
  }

  return points;
}

function createPineForest() {
  const group = new THREE.Group();
  const treeColor = new THREE.Color(palette.treeSilhouette);

  // Seeded random for consistent results
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  // Create a solid base that covers all tree trunks - stops at HORIZON
  const baseShape = new THREE.Shape();
  baseShape.moveTo(-150, HORIZON);
  baseShape.lineTo(-150, HORIZON + 2);

  // Follow the mountain ridge with some buffer - lower profile
  for (let x = -150; x <= 35; x += 2) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const baseY = HORIZON + Math.max(leftSlope, 2) - 2;
    baseShape.lineTo(x, baseY);
  }

  baseShape.lineTo(35, HORIZON);
  baseShape.closePath();

  const baseGeo = new THREE.ShapeGeometry(baseShape);
  const baseMat = new THREE.MeshBasicMaterial({ color: treeColor });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.z = 0.8;
  group.add(baseMesh);

  // Create individual pine trees with pine cone shapes
  // Back layer - smaller, shorter trees on the ridge
  let seed = 12345;
  for (let x = -140; x < 30; x += 2 + seededRandom(seed++) * 2) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const baseY = HORIZON + Math.max(leftSlope, 2) - 1;

    // Trees get taller toward the right (center of scene)
    const xFactor = Math.max(0, (x + 140) / 170); // 0 at left, ~1 at right
    // Reduce height on far left by 10%
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const height = (3 + seededRandom(seed++) * 2 + xFactor * 4) * leftReduction;
    const width = 4 + seededRandom(seed++) * 2.5;

    const treePoints = createPineTreeShape(x, baseY, height, width);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: treeColor }));
    mesh.position.z = -0.3 + seededRandom(seed++) * 0.2;
    group.add(mesh);
  }

  // Middle layer - medium trees
  for (let x = -145; x < 25; x += 2.5 + seededRandom(seed++) * 2.5) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const baseY = HORIZON + Math.max(leftSlope, 2) - 2;

    const xFactor = Math.max(0, (x + 145) / 170);
    // Reduce height on far left by 10%
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const height = (4 + seededRandom(seed++) * 3 + xFactor * 5) * leftReduction;
    const width = 4.5 + seededRandom(seed++) * 3;

    const treePoints = createPineTreeShape(x, baseY, height, width);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: treeColor }));
    mesh.position.z = 0.1 + seededRandom(seed++) * 0.2;
    group.add(mesh);
  }

  // Front layer - tallest trees for prominent silhouette
  for (let x = -142; x < 20; x += 3 + seededRandom(seed++) * 3) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const baseY = HORIZON + Math.max(leftSlope, 2) - 3;

    const xFactor = Math.max(0, (x + 142) / 162);
    // Reduce height on far left by 10%
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const height = (5 + seededRandom(seed++) * 4 + xFactor * 6) * leftReduction;
    const width = 5 + seededRandom(seed++) * 3.5;

    const treePoints = createPineTreeShape(x, baseY, height, width);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: treeColor }));
    mesh.position.z = 0.5 + seededRandom(seed++) * 0.2;
    group.add(mesh);
  }

  return group;
}

// =============== ROUND TREES (RIGHT SIDE) ===============
function createRoundTreeGroup() {
  const group = new THREE.Group();

  // Trees on the right hill
  const treesData = [
    { x: 65, baseY: 12, trunkH: 5, canopyR: 4 },
    { x: 72, baseY: 14, trunkH: 7, canopyR: 5 },
    { x: 80, baseY: 15, trunkH: 10, canopyR: 7 },
    { x: 88, baseY: 14, trunkH: 8, canopyR: 6 },
    { x: 75, baseY: 14.5, trunkH: 6, canopyR: 4 },
    { x: 84, baseY: 15, trunkH: 7, canopyR: 5 },
  ];

  treesData.forEach(t => {
    const tree = createRoundTree(t.trunkH, t.canopyR);
    tree.position.set(t.x, HORIZON + t.baseY, 0);
    group.add(tree);
  });

  return group;
}

function createRoundTree(trunkH, canopyR) {
  const group = new THREE.Group();
  const color = new THREE.Color(palette.treeSilhouette);

  // Trunk
  const trunkW = canopyR * 0.2;
  const trunkShape = new THREE.Shape();
  trunkShape.moveTo(-trunkW, 0);
  trunkShape.lineTo(-trunkW, trunkH);
  trunkShape.lineTo(trunkW, trunkH);
  trunkShape.lineTo(trunkW, 0);
  const trunkGeo = new THREE.ShapeGeometry(trunkShape);
  const trunkMat = new THREE.MeshBasicMaterial({ color });
  group.add(new THREE.Mesh(trunkGeo, trunkMat));

  // Canopy - multiple circles for organic look
  const circles = [
    { x: 0, y: trunkH + canopyR * 0.6, r: canopyR },
    { x: -canopyR * 0.4, y: trunkH + canopyR * 0.3, r: canopyR * 0.6 },
    { x: canopyR * 0.4, y: trunkH + canopyR * 0.3, r: canopyR * 0.6 },
  ];
  circles.forEach(c => {
    const geo = new THREE.CircleGeometry(c.r, 24);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(c.x, c.y, 0);
    group.add(mesh);
  });

  return group;
}

// =============== LAKE ===============
function createLake() {
  const group = new THREE.Group();

  // Base dark layer (bottom of lake) - extends to bottom of screen
  // Now curves up on the right side to create a small lake shoreline effect
  const darkShape = new THREE.Shape();
  darkShape.moveTo(-150, -55);
  darkShape.lineTo(-150, HORIZON - 44);
  // Wavy top edge - curves up on the right to form shoreline
  for (let x = -150; x <= 150; x += 5) {
    const wave = Math.sin(x * 0.04) * 3 + Math.sin(x * 0.02 + 1) * 2;
    // Add shoreline curve on the right side (starting around x=60)
    let shorelineRise = 0;
    if (x > 60) {
      const t = (x - 60) / 90; // 0 to 1 as x goes from 60 to 150
      shorelineRise = Math.pow(t, 1.5) * 45; // Curves up to meet horizon
    }
    darkShape.lineTo(x, HORIZON - 44 + wave + shorelineRise);
  }
  darkShape.lineTo(150, -55);
  darkShape.closePath();

  const darkGeo = new THREE.ShapeGeometry(darkShape);
  const darkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#1C0510") });
  const darkMesh = new THREE.Mesh(darkGeo, darkMat);
  darkMesh.position.z = -2;
  group.add(darkMesh);

  // Middle dark band - water layer with shader for realistic water effect
  const midDarkShape = new THREE.Shape();
  midDarkShape.moveTo(-150, HORIZON - 48);
  // Bottom wavy edge
  for (let x = -150; x <= 150; x += 5) {
    const wave = Math.sin(x * 0.04) * 3 + Math.sin(x * 0.02 + 1) * 2;
    midDarkShape.lineTo(x, HORIZON - 44 + wave);
  }
  // Top wavy edge (going back) - EXACTLY matches getLakeTopY() formula
  for (let x = 150; x >= -150; x -= 5) {
    // Same formula as getLakeTopY in createTreeReflections
    const wave = Math.sin(x * 0.025 + 1) * 3 + Math.sin(x * 0.01 + 2) * 2;
    midDarkShape.lineTo(x, HORIZON - 12 + wave);
  }
  midDarkShape.closePath();

  const midDarkGeo = new THREE.ShapeGeometry(midDarkShape);

  // Water shader with ripples, reflections and gradient - more visible effect
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: new THREE.Color("#3a1018") },
      highlightColor: { value: new THREE.Color("#7a3850") },
      shimmerColor: { value: new THREE.Color("#8a4058") }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vPos;
      void main() {
        vUv = uv;
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      uniform vec3 highlightColor;
      uniform vec3 shimmerColor;
      varying vec2 vUv;
      varying vec2 vPos;
      
      // Noise function for organic variation
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      void main() {
        vec3 color = baseColor;
        
        // Distortion based on noise for organic wave shapes
        float distortX = fbm(vPos * 0.08 + time * 0.1) * 8.0;
        float distortY = fbm(vPos * 0.06 - time * 0.08) * 5.0;
        vec2 distortedPos = vPos + vec2(distortX, distortY);
        
        // Primary horizontal ripples - stretched and wavy
        float ripple1 = sin(distortedPos.y * 0.4 + distortedPos.x * 0.02 + time * 0.3);
        ripple1 += sin(distortedPos.y * 0.25 + time * 0.2) * 0.5;
        ripple1 = ripple1 * 0.5 + 0.5;
        
        // Secondary smaller ripples
        float ripple2 = sin(distortedPos.y * 0.8 - distortedPos.x * 0.04 + time * 0.5);
        ripple2 += fbm(distortedPos * 0.15 + time * 0.2) * 0.6;
        ripple2 = ripple2 * 0.5 + 0.5;
        
        // Soft bands instead of hard grid lines
        float band1 = smoothstep(0.35, 0.5, ripple1) * smoothstep(0.65, 0.5, ripple1);
        float band2 = smoothstep(0.4, 0.55, ripple2) * smoothstep(0.7, 0.55, ripple2);
        
        // Combine with varying intensity based on position
        float depthFade = smoothstep(-50.0, -15.0, vPos.y); // Stronger near horizon, extended for larger lake
        float ripples = (band1 * 0.6 + band2 * 0.4) * 0.35 * depthFade;
        
        // Add subtle noise texture for water surface variation
        float surfaceNoise = fbm(vPos * 0.2 + time * 0.05) * 0.15;
        
        color = mix(color, highlightColor, ripples + surfaceNoise * depthFade);
        
        // Moon reflection column - softer, more diffuse
        float moonX = smoothstep(20.0, 35.0, vPos.x) * smoothstep(50.0, 35.0, vPos.x);
        float moonShimmer = fbm(vec2(vPos.x * 0.1, vPos.y * 0.3 + time * 0.4)) * 0.5 + 0.5;
        color = mix(color, shimmerColor, moonX * moonShimmer * 0.25 * depthFade);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  // Store reference for animation
  window.waterMaterial = waterMat;

  const midDarkMesh = new THREE.Mesh(midDarkGeo, waterMat);
  midDarkMesh.position.z = -3;
  group.add(midDarkMesh);

  // Top layer (at horizon)
  const topShape = new THREE.Shape();
  topShape.moveTo(-150, HORIZON - 10);
  // Bottom wavy edge - raised on the left side
  for (let x = -150; x <= 150; x += 5) {
    const wave = Math.sin(x * 0.03 + 0.5) * 4 + Math.sin(x * 0.015) * 3;
    // Raise the bottom edge on the left side (where reflections are)
    let bottomRaise = 0;
    if (x < 50) {
      bottomRaise = (50 - x) / 200 * 8; // Gradually raise more toward the left
    }
    topShape.lineTo(x, HORIZON - 15 + wave + bottomRaise);
  }
  // Top edge at horizon
  topShape.lineTo(150, HORIZON);
  topShape.lineTo(-150, HORIZON);
  topShape.closePath();

  const topGeo = new THREE.ShapeGeometry(topShape);
  const topMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#2e0718") });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.z = -5;
  group.add(topMesh);

  return group;
}

// =============== LAKE REFLECTIONS ===============
function createReflections() {
  const group = new THREE.Group();

  // Wide, soft moon reflection on water - realistic shimmer effect
  const reflectionGeo = new THREE.PlaneGeometry(35, 32);
  const reflectionMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(palette.moonGlow) },
      coreColor: { value: new THREE.Color("#ffe8e8") },
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform vec3 coreColor;
      uniform float time;
      varying vec2 vUv;
      varying vec2 vWorldPos;
      
      void main() {
        // Clip to only show below the water line (y < -12 approximately)
        // The lake top edge is around HORIZON - 12, so clip above that
        if (vWorldPos.y > -10.0) {
          discard;
        }
        
        // Soft fade near the clip edge
        float clipFade = smoothstep(-10.0, -14.0, vWorldPos.y);
        
        // Center x position
        float xCenter = (vUv.x - 0.5) * 2.0;
        
        // Distance from vertical center line
        float xDist = abs(xCenter);
        
        // Create multiple overlapping shimmer bands that get wider toward bottom
        float yPos = vUv.y;
        float widthFactor = mix(0.8, 0.15, yPos); // wider at bottom (y=0), narrower at top (y=1)
        
        // Soft horizontal falloff - Gaussian-like
        float xFade = exp(-pow(xDist / widthFactor, 2.0) * 2.0);
        
        // Vertical fade - strongest near top (water line), fading toward bottom
        // More aggressive fade at the bottom to prevent seeping
        float yFade = smoothstep(0.0, 0.4, yPos) * smoothstep(1.0, 0.4, yPos);
        
        // Add shimmer waves for water ripple effect
        float wave1 = sin(yPos * 25.0 + time * 1.2 + xCenter * 3.0) * 0.5 + 0.5;
        float wave2 = sin(yPos * 15.0 - time * 0.8 + xCenter * 2.0) * 0.5 + 0.5;
        float wave3 = sin(yPos * 40.0 + time * 2.0) * 0.5 + 0.5;
        
        // Create broken, shimmering bands
        float shimmer = wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25;
        shimmer = smoothstep(0.3, 0.7, shimmer);
        
        // Core brightness in center
        float coreFade = exp(-pow(xDist / (widthFactor * 0.5), 2.0) * 3.0);
        
        // Combine everything
        float alpha = xFade * yFade * (0.3 + shimmer * 0.4);
        alpha += coreFade * yFade * shimmer * 0.3;
        
        // Apply clip fade
        alpha *= clipFade;
        
        // Mix colors - brighter core, softer edges
        vec3 finalColor = mix(color, coreColor, coreFade * 0.6);
        
        gl_FragColor = vec4(finalColor, alpha * 0.6);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Store reference for animation
  window.moonReflectionMaterial = reflectionMat;

  const reflection = new THREE.Mesh(reflectionGeo, reflectionMat);
  reflection.position.set(35, HORIZON - 20, 2); // Position in lake area, in front of tree reflections
  group.add(reflection);

  return group;
}

// =============== TREE REFLECTIONS IN LAKE ===============

// Manual geometry merge function (fallback if BufferGeometryUtils not available)
function mergeGeometriesManual(geometries) {
  let totalVertices = 0;
  let totalIndices = 0;

  geometries.forEach(geo => {
    totalVertices += geo.attributes.position.count;
    if (geo.index) {
      totalIndices += geo.index.count;
    } else {
      totalIndices += geo.attributes.position.count;
    }
  });

  const positions = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;
  let vertexCount = 0;

  geometries.forEach(geo => {
    const pos = geo.attributes.position.array;
    positions.set(pos, vertexOffset * 3);

    if (geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i++) {
        indices[indexOffset + i] = idx[i] + vertexOffset;
      }
      indexOffset += idx.length;
    } else {
      for (let i = 0; i < geo.attributes.position.count; i++) {
        indices[indexOffset + i] = vertexOffset + i;
      }
      indexOffset += geo.attributes.position.count;
    }

    vertexOffset += geo.attributes.position.count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// Transparent shader for reflections - soft vertical gradient
function createReflectionMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color("#4C0F34") },
      midColor: { value: new THREE.Color("#611342") },
      bottomColor: { value: new THREE.Color("#691548") },
      alpha: { value: opacity }
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform float alpha;
      varying vec2 vPos;
      
      void main() {
        // Normalize y position for gradient (water line around -10, tips around -25)
        float t = smoothstep(-28.0, -8.0, vPos.y);
        
        // 3-color vertical gradient
        vec3 color;
        if (t < 0.5) {
          color = mix(bottomColor, midColor, t * 2.0);
        } else {
          color = mix(midColor, topColor, (t - 0.5) * 2.0);
        }
        
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });
}

function createTreeReflections() {
  const group = new THREE.Group();

  // Create materials for trees and mountain
  const treeReflectionMat = createReflectionMaterial(0);
  const mountainReflectionMat = createReflectionMaterial(0.5);

  // Seeded random - same seed as pine forest for matching shapes
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  // Get the lake top edge Y position at a given X (matches the lake's top layer curve)
  function getLakeTopY(x) {
    const wave = Math.sin(x * 0.025 + 1) * 3 + Math.sin(x * 0.01 + 2) * 2;
    return HORIZON - 12 + wave;
  }

  // Mirror the exact pine tree shape - flip vertically with proper jagged branches
  function createMirroredPineTreeShape(centerX, baseY, height, baseWidth, treeSeed) {
    const points = [];

    // Use seeded random for consistent jagged edges
    const treeRandom = (s) => {
      const x = Math.sin(s * 9999) * 10000;
      return x - Math.floor(x);
    };
    let rs = treeSeed;

    // Pine cone shape mirrored: tip points DOWN, jagged branches pointing up
    // Start from the tip (bottom)
    points.push({ x: centerX, y: baseY - height });

    // Create layered branch silhouette going UP from tip
    // Widest at top (water line), narrowest at bottom (tip)
    const layers = 6 + Math.floor(treeRandom(rs++) * 3);

    // Left side - going from tip UP to water line
    for (let i = 1; i <= layers; i++) {
      const progress = i / layers;
      const layerY = baseY - height * (1 - progress);
      // Width increases as we go UP (toward water line)
      // Extra width boost near the top (water line) for softer reflection look
      const topBoost = 1.0 + progress * progress * 0.3;
      const layerWidth = baseWidth * progress * 0.5 * topBoost;

      // Jagged branch tips
      const branchTipOut = layerWidth * (1.1 + treeRandom(rs++) * 0.15);
      const branchTipIn = layerWidth * (0.85 + treeRandom(rs++) * 0.1);

      // Branch tip (pointing outward and slightly down)
      points.push({ x: centerX - branchTipOut, y: layerY - height * 0.02 });
      // Branch base (tucked in, slightly up toward water)
      if (i < layers) {
        points.push({ x: centerX - branchTipIn, y: layerY + height * 0.01 });
      }
    }

    // Top center (at water line) - slightly wider
    points.push({ x: centerX - baseWidth * 0.12, y: baseY });
    points.push({ x: centerX + baseWidth * 0.12, y: baseY });

    // Right side - going from water line DOWN to tip
    for (let i = layers; i >= 1; i--) {
      const progress = i / layers;
      const layerY = baseY - height * (1 - progress);
      // Match the top boost from left side
      const topBoost = 1.0 + progress * progress * 0.3;
      const layerWidth = baseWidth * progress * 0.5 * topBoost;

      const branchTipOut = layerWidth * (1.1 + treeRandom(rs++) * 0.15);
      const branchTipIn = layerWidth * (0.85 + treeRandom(rs++) * 0.1);

      if (i < layers) {
        points.push({ x: centerX + branchTipIn, y: layerY + height * 0.01 });
      }
      points.push({ x: centerX + branchTipOut, y: layerY - height * 0.02 });
    }

    return points;
  }

  // Collect all tree geometries to merge into one
  const treeGeometries = [];

  let seed = 12345;

  // Back layer - include slope height to match visual height of original trees
  for (let x = -140; x < 30; x += 2 + seededRandom(seed++) * 2) {
    // The slope adds to the visual height of trees
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const slopeHeight = Math.max(leftSlope, 2);

    const xFactor = Math.max(0, (x + 140) / 170);
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const treeHeight = (3 + seededRandom(seed++) * 2 + xFactor * 4) * leftReduction;
    const width = 4 + seededRandom(seed++) * 2.5;

    // Total visual height = tree height + slope contribution (scaled down)
    const height = treeHeight + slopeHeight * 0.5;

    const reflectionBaseY = getLakeTopY(x);
    const treePoints = createMirroredPineTreeShape(x, reflectionBaseY, height, width, seed);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    treeGeometries.push(new THREE.ShapeGeometry(shape));
    seed++;
  }

  // Middle layer
  for (let x = -145; x < 25; x += 2.5 + seededRandom(seed++) * 2.5) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const slopeHeight = Math.max(leftSlope, 2);

    const xFactor = Math.max(0, (x + 145) / 170);
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const treeHeight = (4 + seededRandom(seed++) * 3 + xFactor * 5) * leftReduction;
    const width = 4.5 + seededRandom(seed++) * 3;

    const height = treeHeight + slopeHeight * 0.5;

    const reflectionBaseY = getLakeTopY(x);
    const treePoints = createMirroredPineTreeShape(x, reflectionBaseY, height, width, seed);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    treeGeometries.push(new THREE.ShapeGeometry(shape));
    seed++;
  }

  // Front layer
  for (let x = -142; x < 20; x += 3 + seededRandom(seed++) * 3) {
    const leftSlope = 18 * Math.exp(-Math.pow((x + 60) / 40, 2));
    const slopeHeight = Math.max(leftSlope, 2);

    const xFactor = Math.max(0, (x + 142) / 162);
    const leftReduction = x < -60 ? 0.9 : 1.0;
    const treeHeight = (5 + seededRandom(seed++) * 4 + xFactor * 6) * leftReduction;
    const width = 5 + seededRandom(seed++) * 3.5;

    const height = treeHeight + slopeHeight * 0.5;

    const reflectionBaseY = getLakeTopY(x);
    const treePoints = createMirroredPineTreeShape(x, reflectionBaseY, height, width, seed);

    const shape = new THREE.Shape();
    shape.moveTo(treePoints[0].x, treePoints[0].y);
    for (let i = 1; i < treePoints.length; i++) {
      shape.lineTo(treePoints[i].x, treePoints[i].y);
    }
    shape.closePath();

    treeGeometries.push(new THREE.ShapeGeometry(shape));
    seed++;
  }

  // Add base strip along the lake top curve to fill gaps
  const baseShape = new THREE.Shape();
  baseShape.moveTo(-150, getLakeTopY(-150) - 3);
  for (let x = -150; x <= 50; x += 2) {
    baseShape.lineTo(x, getLakeTopY(x));
  }
  for (let x = 50; x >= -150; x -= 2) {
    baseShape.lineTo(x, getLakeTopY(x) - 3);
  }
  baseShape.closePath();
  treeGeometries.push(new THREE.ShapeGeometry(baseShape));

  // Merge all tree geometries into one - this prevents transparency stacking
  // When all trees are one mesh, they render as a single layer
  let mergedTreeGeo;
  if (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeGeometries) {
    mergedTreeGeo = THREE.BufferGeometryUtils.mergeGeometries(treeGeometries);
  } else {
    // Fallback: merge manually
    mergedTreeGeo = mergeGeometriesManual(treeGeometries);
  }
  const treeMesh = new THREE.Mesh(mergedTreeGeo, treeReflectionMat);
  treeMesh.position.z = 1;
  group.add(treeMesh);

  // Add reflection of the right mountain peak (front range)
  // Mirror the right mountain shape from createMidMountain
  const mountainReflectionShape = new THREE.Shape();
  const mtnReflectionPoints = [];

  // Generate the mountain profile (same formula as createMidMountain right side)
  for (let x = 30; x <= 150; x += 2) {
    const rightSlope = 15 * Math.exp(-Math.pow((x - 70) / 35, 2));
    const mountainHeight = Math.max(rightSlope, 2);
    mtnReflectionPoints.push({ x, y: mountainHeight });
  }

  // Create mirrored shape - starts at water line, goes down
  const mtnBaseY = getLakeTopY(30);
  mountainReflectionShape.moveTo(30, mtnBaseY);

  // Trace the mountain profile mirrored (going down into the water)
  for (let i = 0; i < mtnReflectionPoints.length; i++) {
    const p = mtnReflectionPoints[i];
    const localBaseY = getLakeTopY(p.x);
    mountainReflectionShape.lineTo(p.x, localBaseY - p.y);
  }

  // Close back along the water line
  mountainReflectionShape.lineTo(150, getLakeTopY(150));
  for (let x = 150; x >= 30; x -= 5) {
    mountainReflectionShape.lineTo(x, getLakeTopY(x));
  }
  mountainReflectionShape.closePath();

  const mtnReflectionGeo = new THREE.ShapeGeometry(mountainReflectionShape);
  const mtnReflectionMesh = new THREE.Mesh(mtnReflectionGeo, mountainReflectionMat);
  mtnReflectionMesh.position.z = 0.8; // Slightly behind tree reflections
  group.add(mtnReflectionMesh);

  return group;
}

// =============== FOREGROUND ===============
function createForeground() {
  const group = new THREE.Group();
  // Grass removed for cleaner lake shoreline look
  return group;
}

// =============== BUILD SCENE ===============
scene.add(createSky());
scene.add(createStars());
scene.add(createMoon());

const farMtn = createFarMountain();
farMtn.position.z = -8;
scene.add(farMtn);

const midMtn = createMidMountain();
midMtn.position.z = -6;
scene.add(midMtn);

const pines = createPineForest();
pines.position.z = -5.5;
scene.add(pines);

scene.add(createLake());
scene.add(createTreeReflections());
scene.add(createReflections());
scene.add(createForeground());

// =============== RENDER ===============
let startTime = Date.now();
function render() {
  const time = (Date.now() - startTime) * 0.001;

  // Update water animation
  if (window.waterMaterial) {
    window.waterMaterial.uniforms.time.value = time;
  }

  // Update moon reflection animation
  if (window.moonReflectionMaterial) {
    window.moonReflectionMaterial.uniforms.time.value = time;
  }

  // Update twinkling stars
  if (window.twinklingStars) {
    window.twinklingStars.forEach(star => {
      const twinkle = Math.sin(time * star.speed + star.phase) * 0.5 + 0.5;
      star.mesh.material.opacity = star.baseOpacity * (0.2 + twinkle * 0.8);
      star.mesh.material.needsUpdate = true;
    });
  }

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

console.log("[scene] Moonlit lake scene initialized");

// =============== DREAM DIALOG ===============
// Animated characters stored locally for reliable fast loading
const dreamCompanions = [
  // Animals - Cute faces
  { name: "Luna", subtitle: "Guardian of peaceful dreams", image: "emojis/unicorn_1f984.webp" },
  { name: "Mochi", subtitle: "Keeper of sweet memories", image: "emojis/rabbit-face_1f430.webp" },
  { name: "Cloud", subtitle: "Drifter of dreamy skies", image: "emojis/bear_1f43b.webp" },
  { name: "Whisper", subtitle: "Collector of midnight secrets", image: "emojis/fox_1f98a.webp" },
  { name: "Blossom", subtitle: "Tender of garden dreams", image: "emojis/cat-face_1f431.webp" },
  { name: "Nimbus", subtitle: "Shepherd of fluffy thoughts", image: "emojis/panda_1f43c.webp" },
  { name: "Twilight", subtitle: "Guide through shadow realms", image: "emojis/owl_1f989.webp" },
  { name: "Honey", subtitle: "Sweetener of nightmares", image: "emojis/honeybee_1f41d.webp" },
  { name: "Maple", subtitle: "Painter of autumn visions", image: "emojis/dog-face_1f436.webp" },
  { name: "Clover", subtitle: "Bringer of lucky dreams", image: "emojis/pig-face_1f437.webp" },
  { name: "Flicker", subtitle: "Spark of inspiration", image: "emojis/butterfly_1f98b.webp" },
  { name: "Cocoa", subtitle: "Warmer of cold nights", image: "emojis/hamster_1f439.webp" },
  { name: "Pebble", subtitle: "Guardian of tiny wishes", image: "emojis/mouse-face_1f42d.webp" },
  { name: "Sage", subtitle: "Ancient wisdom keeper", image: "emojis/turtle_1f422.webp" },
  { name: "Ember", subtitle: "Keeper of warm memories", image: "emojis/tiger-face_1f42f.webp" },
  { name: "Frost", subtitle: "Sculptor of ice castles", image: "emojis/polar-bear_1f43b-200d-2744-fe0f.webp" },
  { name: "Coral", subtitle: "Singer of ocean lullabies", image: "emojis/tropical-fish_1f420.webp" },
  { name: "Dewdrop", subtitle: "Morning's first kiss", image: "emojis/snail_1f40c.webp" },
  { name: "Petal", subtitle: "Dancer in flower fields", image: "emojis/lady-beetle_1f41e.webp" },
  { name: "Koda", subtitle: "Friend of the forest", image: "emojis/koala_1f428.webp" },
  { name: "Blaze", subtitle: "Spirit of adventure", image: "emojis/lion_1f981.webp" },
  { name: "Waddle", subtitle: "Explorer of icy lands", image: "emojis/penguin_1f427.webp" },
  { name: "Ribbit", subtitle: "Hopper between dimensions", image: "emojis/frog_1f438.webp" },
  { name: "Chirp", subtitle: "Messenger of dawn", image: "emojis/baby-chick_1f424.webp" },
  { name: "Orbit", subtitle: "Traveler of cosmic seas", image: "emojis/spouting-whale_1f433.webp" },

  // Celestial & Magical
  { name: "Starlight", subtitle: "Weaver of cosmic adventures", image: "emojis/glowing-star_1f31f.webp" },
  { name: "Sunny", subtitle: "Brightener of dark thoughts", image: "emojis/sun-with-face_1f31e.webp" },
  { name: "Rainbow", subtitle: "Bridge to happy places", image: "emojis/rainbow_1f308.webp" },
  { name: "Sparkle", subtitle: "Magic dust sprinkler", image: "emojis/sparkles_2728.webp" },
  { name: "Comet", subtitle: "Wish granter from afar", image: "emojis/dizzy_1f4ab.webp" },
  { name: "Breezy", subtitle: "Carrier of dream whispers", image: "emojis/cloud_2601-fe0f.webp" }
];

// Dialog elements
const dialogOverlay = document.getElementById('dreamDialogOverlay');
const dialogClose = document.getElementById('dialogClose');
const dialogCharacter = document.getElementById('dialogCharacter');
const dialogTitle = document.getElementById('dialogTitle');
const dialogSubtitle = document.getElementById('dialogSubtitle');
const addDreamBtn = document.querySelector('.add-dream-btn');
const btnClear = document.getElementById('btnClear');
const btnSave = document.getElementById('btnSave');
const dreamDate = document.getElementById('dreamDate');

// LocalStorage key for draft
const DREAM_DRAFT_KEY = 'dreamJournalDraft';

// Set today's date as default
if (dreamDate) {
  const today = new Date().toISOString().split('T')[0];
  dreamDate.value = today;
}

// Get a random companion (different from last one if possible)
let lastCompanionIndex = -1;
function getRandomCompanion() {
  let index;
  if (dreamCompanions.length > 1) {
    do {
      index = Math.floor(Math.random() * dreamCompanions.length);
    } while (index === lastCompanionIndex);
  } else {
    index = 0;
  }
  lastCompanionIndex = index;
  return dreamCompanions[index];
}

// Save draft to localStorage
function saveDreamDraft() {
  const draft = {
    title: document.getElementById('dreamTitle').value,
    content: document.getElementById('dreamContent').value,
    mood: document.getElementById('dreamMood').value,
    date: document.getElementById('dreamDate').value,
    companionIndex: lastCompanionIndex // Save the current companion
  };
  localStorage.setItem(DREAM_DRAFT_KEY, JSON.stringify(draft));
}

// Clear draft from localStorage
function clearDreamDraft() {
  localStorage.removeItem(DREAM_DRAFT_KEY);
}

// Load draft from localStorage
function loadDreamDraft() {
  const saved = localStorage.getItem(DREAM_DRAFT_KEY);
  return saved ? JSON.parse(saved) : null;
}

// Open dialog
function openDreamDialog() {
  // Try to load saved draft first to check for saved companion
  const draft = loadDreamDraft();

  let companion;
  if (draft && draft.companionIndex !== undefined && draft.companionIndex >= 0 && draft.companionIndex < dreamCompanions.length) {
    // Restore the saved companion
    lastCompanionIndex = draft.companionIndex;
    companion = dreamCompanions[draft.companionIndex];
  } else {
    // Get a random companion
    companion = getRandomCompanion();
  }

  dialogCharacter.src = companion.image;
  dialogTitle.textContent = companion.name;
  dialogSubtitle.textContent = companion.subtitle;

  if (draft) {
    // Restore from saved draft
    document.getElementById('dreamTitle').value = draft.title || '';
    document.getElementById('dreamContent').value = draft.content || '';
    document.getElementById('dreamMood').value = draft.mood || 'peaceful';
    if (dreamDate) {
      dreamDate.value = draft.date || new Date().toISOString().split('T')[0];
    }
  } else {
    // Reset form to defaults
    document.getElementById('dreamTitle').value = '';
    document.getElementById('dreamContent').value = '';
    document.getElementById('dreamMood').value = 'peaceful';
    if (dreamDate) {
      dreamDate.value = new Date().toISOString().split('T')[0];
    }
  }

  dialogOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Open dream dialog for a specific date
function openDreamDialogForDate(dateStr) {
  // Clear any existing draft
  clearDreamDraft();

  // Get a random companion
  const companion = getRandomCompanion();
  dialogCharacter.src = companion.image;
  dialogTitle.textContent = companion.name;
  dialogSubtitle.textContent = companion.subtitle;

  // Reset form with the specific date
  document.getElementById('dreamTitle').value = '';
  document.getElementById('dreamContent').value = '';
  document.getElementById('dreamMood').value = 'peaceful';
  if (dreamDate) {
    dreamDate.value = dateStr;
  }

  dialogOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Show a saved dream in tarot card view
function showDreamView(dream) {
  const tarotOverlay = document.getElementById('tarotOverlay');
  const tarotTitle = document.getElementById('tarotTitle');
  const tarotContent = document.getElementById('tarotContent');
  const tarotDate = document.getElementById('tarotDate');
  const tarotMoodIcon = document.getElementById('tarotMoodIcon');

  // Month names for theme classes
  const monthThemes = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  // Mood icons mapping
  const moodIcons = {
    peaceful: '🌙',
    adventurous: '⚔️',
    mysterious: '🔮',
    scary: '👁️',
    happy: '✨',
    sad: '💧'
  };

  // Remove any existing month theme classes
  monthThemes.forEach(month => tarotOverlay.classList.remove(`month-${month}`));

  // Apply month theme based on dream date
  if (dream.date) {
    const dateObj = new Date(dream.date + 'T00:00:00');
    const monthIndex = dateObj.getMonth(); // 0-11
    tarotOverlay.classList.add(`month-${monthThemes[monthIndex]}`);
  } else {
    // Default to December (golden mystic) if no date
    tarotOverlay.classList.add('month-december');
  }

  // Set mood icon
  tarotMoodIcon.textContent = moodIcons[dream.mood] || '✨';

  // Set dream title
  tarotTitle.textContent = dream.title || 'Untitled Dream';

  // Set dream content
  tarotContent.innerHTML = `<p>${dream.content || 'No description recorded...'}</p>`;

  // Format and set date
  if (dream.date) {
    const dateObj = new Date(dream.date + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = dateObj.toLocaleDateString('en-US', options);
    tarotDate.querySelector('.date-text').textContent = formattedDate;
  } else {
    tarotDate.querySelector('.date-text').textContent = 'Unknown Date';
  }

  // Show the tarot overlay
  tarotOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close tarot card view
function closeTarotView() {
  const tarotOverlay = document.getElementById('tarotOverlay');
  tarotOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Tarot overlay event listeners
const tarotOverlay = document.getElementById('tarotOverlay');
const tarotClose = document.getElementById('tarotClose');

if (tarotClose) {
  tarotClose.addEventListener('click', closeTarotView);
}

if (tarotOverlay) {
  tarotOverlay.addEventListener('click', (e) => {
    if (e.target === tarotOverlay) {
      closeTarotView();
    }
  });
}

// Add keyboard support for tarot card
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tarotOverlay && tarotOverlay.classList.contains('active')) {
    closeTarotView();
  }
});

// Close dialog (saves draft automatically)
function closeDreamDialog() {
  saveDreamDraft();
  dialogOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Event listeners
if (addDreamBtn) {
  addDreamBtn.addEventListener('click', openDreamDialog);
}

if (dialogClose) {
  dialogClose.addEventListener('click', closeDreamDialog);
}

if (btnClear) {
  btnClear.addEventListener('click', () => {
    // Clear the form
    document.getElementById('dreamTitle').value = '';
    document.getElementById('dreamContent').value = '';
    document.getElementById('dreamMood').value = 'peaceful';
    if (dreamDate) {
      dreamDate.value = new Date().toISOString().split('T')[0];
    }
    // Clear the saved draft
    clearDreamDraft();

    // Pick a new random companion
    const newCompanion = getRandomCompanion();
    dialogCharacter.src = newCompanion.image;
    dialogTitle.textContent = newCompanion.name;
    dialogSubtitle.textContent = newCompanion.subtitle;
  });
}

if (dialogOverlay) {
  dialogOverlay.addEventListener('click', (e) => {
    if (e.target === dialogOverlay) {
      closeDreamDialog();
    }
  });
}

// Handle save - actually save to localStorage
const SAVED_DREAMS_KEY = 'dreamJournalDreams';

// Get all saved dreams from localStorage
function getSavedDreams() {
  const saved = localStorage.getItem(SAVED_DREAMS_KEY);
  return saved ? JSON.parse(saved) : [];
}

// Save a dream to localStorage
function saveDream(dream) {
  const dreams = getSavedDreams();
  dreams.push(dream);
  localStorage.setItem(SAVED_DREAMS_KEY, JSON.stringify(dreams));
  return dreams;
}

if (btnSave) {
  btnSave.addEventListener('click', () => {
    const title = document.getElementById('dreamTitle').value.trim();
    const content = document.getElementById('dreamContent').value.trim();
    const mood = document.getElementById('dreamMood').value;
    const date = document.getElementById('dreamDate').value;

    if (title && content) {
      // Create dream object with unique ID and timestamp
      const dream = {
        id: Date.now().toString(),
        title,
        content,
        mood,
        date,
        createdAt: new Date().toISOString(),
        companionIndex: lastCompanionIndex
      };

      // Save to localStorage
      const allDreams = saveDream(dream);
      console.log('Dream saved:', dream);
      console.log('Total dreams:', allDreams.length);

      // Clear the draft since we're saving
      clearDreamDraft();

      // Start the letter-to-moon animation
      startLetterToMoonAnimation();
    } else {
      // Simple validation feedback
      if (!title) document.getElementById('dreamTitle').focus();
      else if (!content) document.getElementById('dreamContent').focus();
    }
  });
}

// =============== LETTER TO MOON ANIMATION ===============
function startLetterToMoonAnimation() {
  const dialog = document.querySelector('.dream-dialog');
  const overlay = document.getElementById('dreamDialogOverlay');

  // Get dialog center position
  const dialogRect = dialog.getBoundingClientRect();
  const dialogCenterX = dialogRect.left + dialogRect.width / 2;
  const dialogCenterY = dialogRect.top + dialogRect.height / 2;

  // Calculate moon position on screen
  // The moon is at position (35, 28) in Three.js orthographic space
  // In our camera setup: camera is OrthographicCamera(-100, 100, 50, -50, -100, 100)
  // So the viewport maps x: -100 to 100 and y: -50 to 50
  const canvasEl = document.getElementById('scene');
  const canvasRect = canvasEl.getBoundingClientRect();

  // Convert Three.js coordinates to screen coordinates
  // Moon is at x=35 (range -100 to 100) -> normalized: (35 + 100) / 200 = 0.675
  // Moon is at y=28 (range -50 to 50) -> normalized: (50 - 28) / 100 = 0.22 (inverted because screen y is top-down)
  const moonNormX = (35 + 100) / 200;
  const moonNormY = (50 - 28) / 100;
  const moonScreenX = canvasRect.left + canvasRect.width * moonNormX;
  const moonScreenY = canvasRect.top + canvasRect.height * moonNormY;

  // Add shrinking class to dialog
  dialog.classList.add('shrinking');

  // Create the letter early - it grows as the popup shrinks
  setTimeout(() => {
    // Create the flying letter element
    const letter = document.createElement('div');
    letter.className = 'flying-letter growing';

    // Add glow
    const glow = document.createElement('div');
    glow.className = 'flying-letter-glow';
    letter.appendChild(glow);

    // Add wings
    const leftWing = document.createElement('div');
    leftWing.className = 'letter-wing-left';
    letter.appendChild(leftWing);

    const rightWing = document.createElement('div');
    rightWing.className = 'letter-wing-right';
    letter.appendChild(rightWing);

    // Position at dialog center (adjusted for larger letter size: 140x100)
    letter.style.left = (dialogCenterX - 70) + 'px';
    letter.style.top = (dialogCenterY - 50) + 'px';

    document.body.appendChild(letter);

    // Wait for grow animation to complete, then start flying
    setTimeout(() => {
      // Hide the dialog overlay
      overlay.style.opacity = '0';

      // Remove growing class, start flying
      letter.classList.remove('growing');

      // Animate the letter flying to the moon
      animateLetterToMoon(letter, dialogCenterX, dialogCenterY, moonScreenX, moonScreenY, () => {
        // Create moon flash effect
        createMoonFlash(moonScreenX, moonScreenY);

        // Remove letter
        letter.remove();

        // Clean up and close dialog
        setTimeout(() => {
          dialog.classList.remove('shrinking');
          overlay.classList.remove('active');
          overlay.style.opacity = '';
          document.body.style.overflow = '';
        }, 300);
      });
    }, 600); // Wait for letter grow animation

  }, 300); // Start letter appearing partway through shrink
}

function animateLetterToMoon(letter, startX, startY, endX, endY, onComplete) {
  const duration = 2000; // 2 seconds for the flight
  const startTime = performance.now();

  // Control points for bezier curve (creates arc path)
  // Go up and then curve toward the moon
  const cp1x = startX + (endX - startX) * 0.1;
  const cp1y = startY - 200; // Go up first
  const cp2x = startX + (endX - startX) * 0.6;
  const cp2y = Math.min(startY, endY) - 150; // Arc high

  // Sparkle trail positions for delay
  let lastSparkleTime = 0;
  const sparkleInterval = 80; // ms between sparkles

  function bezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use easeOutQuart for smooth deceleration as it approaches moon
    const easeProgress = 1 - Math.pow(1 - progress, 4);

    // Calculate position on bezier curve
    const x = bezierPoint(easeProgress, startX, cp1x, cp2x, endX);
    const y = bezierPoint(easeProgress, startY, cp1y, cp2y, endY);

    // Scale down as it gets closer to moon (1 -> 0.1)
    const scale = 1 - (progress * 0.9);

    // Add slight rotation for more dynamic feel
    const rotate = Math.sin(progress * Math.PI * 8) * 5 + (progress * -15);

    // Update letter position and scale
    letter.style.left = (x - 40 * scale) + 'px';
    letter.style.top = (y - 30 * scale) + 'px';
    letter.style.transform = `scale(${scale}) rotate(${rotate}deg)`;

    // Create sparkle trail
    if (currentTime - lastSparkleTime > sparkleInterval && progress < 0.9) {
      createSparkle(x, y);
      lastSparkleTime = currentTime;
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  }

  requestAnimationFrame(animate);
}

function createSparkle(x, y) {
  const sparkle = document.createElement('div');
  sparkle.className = 'letter-sparkle';

  // Random offset for variety
  const offsetX = (Math.random() - 0.5) * 40;
  const offsetY = (Math.random() - 0.5) * 30;

  sparkle.style.left = (x + offsetX) + 'px';
  sparkle.style.top = (y + offsetY) + 'px';
  sparkle.style.width = (4 + Math.random() * 6) + 'px';
  sparkle.style.height = sparkle.style.width;

  document.body.appendChild(sparkle);

  // Remove after animation
  setTimeout(() => sparkle.remove(), 600);
}

function createMoonFlash(x, y) {
  const flash = document.createElement('div');
  flash.className = 'moon-flash';
  flash.style.left = (x - 60) + 'px';
  flash.style.top = (y - 60) + 'px';
  flash.style.width = '120px';
  flash.style.height = '120px';

  document.body.appendChild(flash);

  // Remove after animation
  setTimeout(() => flash.remove(), 800);
}

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dialogOverlay.classList.contains('active')) {
    closeDreamDialog();
  }
});

console.log("[dialog] Dream dialog initialized");

// =============== CALENDAR VIEW ===============
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Calendar DOM elements
const calendarView = document.getElementById('calendarView');
const calendarBack = document.getElementById('calendarBack');
const calendarMonthEl = document.getElementById('calendarMonth');
const calendarYearEl = document.getElementById('calendarYear');
const calendarGrid = document.getElementById('calendarGrid');
const sidebarContent = document.querySelector('.sidebar-content');
const monthCards = document.querySelectorAll('.month-card');

// Generate calendar for a specific month (0-indexed month, year)
function generateCalendar(month, year) {
  calendarGrid.innerHTML = '';

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Get today for highlighting
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Get all saved dreams to check which days have dreams
  const allDreams = getSavedDreams();

  // Add previous month's trailing days
  for (let i = 0; i < firstDay; i++) {
    const day = daysInPrevMonth - firstDay + 1 + i;
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day other-month';
    dayEl.textContent = day;
    calendarGrid.appendChild(dayEl);
  }

  // Add current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    // Check if weekend (Sunday = 0, Saturday = 6)
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      dayEl.classList.add('weekend');
    }

    // Check if today
    if (isCurrentMonth && day === todayDate) {
      dayEl.classList.add('today');
    }

    // Format date string for comparison (YYYY-MM-DD)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Find dreams for this day
    const dreamsForDay = allDreams.filter(d => d.date === dateStr);

    if (dreamsForDay.length > 0) {
      dayEl.classList.add('has-dream');
      dayEl.title = `${dreamsForDay.length} dream(s)`;
    }

    // Click handler for day - show dreams if any exist
    dayEl.addEventListener('click', () => {
      if (dreamsForDay.length > 0) {
        // Show the first dream for this day
        showDreamView(dreamsForDay[0]);
      } else {
        // Open dialog to add a new dream for this date
        openDreamDialogForDate(dateStr);
      }
    });

    calendarGrid.appendChild(dayEl);
  }

  // Add next month's leading days to complete the grid
  const totalCells = firstDay + daysInMonth;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainingCells; i++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day other-month';
    dayEl.textContent = i;
    calendarGrid.appendChild(dayEl);
  }
}

// Show calendar view for a specific month
function showCalendar(monthIndex) {
  // Use current year dynamically so saved dreams match
  const year = new Date().getFullYear();

  // Update header
  calendarMonthEl.textContent = monthNames[monthIndex];
  calendarYearEl.textContent = year;

  // Generate the calendar
  generateCalendar(monthIndex, year);

  // Switch views
  sidebarContent.classList.add('hidden');
  calendarView.classList.add('active');
}

// Hide calendar and return to month cards
function hideCalendar() {
  calendarView.classList.remove('active');
  sidebarContent.classList.remove('hidden');
}

// Add click handlers to month cards
monthCards.forEach((card, index) => {
  card.addEventListener('click', () => {
    showCalendar(index);
  });
});

// Back button handler
if (calendarBack) {
  calendarBack.addEventListener('click', hideCalendar);
}

console.log("[calendar] Calendar view initialized");
