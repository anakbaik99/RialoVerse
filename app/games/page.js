"use client";
import { useRef, useState } from "react";
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

const GROUND_SIZE = 44;
const AVATAR_SPEED = 7;
const ENTER_RADIUS = 3.4;

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#04050a" />
    </mesh>
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

function Avatar({ posRef }) {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, 0, posRef.current.z);
    }
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.1, 0]}>
        <capsuleGeometry args={[0.5, 1, 4, 8]} />
        <meshStandardMaterial color="#0c0d08" emissive="#d7ff1f" emissiveIntensity={0.6} />
        <Edges color="#d7ff1f" />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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

function SceneLogic({ posRef, joystickRef, onNear }) {
  useFrame((state, delta) => {
    const jx = joystickRef.current.x;
    const jy = joystickRef.current.y;
    if (jx !== 0 || jy !== 0) {
      posRef.current.x += jx * AVATAR_SPEED * delta;
      posRef.current.z += jy * AVATAR_SPEED * delta;

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

function Joystick({ joystickRef }) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const [active, setActive] = useState(false);
  const originRef = useRef({ x: 0, y: 0 });
  const maxDist = 45;

  const handleStart = (clientX, clientY) => {
    const rect = baseRef.current.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setActive(true);
  };

  const handleMove = (clientX, clientY) => {
    if (!active) return;
    let dx = clientX - originRef.current.x;
    let dy = clientY - originRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    joystickRef.current = { x: dx / maxDist, y: dy / maxDist };
  };

  const handleEnd = () => {
    setActive(false);
    joystickRef.current = { x: 0, y: 0 };
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(0px, 0px)";
    }
  };

  return (
    <div
      ref={baseRef}
      onTouchStart={(e) => {
        const t = e.touches[0];
        handleStart(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (active) handleMove(e.clientX, e.clientY);
      }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{
        position: "fixed",
        left: 30,
        bottom: 30,
        width: 100,
        height: 100,
        borderRadius: "50%",
        background: "rgba(215,255,31,0.12)",
        border: "2px solid #d7ff1f55",
        touchAction: "none",
        zIndex: 20,
      }}
    >
      <div
        ref={knobRef}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 44,
          height: 44,
          marginLeft: -22,
          marginTop: -22,
          borderRadius: "50%",
          background: "#d7ff1f",
          boxShadow: "0 0 20px #d7ff1f88",
        }}
      />
    </div>
  );
}

export default function GamesWorldPage() {
  const posRef = useRef({ x: 0, z: 14 });
  const joystickRef = useRef({ x: 0, y: 0 });
  const [near, setNear] = useState(null);
  const [toast, setToast] = useState("");

  const handleEnter = () => {
    if (!near) return;
    setToast(`${near.name} — Coming soon!`);
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#05030a", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 20 }}>
        <a href="/" style={{ textDecoration: "none", fontWeight: 700 }}>
          <span style={{ color: "#fff" }}>← Rialo</span>
          <span style={{ color: "#d7ff1f" }}>Verse</span>
        </a>
      </div>

      <div style={{ position: "fixed", top: 16, right: 16, color: "#8a8b9c", fontSize: 11, textAlign: "right", zIndex: 20 }}>
        Gunakan joystick
        <br />
        untuk jalan
      </div>

      <Canvas shadows camera={{ position: [8, 12, 26], fov: 45 }}>
        <color attach="background" args={["#05030a"]} />
        <fog attach="fog" args={["#05030a", 14, 46]} />
        <ambientLight intensity={0.22} />
        <hemisphereLight args={["#241b3d", "#050208", 0.45]} />
        <directionalLight position={[10, 20, 10]} intensity={0.4} castShadow />

        <Ground />
        <gridHelper args={[GROUND_SIZE, 40, "#2a1a4a", "#141026"]} position={[0, 0.01, 0]} />

        {BUILDINGS.map((b) => (
          <Building key={b.name} data={b} />
        ))}
        {LAMP_POSITIONS.map((p, i) => (
          <StreetLamp key={i} position={p} />
        ))}

        <Avatar posRef={posRef} />
        <CameraRig posRef={posRef} />
        <SceneLogic posRef={posRef} joystickRef={joystickRef} onNear={setNear} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={1.1} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <Joystick joystickRef={joystickRef} />

      {near && (
        <button
          onClick={handleEnter}
          style={{
            position: "fixed",
            bottom: 150,
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
