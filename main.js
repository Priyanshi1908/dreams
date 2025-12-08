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
    const softMax = Math.pow(Math.pow(leftPeak, 1.8) + Math.pow(centerPeak, 1.55) + Math.pow(rightPeak, 1.6), 1/1.6);
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
