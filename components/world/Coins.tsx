import React from 'react';
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
  magnetLevel?: number;
}

// Geometry and Materials reused for performance
const coinGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 32);
const materials = Object.values(CoinType).reduce((acc, type) => {
    const config = COIN_CONFIG[type];
    acc[type] = new THREE.MeshStandardMaterial({ 
        color: config.color, 
        metalness: 0.8, 
        roughness: 0.3 
    });
    return acc;
}, {} as Record<CoinType, THREE.MeshStandardMaterial>);


const Coins: React.FC<CoinsProps> = ({ coins, onSplit, onExplode, onTransmute, onInteraction, magnetLevel = 0 }) => {
  const { world } = useRapier();

  // Increased base damping to prevent jitter (coins settle faster)
  // Base 2.0 (was 0.5).
  const baseLinearDamping = 2.0 + (magnetLevel * 2.0);
  const baseAngularDamping = 2.0 + (magnetLevel * 2.0);

  const handleCollision = (payload: any, coin: CoinData) => {
    const other = payload.other.rigidBodyObject;
    if (!other || !other.name) return;

    // --- COIN-TO-COIN INTERACTIONS ---
    if (other.name.startsWith('coin-')) {
        const parts = other.name.split('-');
        const otherType = parts[1] as CoinType;
        // Fix: Reconstruct ID properly by joining all parts after the type
        const otherId = parts.slice(2).join('-');

        // 1. SEED + WATER -> TREE
        if ((coin.type === CoinType.SEED && otherType === CoinType.WATER) ||
            (coin.type === CoinType.WATER && otherType === CoinType.SEED)) {
            // Only fire if coin.id < otherId to prevent double firing for the pair
            if (coin.id < otherId) {
                onInteraction(coin.id, otherId, CoinType.TREE);
            }
        }

        // 2. MAGMA + ICE -> OBSIDIAN
        if ((coin.type === CoinType.MAGMA && otherType === CoinType.ICE) ||
            (coin.type === CoinType.ICE && otherType === CoinType.MAGMA)) {
            if (coin.id < otherId) {
                onInteraction(coin.id, otherId, CoinType.OBSIDIAN);
            }
        }

        // 3. KEY + CHEST -> DIAMOND
        if ((coin.type === CoinType.KEY && otherType === CoinType.CHEST) ||
            (coin.type === CoinType.CHEST && otherType === CoinType.KEY)) {
             if (coin.id < otherId) {
                onInteraction(coin.id, otherId, CoinType.DIAMOND);
             }
        }
    }

    // --- SPLITTER LOGIC ---
    // If hitting the pusher and hasn't split yet
    if (coin.type === CoinType.SPLITTER && !coin.hasSplit) {
        if (other.name === 'pusher') {
             const contact = payload.manifold.solverContactPoint(0);
             if (contact) {
                 onSplit(coin.id, new THREE.Vector3(contact.x, contact.y + 1, contact.z));
             }
        }
    }

    // --- MIDAS LOGIC ---
    if (coin.type === CoinType.GOLD) { 
        if (other.name && other.name.startsWith('coin-STANDARD')) {
             const parts = other.name.split('-');
             // Fix: Reconstruct ID properly by joining all parts after the type
             const otherId = parts.slice(2).join('-');
             onTransmute(otherId);
        }
    }

    // --- BOMB LOGIC ---
    if (coin.type === CoinType.BOMB) {
        // Use relative velocity as a proxy for impact intensity.
        const selfBody = payload.target.rigidBody;
        const otherBody = payload.other.rigidBody;
        
        if (selfBody) {
             const v1 = selfBody.linvel();
             const v2 = otherBody ? otherBody.linvel() : {x:0, y:0, z:0};
             
             const dx = v1.x - v2.x;
             const dy = v1.y - v2.y;
             const dz = v1.z - v2.z;
             const speedSq = dx*dx + dy*dy + dz*dz;

             if (speedSq > 25) {
                 triggerExplosion(coin.id, selfBody);
             }
        }
    }
  };

  const triggerExplosion = (id: string, body: RapierRigidBody) => {
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

    onExplode(id);
  };

  const getMass = (type: CoinType) => {
      switch(type) {
          case CoinType.HEAVY: return 5;
          case CoinType.OBSIDIAN: return 8; // Very heavy
          case CoinType.TREE: return 4;
          default: return 1;
      }
  };

  const getFriction = (type: CoinType) => {
      if (type === CoinType.ICE) return 0.05; // Slippery
      if (type === CoinType.OBSIDIAN) return 1.0; // Rough
      return 0.4; // Slightly reduced from 0.6 to prevent stick-slip jitter
  }

  return (
    <>
      {coins.map((coin) => {
        return (
            <RigidBody 
                key={coin.id} 
                name={`coin-${coin.type}-${coin.id}`}
                position={coin.position} 
                rotation={coin.rotation as any}
                // Removed colliders="hull" in favor of explicit CylinderCollider below
                colliders={false}
                friction={getFriction(coin.type)}
                mass={getMass(coin.type)}
                restitution={coin.type === CoinType.SPLITTER ? 0.8 : 0.05}
                linearDamping={baseLinearDamping}
                angularDamping={baseAngularDamping}
                onCollisionEnter={(payload) => handleCollision(payload, coin)}
                canSleep={true}
            >
                {/* Visual Mesh */}
                <mesh 
                    geometry={coinGeometry} 
                    material={materials[coin.type]} 
                    castShadow 
                    receiveShadow
                    scale={coin.type === CoinType.TREE || coin.type === CoinType.OBSIDIAN ? [1.2, 1.2, 1.2] : [1,1,1]}
                />
                
                {/* Physical Collider - Exact Cylinder Shape for stability */}
                {/* args: [halfHeight, radius] */}
                <CylinderCollider args={[0.075, 0.6]} />
            </RigidBody>
        );
      })}
    </>
  );
};

export default Coins;