"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Edges } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const BUILDINGS = [
  { name: "Rialo Wheel", color: "#d7ff1f", position: [-9, 0, -7] },
  { name: "Cube Runner", color: "#5fd0ff", position: [9, 0, -7] },
  { name: "Battle Arena", color: "#ff5f7a", position: [-9, 0, 9] },
  { name: "Token Match", color: "#ffb85f", position: [9, 0, 9] },
];

const LAMP_POSITIONS = [
  [-4, 0, -15],
  [4, 0, -15],
  [-17, 0, -1],
  [17, 0, -1],
  [-17, 0, 11],
  [17, 0, 11],
  [-4, 0, 17],
  [4, 0, 17],
];

const ROADS = [
  { from: [0, 0, 0], to: [-9, 0, -7] },
  { from: [0, 0, 0], to: [9, 0, -7] },
  { from: [0, 0, 0], to: [-9, 0, 9] },
  { from: [0, 0, 0], to: [9, 0, 9] },
  { from: [0, 0, 0], to: [0, 0, 18] },
];

const GROUND_SIZE = 44;
const AVATAR_SPEED = 3.5;
const ENTER_RADIUS = 3.4;

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#04050a" />
    </mesh>
  );
}

function Road({ from, to, width = 2.6 }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[2] + to[2]) / 2;
  return (
    <group position={[mx, 0.015, mz]} rotation={[0, angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#0d0f1a" />
      </mesh>
      <mesh position={[width / 2 - 0.05, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, length]} />
        <meshBasicMaterial color="#4a5fb8" toneMapped={false} />
      </mesh>
      <mesh position={[-(width / 2 - 0.05), 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, length]} />
        <meshBasicMaterial color="#4a5fb8" toneMapped={false} />
      </mesh>
    </group>
  );
}

function StreetLamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 3, 8]} />
        <meshStandardMaterial color="#0d0e14" />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color="#7fffe0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3.05, 0]} color="#7fffe0" intensity={1.4} distance={6} />
    </group>
  );
}

function Building({ data }) {
  return (
    <group position={data.position}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[3.2, 4, 3.2]} />
        <meshBasicMaterial color="#05070a" transparent opacity={0.5} />
        <Edges scale={1.001} threshold={15} color={data.color} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.9, 2.15, 40]} />
        <meshBasicMaterial
          color={data.color}
          toneMapped={false}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html position={[0, 4.8, 0]} center distanceFactor={16} occlude={false}>
        <div
          style={{
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            textShadow: "0 0 6px #000, 0 0 3px #000",
            pointerEvents: "none",
          }}
        >
          {data.name}
        </div>
      </Html>
    </group>
  );
}

function RobotBox({ args, intensity = 0.3, offsetY = 0 }) {
  return (
    <mesh position={[0, offsetY, 0]}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#0c0d10" emissive="#d7ff1f" emissiveIntensity={intensity} />
      <Edges color="#d7ff1f" />
    </mesh>
  );
}

function Leg({ x, legRef }) {
  return (
    <group ref={legRef} position={[x, 0.7, 0]}>
      <RobotBox args={[0.22, 0.7, 0.22]} offsetY={-0.35} />
    </group>
  );
}

function Arm({ x, armRef }) {
  return (
    <group ref={armRef} position={[x, 1.275, 0]}>
      <RobotBox args={[0.16, 0.55, 0.16]} offsetY={-0.275} />
    </group>
  );
}

function Avatar({ posRef, facingRef, moveRef }) {
  const groupRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const walkTimeRef = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, 0, posRef.current.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        facingRef.current,
        0.18
      );
    }

    const speed = Math.hypot(moveRef.current.x, moveRef.current.y);
    if (speed > 0.05) {
      walkTimeRef.current += delta * (5 + speed * 4);
    }
    const targetSwing = speed > 0.05 ? Math.sin(walkTimeRef.current) * 0.7 : 0;
    const lerpAmt = 0.25;

    if (leftLegRef.current)
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, targetSwing, lerpAmt);
    if (rightLegRef.current)
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -targetSwing, lerpAmt);
    if (leftArmRef.current)
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -targetSwing * 0.6, lerpAmt);
    if (rightArmRef.current)
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targetSwing * 0.6, lerpAmt);
  });

  return (
    <group ref={groupRef}>
      <Leg x={-0.22} legRef={leftLegRef} />
      <Leg x={0.22} legRef={rightLegRef} />
      <RobotBox args={[0.7, 0.6, 0.4]} intensity={0.35} offsetY={1.05} />
      <Arm x={-0.48} armRef={leftArmRef} />
      <Arm x={0.48} armRef={rightArmRef} />
      <RobotBox args={[0.42, 0.38, 0.4]} intensity={0.4} offsetY={1.55} />
      <mesh position={[0, 1.56, 0.21]}>
        <boxGeometry args={[0.26, 0.08, 0.02]} />
        <meshBasicMaterial color="#d7ff1f" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.86, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 6]} />
        <meshStandardMaterial color="#111319" />
      </mesh>
      <mesh position={[0, 1.99, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#d7ff1f" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.82, 40]} />
        <meshBasicMaterial
          color="#d7ff1f"
          toneMapped={false}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function CameraRig({ posRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  useFrame(() => {
    targetPos.current.set(posRef.current.x + 8, 12, posRef.current.z + 12);
    camera.position.lerp(targetPos.current, 0.08);
    camera.lookAt(posRef.current.x, 1, posRef.current.z);
  });
  return null;
}

function SceneLogic({ posRef, moveRef, facingRef, onNear }) {
  useFrame((state, delta) => {
    const jx = moveRef.current.x;
    const jy = moveRef.current.y;
    if (jx !== 0 || jy !== 0) {
      posRef.current.x += jx * AVATAR_SPEED * delta;
      posRef.current.z += jy * AVATAR_SPEED * delta;
      facingRef.current = Math.atan2(jx, jy);

      const half = GROUND_SIZE / 2 - 1;
      posRef.current.x = Math.max(-half, Math.min(half, posRef.current.x));
      posRef.current.z = Math.max(-half, Math.min(half, posRef.current.z));
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const b of BUILDINGS) {
      const dx = posRef.current.x - b.position[0];
      const dz = posRef.current.z - b.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < ENTER_RADIUS && dist < nearestDist) {
        nearest = b;
        nearestDist = dist;
      }
    }
    onNear(nearest);
  });
  return null;
}

// Drag-anywhere movement (works with touch on mobile and mouse on desktop)
function useDragMove(moveRef) {
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const maxDist = 70;

  const start = (x, y) => {
    draggingRef.current = true;
    startRef.current = { x, y };
  };
  const move = (x, y) => {
    if (!draggingRef.current) return;
    let dx = x - startRef.current.x;
    let dy = y - startRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    moveRef.current = { x: dx / maxDist, y: dy / maxDist };
  };
  const end = () => {
    draggingRef.current = false;
    moveRef.current = { x: 0, y: 0 };
  };

  return {
    onPointerDown: (e) => start(e.clientX, e.clientY),
    onPointerMove: (e) => move(e.clientX, e.clientY),
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
  };
}

// WASD keyboard movement (desktop)
function useKeyboardMove(moveRef, dragActiveRef) {
  useEffect(() => {
    const keys = { w: false, a: false, s: false, d: false };

    const recompute = () => {
      if (dragActiveRef.current) return;
      let x = 0;
      let y = 0;
      if (keys.a) x -= 1;
      if (keys.d) x += 1;
      if (keys.w) y -= 1;
      if (keys.s) y += 1;
      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
      moveRef.current = { x, y };
    };

    const down = (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) {
        keys[k] = true;
        recompute();
      }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) {
        keys[k] = false;
        recompute();
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [moveRef, dragActiveRef]);
}

export default function GamesWorldPage() {
  const posRef = useRef({ x: 0, z: 14 });
  const facingRef = useRef(0);
  const moveRef = useRef({ x: 0, y: 0 });
  const dragActiveRef = useRef(false);
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState("");

  const dragHandlers = useDragMove(moveRef);
  useKeyboardMove(moveRef, dragActiveRef);

  const wrappedDown = (e) => {
    dragActiveRef.current = true;
    dragHandlers.onPointerDown(e);
  };
  const wrappedUp = (e) => {
    dragActiveRef.current = false;
    dragHandlers.onPointerUp(e);
  };

  const handleEnter = () => {
    if (!near) return;
    setToast(`${near.name} — Coming soon!`);
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100vh", background: "#05030a", overflow: "hidden", touchAction: "none" }}
      onPointerDown={wrappedDown}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={wrappedUp}
      onPointerLeave={wrappedUp}
      onPointerCancel={wrappedUp}
    >
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 20 }}>
        <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}>
          <span style={{ color: "#fff" }}>← Rialo</span>
          <span style={{ color: "#d7ff1f" }}>Verse</span>
        </a>
      </div>

      <div style={{ position: "fixed", top: 16, right: 16, color: "#8a8b9c", fontSize: 11, textAlign: "right", zIndex: 20 }}>
        Geser layar untuk jalan
        <br />
        (atau WASD di laptop)
      </div>

      <Canvas shadows camera={{ position: [8, 12, 26], fov: 45 }}>
        <color attach="background" args={["#05030a"]} />
        <fog attach="fog" args={["#05030a", 14, 46]} />
        <ambientLight intensity={0.22} />
        <hemisphereLight args={["#241b3d", "#050208", 0.45]} />
        <directionalLight position={[10, 20, 10]} intensity={0.4} castShadow />

        <Ground />
        <gridHelper args={[GROUND_SIZE, 40, "#2a1a4a", "#141026"]} position={[0, 0.01, 0]} />
        {ROADS.map((r, i) => (
          <Road key={i} from={r.from} to={r.to} />
        ))}

        {BUILDINGS.map((b) => (
          <Building key={b.name} data={b} />
        ))}
        {LAMP_POSITIONS.map((p, i) => (
          <StreetLamp key={i} position={p} />
        ))}

        <Avatar posRef={posRef} facingRef={facingRef} moveRef={moveRef} />
        <CameraRig posRef={posRef} />
        <SceneLogic posRef={posRef} moveRef={moveRef} facingRef={facingRef} onNear={setNear} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={1.1} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {near && (
        <button
          onClick={handleEnter}
          style={{
            position: "fixed",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 28px",
            borderRadius: 999,
            background: "#d7ff1f",
            color: "#0a0a0a",
            border: "none",
            fontWeight: 800,
            fontSize: 14,
            zIndex: 20,
          }}
        >
          ENTER {near.name.toUpperCase()}
        </button>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111218",
            border: "2px solid #d7ff1f",
            padding: "10px 20px",
            borderRadius: 10,
            color: "#fff",
            fontSize: 13,
            zIndex: 30,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
