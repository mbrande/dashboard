import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSSE } from '../../hooks/useSSE';

const BASE = process.env.REACT_APP_N8N_BASE_URL;

const POOL_SIZE = 80;
const FALL_SPEED = 2.2;
const SPAWN_HEIGHT = 14;
const FLOOR = -0.2;
const FIELD_RADIUS = 13;

const TYPE = { BLOCKED: 0, CACHED: 1, FORWARDED: 2 };
const TYPE_COLORS = ['#ff5b5b', '#5ba8ff', '#5cd97a'];

function classifyStatus(rawStatus) {
  const s = (rawStatus || '').toUpperCase();
  if (s.includes('BLOCK') || s === 'GRAVITY' || s.includes('REGEX') || s.includes('DENY') ||
      s.includes('BLACKLIST') || s.includes('NULL') || s.includes('NXDOMAIN')) return TYPE.BLOCKED;
  if (s.startsWith('CACHE')) return TYPE.CACHED;
  return TYPE.FORWARDED;
}

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''));

// ----------------------------------------------------------------------------
// Particle field. Each slot is a <group> with a domain Text and a client Text.
// All updates are imperative via refs so React doesn't re-render every frame.
// ----------------------------------------------------------------------------
function ParticleField({ spawnerRef }) {
  const groupRefs = useRef(new Array(POOL_SIZE).fill(null));
  const domainRefs = useRef(new Array(POOL_SIZE).fill(null));
  const clientRefs = useRef(new Array(POOL_SIZE).fill(null));
  const slots = useRef(
    Array.from({ length: POOL_SIZE }, () => ({ active: false, x: 0, y: 0, z: 0 }))
  );

  useEffect(() => {
    spawnerRef.current = (queries) => {
      for (const q of queries) {
        const idx = slots.current.findIndex(s => !s.active);
        if (idx < 0) break; // pool full
        const s = slots.current[idx];
        s.active = true;
        s.x = (Math.random() - 0.5) * FIELD_RADIUS * 2;
        s.z = (Math.random() - 0.5) * FIELD_RADIUS * 2;
        s.y = SPAWN_HEIGHT + Math.random() * 2;

        const g = groupRefs.current[idx];
        const dom = domainRefs.current[idx];
        const cli = clientRefs.current[idx];
        if (g) {
          g.position.set(s.x, s.y, s.z);
          g.visible = true;
        }
        if (dom) {
          dom.text = truncate(q.domain, 36);
          dom.color = TYPE_COLORS[q.type];
          if (typeof dom.sync === 'function') dom.sync();
        }
        if (cli) {
          cli.text = truncate(q.client, 30);
          if (typeof cli.sync === 'function') cli.sync();
        }
      }
    };
  }, [spawnerRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    for (let i = 0; i < POOL_SIZE; i++) {
      const s = slots.current[i];
      const g = groupRefs.current[i];
      if (!g || !s.active) continue;
      s.y -= FALL_SPEED * dt;
      if (s.y < FLOOR) {
        s.active = false;
        g.visible = false;
      } else {
        g.position.y = s.y;
      }
    }
  });

  return (
    <>
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <group key={i} ref={el => (groupRefs.current[i] = el)} visible={false}>
          {/* Domain on top, color-coded by status */}
          <Text
            ref={el => (domainRefs.current[i] = el)}
            fontSize={0.42}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.025}
            outlineColor="#000000"
          >
            {' '}
          </Text>
          {/* Requesting client below, dim grey */}
          <Text
            ref={el => (clientRefs.current[i] = el)}
            position={[0, -0.45, 0]}
            fontSize={0.26}
            color="#9aa0a6"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {' '}
          </Text>
        </group>
      ))}
    </>
  );
}

// ----------------------------------------------------------------------------
// Top-blocked-domain pillars at the back. Spaced + smaller cap to avoid label
// overlap.
// ----------------------------------------------------------------------------
function BlockedColumns({ topBlocked }) {
  if (!topBlocked || topBlocked.length === 0) return null;
  const items = topBlocked.slice(0, 6);
  const max = Math.max(...items.map(d => d.count), 1);
  const spacing = 5.0; // wider so domain labels don't overlap

  return (
    <group position={[0, 0, -12]}>
      {items.map((d, i) => {
        const x = (i - (items.length - 1) / 2) * spacing;
        const h = (d.count / max) * 7 + 0.3;
        const label = truncate(d.domain, 22);
        return (
          <group key={d.domain} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1.6, h, 1.6]} />
              <meshStandardMaterial color="#ea4335" transparent opacity={0.55} roughness={0.3} />
            </mesh>
            <Text
              position={[0, h + 0.65, 0]}
              fontSize={0.32}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.015}
              outlineColor="#000000"
              maxWidth={spacing - 0.3}
            >
              {label}
            </Text>
            <Text
              position={[0, h + 0.25, 0]}
              fontSize={0.28}
              color="#ea4335"
              anchorX="center"
              anchorY="middle"
            >
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
// SSE-driven spawner.
// ----------------------------------------------------------------------------
function useQueryStream(spawnerRef, onTick) {
  const recent = useRef([]);
  const lastPushAt = useRef(performance.now());

  useSSE('pihole_queries', (payload) => {
    const queries = Array.isArray(payload) ? payload : [];
    if (queries.length === 0) return;

    const now = performance.now();
    const elapsedS = Math.max(0.5, (now - lastPushAt.current) / 1000);
    lastPushAt.current = now;

    const particles = queries.map(q => ({
      type: classifyStatus(q.status),
      domain: q.domain || '',
      // Prefer the client hostname, fall back to its IP. Strip .home.arpa for brevity.
      client: ((q.client_name || q.client_ip || '') + '').replace(/\.home\.arpa$/, '')
    }));
    spawnerRef.current?.(particles);

    const cutoff = now - 60_000;
    const next = recent.current.filter(e => e.ts >= cutoff);
    for (const p of particles) next.push({ ts: now, type: p.type });
    recent.current = next;

    const count = (k) => next.filter(e => e.type === k).length;
    onTick({
      qps: queries.length / elapsedS,
      blocked60: count(TYPE.BLOCKED),
      cached60: count(TYPE.CACHED),
      forwarded60: count(TYPE.FORWARDED),
      total60: next.length
    });
  });
}

// ----------------------------------------------------------------------------
// HUD overlay.
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
            ? <>{pihole.combined.total_queries?.toLocaleString()} queries today · {pihole.combined.percent_blocked?.toFixed(1)}% blocked</>
            : <>connecting…</>}
        </div>
      </div>

      <div className="dns3d-hud-tr">
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.BLOCKED] }}>{stats.blocked60}</span>
          <span className="dns3d-stat-lbl">blocked</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.CACHED] }}>{stats.cached60}</span>
          <span className="dns3d-stat-lbl">cached</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val" style={{ color: TYPE_COLORS[TYPE.FORWARDED] }}>{stats.forwarded60}</span>
          <span className="dns3d-stat-lbl">forwarded</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val">{stats.qps.toFixed(0)}</span>
          <span className="dns3d-stat-lbl">qps</span>
        </div>
        <div className="dns3d-stat">
          <span className="dns3d-stat-val">{stats.total60}</span>
          <span className="dns3d-stat-lbl">last 60s</span>
        </div>
      </div>

      <div className="dns3d-hud-bl">
        drag to rotate · scroll to zoom · right-drag to pan · pool {POOL_SIZE} (oldest queries drop)
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Top-level.
// ----------------------------------------------------------------------------
export default function DNSRain() {
  const spawnerRef = useRef(null);
  const [stats, setStats] = useState({
    qps: 0, blocked60: 0, cached60: 0, forwarded60: 0, total60: 0
  });

  const { data: pihole } = useQuery({
    queryKey: ['pihole', 'stats'],
    queryFn: () => fetch(`${BASE}/pihole/stats`).then(r => r.json()),
    refetchInterval: 60000,
    select: (d) => (Array.isArray(d) ? d[0] : d),
  });

  useQueryStream(spawnerRef, setStats);

  return (
    <div className="dns3d-root">
      <Canvas camera={{ position: [0, 8, 22], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={['#05070b']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[10, 20, 5]} intensity={0.8} />
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
