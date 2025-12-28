import React from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, useRapier, RapierRigidBody, CylinderCollider } from '@react-three/rapier';
import { CoinType, CoinData } from '../../types';
import { COIN_CONFIG } from '../../constants';
import * as THREE from 'three';

interface CoinsProps {
  coins: CoinData[];
  onSplit: (id: string, position: THREE.Vector3) => void;
  onExplode: (id: string) => void;
  onTransmute: (targetId: string) => void;
  onInteraction: (id1: string, id2: string, result: CoinType) => void;
}

// Geometry and materials reused for performance.
const coinGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 24);

const coinVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const coinFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uAmbient;
  uniform float uSpecular;
  uniform float uShininess;
  uniform float uRim;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightDir);

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), uShininess) * uSpecular;
    float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.0) * uRim;

    vec3 color = uColor * (uAmbient + diff) + vec3(spec) + (uColor * rim);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const materials = Object.values(CoinType).reduce((acc, type) => {
  const config = COIN_CONFIG[type];
  acc[type] = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(config.color) },
      uLightDir: { value: new THREE.Vector3(0.35, 1.0, 0.4) },
      uAmbient: { value: 0.35 },
      uSpecular: { value: 0.35 },
      uShininess: { value: 32.0 },
      uRim: { value: 0.2 }
    },
    vertexShader: coinVertexShader,
    fragmentShader: coinFragmentShader
  });
  return acc;
}, {} as Record<CoinType, THREE.ShaderMaterial>);

const areArraysEqual = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const getMass = (type: CoinType) => {
  switch (type) {
    case CoinType.HEAVY:
      return 5;
    case CoinType.OBSIDIAN:
      return 8; // Very heavy
    case CoinType.TREE:
      return 4;
    default:
      return 1;
  }
};

const getFriction = (type: CoinType) => {
  if (type === CoinType.ICE) return 0.05; // Slippery
  if (type === CoinType.OBSIDIAN) return 1.0; // Rough
  return 0.4; // Slightly reduced from 0.6 to prevent stick-slip jitter
};

interface CoinItemProps {
  coin: CoinData;
  baseLinearDamping: number;
  baseAngularDamping: number;
  onCollisionEnter: (payload: any, coin: CoinData) => void;
}

const CoinItem = React.memo(
  ({ coin, baseLinearDamping, baseAngularDamping, onCollisionEnter }: CoinItemProps) => {
    const scale = React.useMemo(
      () => (coin.type === CoinType.TREE || coin.type === CoinType.OBSIDIAN ? [1.2, 1.2, 1.2] : [1, 1, 1]),
      [coin.type]
    );

    const handleCollisionEnter = React.useCallback(
      (payload: any) => {
        onCollisionEnter(payload, coin);
      },
      [coin, onCollisionEnter]
    );

    return (
      <RigidBody
        key={coin.id}
        name={`coin-${coin.type}-${coin.id}`}
        userData={{ coinId: coin.id, coinType: coin.type }}
        position={coin.position}
        rotation={coin.rotation as any}
        // Removed colliders="hull" in favor of explicit CylinderCollider below
        colliders={false}
        friction={getFriction(coin.type)}
        mass={getMass(coin.type)}
        restitution={coin.type === CoinType.SPLITTER ? 0.8 : 0.05}
        linearDamping={baseLinearDamping}
        angularDamping={baseAngularDamping}
        onCollisionEnter={handleCollisionEnter}
        canSleep={true}
        ccd
      >
        {/* Visual Mesh */}
        <mesh
          geometry={coinGeometry}
          material={materials[coin.type]}
          castShadow
          receiveShadow
          scale={scale}
        />

        {/* Physical Collider - Exact Cylinder Shape for stability */}
        {/* args: [halfHeight, radius] */}
        <CylinderCollider args={[0.075, 0.6]} />
      </RigidBody>
    );
  },
  (prevProps, nextProps) =>
    prevProps.baseLinearDamping === nextProps.baseLinearDamping &&
    prevProps.baseAngularDamping === nextProps.baseAngularDamping &&
    prevProps.coin.id === nextProps.coin.id &&
    prevProps.coin.type === nextProps.coin.type &&
    prevProps.coin.hasSplit === nextProps.coin.hasSplit &&
    areArraysEqual(prevProps.coin.position, nextProps.coin.position) &&
    areArraysEqual(prevProps.coin.rotation, nextProps.coin.rotation)
);

const interactionResults: Partial<Record<CoinType, Partial<Record<CoinType, CoinType>>>> = {
  [CoinType.SEED]: { [CoinType.WATER]: CoinType.TREE },
  [CoinType.WATER]: { [CoinType.SEED]: CoinType.TREE },
  [CoinType.MAGMA]: { [CoinType.ICE]: CoinType.OBSIDIAN },
  [CoinType.ICE]: { [CoinType.MAGMA]: CoinType.OBSIDIAN },
  [CoinType.KEY]: { [CoinType.CHEST]: CoinType.DIAMOND },
  [CoinType.CHEST]: { [CoinType.KEY]: CoinType.DIAMOND }
};

const interactionCoinTypes = new Set<CoinType>([
  CoinType.SEED,
  CoinType.WATER,
  CoinType.MAGMA,
  CoinType.ICE,
  CoinType.KEY,
  CoinType.CHEST
]);

const activeCollisionCoinTypes = new Set<CoinType>([
  ...interactionCoinTypes,
  CoinType.SPLITTER,
  CoinType.GOLD,
  CoinType.BOMB
]);

const Coins: React.FC<CoinsProps> = ({ coins, onSplit, onExplode, onTransmute, onInteraction }) => {
  const { world } = useRapier();
  const pendingEventsRef = React.useRef({
    interactions: new Map<string, { id1: string; id2: string; result: CoinType }>(),
    splits: new Map<string, { id: string; position: THREE.Vector3 }>(),
    transmutations: new Set<string>(),
    explosions: new Set<string>()
  });

  // Increased base damping to prevent jitter (coins settle faster)
  // Base 2.0 (was 0.5).
  const baseLinearDamping = 2.0;
  const baseAngularDamping = 10.0;

  useFrame(() => {
    const pending = pendingEventsRef.current;
    if (
      pending.interactions.size === 0 &&
      pending.splits.size === 0 &&
      pending.transmutations.size === 0 &&
      pending.explosions.size === 0
    ) {
      return;
    }

    pending.interactions.forEach(({ id1, id2, result }) => {
      onInteraction(id1, id2, result);
    });
    pending.splits.forEach(({ id, position }) => {
      onSplit(id, position);
    });
    pending.transmutations.forEach((targetId) => {
      onTransmute(targetId);
    });
    pending.explosions.forEach((id) => {
      onExplode(id);
    });

    pending.interactions.clear();
    pending.splits.clear();
    pending.transmutations.clear();
    pending.explosions.clear();
  });

  const queueInteraction = React.useCallback((id1: string, id2: string, result: CoinType) => {
    const key = `${id1}:${id2}:${result}`;
    pendingEventsRef.current.interactions.set(key, { id1, id2, result });
  }, []);

  const queueSplit = React.useCallback((id: string, position: THREE.Vector3) => {
    pendingEventsRef.current.splits.set(id, { id, position });
  }, []);

  const queueTransmute = React.useCallback((targetId: string) => {
    pendingEventsRef.current.transmutations.add(targetId);
  }, []);

  const queueExplosion = React.useCallback((id: string) => {
    pendingEventsRef.current.explosions.add(id);
  }, []);

  const triggerExplosion = React.useCallback((id: string, body: RapierRigidBody) => {
    if (!body) return;
    const position = body.translation();

    // Apply impulse to nearby bodies
    const explosionRadius = 8;
    const explosionForce = 8; // Reduced from 30 to ~1/4

    world.forEachRigidBody((otherBody) => {
      if (otherBody.handle === body.handle) return;

      const otherPos = otherBody.translation();
      const dist = Math.sqrt(
        Math.pow(position.x - otherPos.x, 2) +
        Math.pow(position.y - otherPos.y, 2) +
        Math.pow(position.z - otherPos.z, 2)
      );

      if (dist < explosionRadius) {
        const dir = {
          x: (otherPos.x - position.x) / dist,
          y: (otherPos.y - position.y) / dist + 0.5,
          z: (otherPos.z - position.z) / dist
        };
        const force = (1 - dist / explosionRadius) * explosionForce;
        otherBody.applyImpulse({
          x: dir.x * force,
          y: dir.y * force,
          z: dir.z * force
        }, true);
      }
    });

    queueExplosion(id);
  }, [queueExplosion, world]);

  const handleCollision = React.useCallback(
    (payload: any, coin: CoinData) => {
      if (!activeCollisionCoinTypes.has(coin.type)) {
        return;
      }

      const otherBody = payload.other.rigidBodyObject;
      if (!otherBody) return;
      const shouldCheckOtherCoin = interactionCoinTypes.has(coin.type) || coin.type === CoinType.GOLD;
      const otherUserData = shouldCheckOtherCoin
        ? (otherBody.userData as { coinId?: string; coinType?: CoinType } | undefined)
        : undefined;
      const otherCoinId = otherUserData?.coinId;
      const otherCoinType = otherUserData?.coinType;

      // --- COIN-TO-COIN INTERACTIONS ---
      if (otherCoinId && otherCoinType && interactionCoinTypes.has(coin.type)) {
        const result = interactionResults[coin.type]?.[otherCoinType];
        if (result && coin.id < otherCoinId) {
          queueInteraction(coin.id, otherCoinId, result);
        }
      }

      // --- SPLITTER LOGIC ---
      // If hitting the pusher and hasn't split yet
      if (coin.type === CoinType.SPLITTER && !coin.hasSplit) {
        if (otherBody.name === 'pusher') {
          const contact = payload.manifold.solverContactPoint(0);
          if (contact) {
            queueSplit(coin.id, new THREE.Vector3(contact.x, contact.y + 1, contact.z));
          }
        }
      }

      // --- MIDAS LOGIC ---
      if (coin.type === CoinType.GOLD) {
        if (otherCoinType === CoinType.STANDARD && otherCoinId) {
          queueTransmute(otherCoinId);
        }
      }

      // --- BOMB LOGIC ---
      if (coin.type === CoinType.BOMB) {
        // Use relative velocity as a proxy for impact intensity.
        const selfBody = payload.target.rigidBody;
        const otherRigidBody = payload.other.rigidBody;

        if (selfBody) {
          const v1 = selfBody.linvel();
          const v2 = otherRigidBody ? otherRigidBody.linvel() : { x: 0, y: 0, z: 0 };

          const dx = v1.x - v2.x;
          const dy = v1.y - v2.y;
          const dz = v1.z - v2.z;
          const speedSq = dx * dx + dy * dy + dz * dz;

          if (speedSq > 25) {
            triggerExplosion(coin.id, selfBody);
          }
        }
      }
    },
    [queueInteraction, queueSplit, queueTransmute, triggerExplosion]
  );

  return (
    <>
      {coins.map((coin) => (
        <CoinItem
          key={coin.id}
          coin={coin}
          baseLinearDamping={baseLinearDamping}
          baseAngularDamping={baseAngularDamping}
          onCollisionEnter={handleCollision}
        />
      ))}
    </>
  );
};

export default Coins;
