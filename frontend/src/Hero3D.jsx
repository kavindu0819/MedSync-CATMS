import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import heroImage from "./assets/hero.jpg";
import "./Hero3D.css";

// Aligns the 3D neural brain projection directly over the laptop screen's brain
const BRAIN_POS = new THREE.Vector3(0.82, 0.52, 0.65);
const BRAIN_SCALE = 0.65;

function buildBrain(count = 820) {
  const pts = [];
  while (pts.length < count) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    let x = r * Math.cos(t);
    let y = u;
    let z = r * Math.sin(t);
    if (y < -0.38) continue;

    // Distinct left/right cerebral hemispheres with longitudinal fissure
    const side = x >= 0 ? 1 : -1;
    x = x * 1.4 + side * 0.08;
    y = y * 0.95;
    z = z * 1.08;

    // Convolutions (gyri and sulci)
    const wrinkle =
      1 +
      0.08 * Math.sin(x * 7.5 + y * 5.0) * Math.cos(z * 6.5) +
      0.05 * Math.sin(y * 11.0 + z * 9.0);

    pts.push(new THREE.Vector3(x * wrinkle, y * wrinkle, z * wrinkle));
  }
  return pts;
}

export default function Hero3D() {
  const mountRef = useRef(null);
  const hudRef = useRef(null);
  const spotlightRef = useRef(null);
  const [vitals, setVitals] = useState({
    bpm: 74,
    spo2: 99,
    load: 68,
    synapses: 94.2,
  });

  // Dynamic clinical vitals simulation
  useEffect(() => {
    const id = setInterval(() => {
      setVitals({
        bpm: 72 + Math.round(Math.random() * 6),
        spo2: 98 + Math.round(Math.random() * 2),
        load: 62 + Math.round(Math.random() * 16),
        synapses: Number((93 + Math.random() * 5.5).toFixed(1)),
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 5.2);

    const root = new THREE.Group();
    scene.add(root);
    const disposables = [];

    // 3. Photo Layer (Medical laptop with hands and stethoscope)
    const photoGroup = new THREE.Group();
    root.add(photoGroup);

    let photoMesh = null;
    const texLoader = new THREE.TextureLoader();
    texLoader.load(heroImage, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const imgAspect = tex.image.width / tex.image.height;
      const h = 4.75;
      const geo = new THREE.PlaneGeometry(h * imgAspect, h);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.96,
      });
      photoMesh = new THREE.Mesh(geo, mat);
      photoMesh.position.set(0, 0, -1.1);
      photoMesh.scale.setScalar(1.32);
      photoGroup.add(photoMesh);
      disposables.push(geo, mat, tex);
      adjustPhotoCover();
    });

    // 4. 3D Neural Brain Hologram
    const brain = new THREE.Group();
    brain.position.copy(BRAIN_POS);
    brain.scale.setScalar(BRAIN_SCALE);
    root.add(brain);

    const pts = buildBrain(820);
    const posArr = new Float32Array(pts.length * 3);
    const phase = new Float32Array(pts.length);
    const size = new Float32Array(pts.length);

    pts.forEach((p, i) => {
      posArr.set([p.x, p.y, p.z], i * 3);
      phase[i] = Math.random() * 6.283;
      size[i] = Math.random() < 0.12 ? 3.6 : 1.3 + Math.random() * 0.9;
    });

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    pGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

    // Custom shader for pulsing neurons with medical laser scan sweep
    const pMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPx;
        varying float vGlow;
        varying float vScan;

        void main() {
          // Dynamic synaptic pulse
          float pulse = 0.5 + 0.5 * sin(uTime * 2.4 + aPhase);
          
          // Medical scanning beam passing vertically through brain
          float scanCenter = sin(uTime * 1.1) * 1.05;
          float scanDist = abs(position.y - scanCenter);
          float scan = smoothstep(0.32, 0.0, scanDist);
          
          vGlow = clamp(pulse * 0.65 + scan * 1.35, 0.0, 2.0);
          vScan = scan;

          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1.1 + vGlow * 0.75) * uPx * (9.5 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vGlow;
        varying float vScan;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          
          // Soft pink/crimson neural core shifting to electric cyan when scanned
          vec3 baseNeural = vec3(1.0, 0.30, 0.46);
          vec3 scanCyber  = vec3(0.24, 0.88, 1.0);
          vec3 peakWhite  = vec3(1.0, 0.96, 0.98);

          vec3 col = mix(baseNeural, scanCyber, clamp(vScan * 0.85, 0.0, 1.0));
          col = mix(col, peakWhite, clamp(vGlow - 0.7, 0.0, 1.0));

          gl_FragColor = vec4(col, a * (0.4 + vGlow * 0.6));
        }
      `,
    });
    const brainPoints = new THREE.Points(pGeo, pMat);
    brain.add(brainPoints);

    // Neural Synapse Connecting Lines
    const linkPos = [];
    for (let i = 0; i < pts.length; i++) {
      let count = 0;
      for (let j = i + 1; j < pts.length && count < 3; j++) {
        if (pts[i].distanceTo(pts[j]) < 0.33) {
          linkPos.push(
            pts[i].x, pts[i].y, pts[i].z,
            pts[j].x, pts[j].y, pts[j].z
          );
          count++;
        }
      }
    }
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPos, 3));
    const lMat = new THREE.LineBasicMaterial({
      color: 0xffa3bb,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const brainLines = new THREE.LineSegments(lGeo, lMat);
    brain.add(brainLines);

    // Radial Holographic Glow behind the brain
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = 128;
    haloCanvas.height = 128;
    const haloCtx = haloCanvas.getContext("2d");
    const haloGrd = haloCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    haloGrd.addColorStop(0, "rgba(255, 75, 120, 0.65)");
    haloGrd.addColorStop(0.5, "rgba(56, 189, 248, 0.22)");
    haloGrd.addColorStop(1, "rgba(15, 23, 42, 0)");
    haloCtx.fillStyle = haloGrd;
    haloCtx.fillRect(0, 0, 128, 128);

    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(3.8, 3.8, 1);
    halo.position.set(0, 0, -0.35);
    brain.add(halo);

    // 5. 3D Floating Cyber Particles (Data telemetry motes)
    const particleCount = 180;
    const dPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      dPos.set(
        [
          (Math.random() - 0.5) * 11,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 4.5,
        ],
        i * 3
      );
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.038,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dGeo, dMat);
    root.add(dust);

    disposables.push(pGeo, pMat, lGeo, lMat, haloMat, haloTex, dGeo, dMat);

    // Resize and viewport cover handling
    function adjustPhotoCover() {
      if (!photoMesh || !mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      const containerAspect = w / h;
      // Adjust scale to cover hero viewport
      const baseScale = containerAspect > 1.4 ? 1.45 : 1.3;
      photoMesh.scale.setScalar(baseScale);
    }

    function resize() {
      if (!mount) return;
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      pMat.uniforms.uPx.value = renderer.getPixelRatio();
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 0.95 ? 6.1 : 5.2;
      camera.updateProjectionMatrix();
      adjustPhotoCover();
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Smooth cursor tracking with damping
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    function onMove(e) {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      // Position specular light glint on doctor's stethoscope & laptop
      if (spotlightRef.current) {
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        spotlightRef.current.style.background = `radial-gradient(circle 380px at ${px}% ${py}%, rgba(56, 189, 248, 0.18), transparent 70%)`;
      }
    }
    window.addEventListener("pointermove", onMove);

    // Animation loop
    const clock = new THREE.Clock();
    let raf;

    function frame() {
      const t = clock.getElapsedTime();

      // Smooth inertia lerp for 3D camera / parallax
      cur.x += (target.x - cur.x) * 0.055;
      cur.y += (target.y - cur.y) * 0.055;

      pMat.uniforms.uTime.value = t;

      if (!reduced) {
        // Subtle organic breathing oscillation on hands & laptop
        const breath = Math.sin(t * 0.85) * 0.035;

        // Photo layer parallax & gentle floating tilt
        photoGroup.position.x = -cur.x * 0.16;
        photoGroup.position.y = -cur.y * 0.10 + breath;
        photoGroup.rotation.y = cur.x * 0.08;
        photoGroup.rotation.x = -cur.y * 0.05;

        // 3D Brain holographic rotation & dynamic scanning pulse
        brain.rotation.y = t * 0.24 + cur.x * 0.42;
        brain.rotation.x = Math.sin(t * 0.4) * 0.09 - cur.y * 0.22;
        brain.position.x = BRAIN_POS.x + cur.x * 0.18;
        brain.position.y = BRAIN_POS.y + Math.sin(t * 0.95) * 0.05 - cur.y * 0.12;

        lMat.opacity = 0.22 + 0.10 * Math.sin(t * 1.8);

        // Cyber motes drift
        dust.rotation.y = t * 0.025;
        dust.position.y = Math.sin(t * 0.35) * 0.08;
      }

      // Root perspective tilt
      root.rotation.y = cur.x * 0.12;
      root.rotation.x = cur.y * 0.07;

      // 3D tilt on HUD card
      if (hudRef.current) {
        hudRef.current.style.transform = `perspective(900px) rotateY(${cur.x * -7}deg) rotateX(${cur.y * 6}deg)`;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      disposables.forEach((d) => d?.dispose?.());
      renderer.dispose();
      if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="hero3d" aria-hidden="true">
      {/* Three.js WebGL Canvas */}
      <div className="hero3d__canvas" ref={mountRef} />

      {/* Dynamic Cursor Light Glint (reflects off stethoscope and laptop) */}
      <div className="hero3d__spotlight" ref={spotlightRef} />

      {/* Ambient Vignette & Contrast Scrim */}
      <div className="hero3d__shade" />

      {/* Holographic Diagnostic Brain Reticle */}
      <div className="hero3d__reticle">
        <div className="reticle__ring" />
        <div className="reticle__scan-beam" />
        <div className="reticle__tag">
          <span className="reticle__pulse" />
          <span>NEURAL SCAN · CEREBRAL ACTIVE</span>
        </div>
      </div>

      {/* Futuristic Clinical HUD Card */}
      <div className="hero3d__hud" ref={hudRef}>
        <div className="hud__header">
          <span className="hud__dot" />
          <span className="hud__status">CATMS LIVE TELEMETRY</span>
          <span className="hud__badge">99.8% SYNC</span>
        </div>

        {/* Real-time ECG Pulse Line */}
        <div className="hud__wave-wrap">
          <svg className="hud__ecg" viewBox="0 0 220 44" preserveAspectRatio="none">
            <polyline
              points="0,22 28,22 36,22 42,6 48,38 54,22 88,22 96,22 102,7 108,36 114,22 148,22 156,22 162,5 168,39 174,22 220,22"
            />
          </svg>
          <div className="hud__sweep-line" />
        </div>

        <div className="hud__stats">
          <div className="hud__stat">
            <small>Heart Rate</small>
            <b>{vitals.bpm} <span className="stat__unit">bpm</span></b>
          </div>
          <div className="hud__stat">
            <small>SpO₂ Oxygen</small>
            <b>{vitals.spo2} <span className="stat__unit">%</span></b>
          </div>
          <div className="hud__stat">
            <small>Cognitive Load</small>
            <b>{vitals.load} <span className="stat__unit">%</span></b>
          </div>
        </div>
      </div>
    </div>
  );
}
