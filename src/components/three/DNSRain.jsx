import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSSE } from '../../hooks/useSSE';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

const POOL_SIZE = 800;
const FALL_SPEED = 4.5;        // units/sec
const SPAWN_HEIGHT = 18;
const FLOOR = -0.1;
const FIELD_RADIUS = 14;
const MAX_PARTICLES_PER_PUSH = 250;
const SPAWN_WINDOW_MS = 4500;  // spread spawns across this window

const TYPE = { BLOCKED: 0, CACHED: 1, ALLOWED: 2 };
const TYPE_COLORS = ['#ea4335', '#1a73e8', '#34a853'];

// ----------------------------------------------------------------------------
// Particle field — instanced mesh pool, fed by an external `spawn(count, type)`
// callback registered into a ref so the SSE handler can push without re-rendering.
// ----------------------------------------------------------------------------
function ParticleField({ spawnerRef }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorTmp = useMemo(() => new THREE.Color(), []);
  const particles = useRef(
    Array.from({ length: POOL_SIZE }, () => ({ active: false, x: 0, y: 0, z: 0, type: 0 }))
  );
  const spawnQueue = useRef([]);

  useEffect(() => {
    spawnerRef.current = (count, type) => {
      const now = performance.now();
      const cap = Math.min(count, MAX_PARTICLES_PER_PUSH);
      for (let i = 0; i < cap; i++) {
        spawnQueue.current.push({ type, t: now + Math.random() * SPAWN_WINDOW_MS });
      }
    };
  }, [spawnerRef]);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;

    // Drain spawn queue: only items whose scheduled time has passed.
    const now = performance.now();
    const remaining = [];
    for (const item of spawnQueue.current) {
      if (item.t <= now) {
        const slot = particles.current.findIndex(p => !p.active);
        if (slot < 0) continue; // pool full; drop
        const p = particles.current[slot];
        p.active = true;
        p.type = item.type;
        p.x = (Math.random() - 0.5) * FIELD_RADIUS * 2;
        p.z = (Math.random() - 0.5) * FIELD_RADIUS * 2;
        p.y = SPAWN_HEIGHT + Math.random() * 3;
      } else {
        remaining.push(item);
      }
    }
    spawnQueue.current = remaining;

    // Step + write matrices/colors.
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = particles.current[i];
      if (p.active) {
        p.y -= FALL_SPEED * delta;
        if (p.y < FLOOR) p.active = false;
      }
      if (p.active) {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(0.18);
      } else {
        dummy.position.set(0, -10000, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      colorTmp.set(TYPE_COLORS[p.type]);
      m.setColorAt(i, colorTmp);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL_SIZE]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
}

// ----------------------------------------------------------------------------
// Top blocked domains as growing pillars.
// ----------------------------------------------------------------------------
function BlockedColumns({ topBlocked }) {
  if (!topBlocked || topBlocked.length === 0) return null;
  const items = topBlocked.slice(0, 8);
  const max = Math.max(...items.map(d => d.count), 1);

  return (
    <group position={[0, 0, -10]}>
      {items.map((d, i) => {
        const x = (i - (items.length - 1) / 2) * 2.2;
        const h = (d.count / max) * 7 + 0.3;
        const label = d.domain.length > 22 ? d.domain.slice(0, 20) + '…' : d.domain;
        return (
          <group key={d.domain} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1.4, h, 1.4]} />
              <meshStandardMaterial color="#ea4335" transparent opacity={0.55} roughness={0.3} />
            </mesh>
            <Text position={[0, h + 0.6, 0]} fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle">
              {label}
            </Text>
            <Text position={[0, h + 0.25, 0]} fontSize={0.28} color="#ea4335" anchorX="center" anchorY="middle">
              {d.count.toLocaleString()}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Floor() {
  return (
    <mesh position={[0, FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#0d1117" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function GridLines() {
  return <gridHelper args={[40, 40, '#1a73e8', '#1a1d24']} position={[0, FLOOR + 0.01, 0]} />;
}

// ----------------------------------------------------------------------------
// SSE-driven spawner: synthesizes per-query particles from delta of aggregate
// counts pushed every ~5s.
// ----------------------------------------------------------------------------
function useDNSSpawner(spawnerRef, onTick) {
  const prev = useRef(null);

  useSSE('pihole_stats', (payload) => {
    const obj = Array.isArray(payload) ? payload[0] : payload;
    const c = obj?.combined;
    if (!c) return;
    const blocked = c.blocked || 0;
    const cached = c.cached || 0;
    const total = c.total_queries || 0;
    const allowed = Math.max(0, total - blocked - cached);

    if (prev.current) {
      const dB = Math.max(0, blocked - prev.current.blocked);
      const dC = Math.max(0, cached - prev.current.cached);
      const dA = Math.max(0, allowed - prev.current.allowed);
      const dT = dB + dC + dA;
      const dtMs = performance.now() - prev.current.t;

      if (dT > 0) {
        spawnerRef.current?.(dB, TYPE.BLOCKED);
        spawnerRef.current?.(dC, TYPE.CACHED);
        spawnerRef.current?.(dA, TYPE.ALLOWED);
      }
      onTick({ dB, dC, dA, dT, qps: dtMs > 0 ? (dT / (dtMs / 1000)) : 0 });
    }

    prev.current = { blocked, cached, allowed, t: performance.now() };
  });
}

// ----------------------------------------------------------------------------
// HUD overlay (DOM, not WebGL) — current rates + back link.
// ----------------------------------------------------------------------------
function HUD({ stats, pihole }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="dns3d-hud-tl">
        <button className="dns3d-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Home
        </button>
        <h2>DNS Query Rain</h2>
        <div className="dns3d-sub">
          {pihole?.combined
            ? <>{pihole.combined.total_queries?.toLocaleString()} queries · {pihole.combined.percent_blocked?.toFixed(1)}% blocked</>
            : <>connecting…</>}
        </div>
      </div>

      <div className="dns3d-hud-tr">
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.BLOCKED] }}>{stats.dB}</span>
          <span className="dns3d-stat-lbl">blocked</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.CACHED] }}>{stats.dC}</span>
          <span className="dns3d-stat-lbl">cached</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.ALLOWED] }}>{stats.dA}</span>
          <span className="dns3d-stat-lbl">forwarded</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val">{stats.qps.toFixed(1)}</span>
          <span className="dns3d-stat-lbl">qps</span>
        </div>
      </div>

      <div className="dns3d-hud-bl">drag to rotate · scroll to zoom · right-drag to pan</div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Top-level component.
// ----------------------------------------------------------------------------
export default function DNSRain() {
  const spawnerRef = useRef(null);
  const [stats, setStats] = useState({ dB: 0, dC: 0, dA: 0, dT: 0, qps: 0 });

  // Seed the columns immediately; SSE will overwrite this within ~5s.
  const { data: pihole } = useQuery({
    queryKey: ['pihole', 'stats'],
    queryFn: () => fetch(`${BASE}/pihole/stats`).then(r => r.json()),
    refetchInterval: 60000,
    select: (d) => (Array.isArray(d) ? d[0] : d),
  });

  useDNSSpawner(spawnerRef, setStats);

  return (
    <div className="dns3d-root">
      <Canvas camera={{ position: [0, 8, 22], fov: 55 }} dpr={[1, 2]} shadows>
        <color attach="background" args={['#05070b']} />
        <fog attach="fog" args={['#05070b', 25, 55]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[10, 20, 5]} intensity={1.1} castShadow />
        <pointLight position={[-15, 10, -10]} intensity={0.4} color="#1a73e8" />

        <Floor />
        <GridLines />
        <ParticleField spawnerRef={spawnerRef} />
        <BlockedColumns topBlocked={pihole?.top_blocked} />

        <OrbitControls
          enablePan
          minDistance={8}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, 4, 0]}
        />
      </Canvas>

      <HUD stats={stats} pihole={pihole} />
    </div>
  );
}
