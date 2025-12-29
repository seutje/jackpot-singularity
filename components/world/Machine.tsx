import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CoinType } from '../../types';
import { MACHINE_DIMENSIONS } from '../../constants';

interface MachineProps {
  onCoinCollected: (id: string, type: CoinType) => void;
  extenderLevel: number;
  timeScale: number;
}

const Machine: React.FC<MachineProps> = ({ onCoinCollected, extenderLevel = 0, timeScale = 1 }) => {
  const pusherRef = useRef<RapierRigidBody>(null);
  const simTimeRef = useRef(0);

  // Pusher Animation Logic
  // To support time scaling, we maintain a separate simulation time accumulator.
  useFrame((state, delta) => {
    if (pusherRef.current) {
      // Accumulate time based on speed multiplier
      simTimeRef.current += delta * timeScale;
      const t = simTimeRef.current;

      // Target Motion Parameters
      // z = 2 * sin(1.5 * t) - 2
      const amplitude = 2;
      const frequency = 1.5;
      const offset = -2;

      // Desired Position
      const targetZ = amplitude * Math.sin(frequency * t) + offset;
      const currentTranslation = pusherRef.current.translation();
      pusherRef.current.setNextKinematicTranslation({
        x: currentTranslation.x,
        y: currentTranslation.y,
        z: targetZ
      });
    }
  });

  // Bed Dimensions Logic
  // Base width 10. Extender adds 4 units width per level.
  const bedWidth = MACHINE_DIMENSIONS.baseWidth + (extenderLevel * MACHINE_DIMENSIONS.widthPerLevel);
  const halfBedWidth = bedWidth / 2;

  // Length stays constant now
  const bedLength = MACHINE_DIMENSIONS.bedLength; // Extends from -7 to +7
  const zCenter = 0;

  const killPlaneZ = 10;

  // Calculate dynamic positions based on width
  const railX = halfBedWidth + 0.5;
  const neonX = halfBedWidth - 0.1;
  const pusherWidth = bedWidth - 0.2;
  const wallWidth = bedWidth + 2;

  // Key for re-mounting RigidBodies when dimensions change
  const dimKey = `level-${extenderLevel}`;

  return (
    <group>
      {/* --- The Floor (Static) --- */}
      <RigidBody
        key={`floor-${dimKey}`}
        type="fixed"
        friction={0.6}
        restitution={0.01}
      >
        {/* Main Bed */}
        <mesh position={[0, -0.5, zCenter]} receiveShadow>
          <boxGeometry args={[bedWidth, 1, bedLength]} />
          <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Side Rails */}
        <mesh position={[-railX, 1, zCenter]}>
          <boxGeometry args={[1, 4, bedLength]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[railX, 1, zCenter]}>
          <boxGeometry args={[1, 4, bedLength]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Back Wall (Rear Boundary) */}
        <mesh position={[0, 2, -7.5]}>
          <boxGeometry args={[wallWidth, 6, 1]} />
          <meshStandardMaterial color="#222" emissive="#300" emissiveIntensity={0.2} />
        </mesh>

        {/* --- Wiper Wall (Housing) --- */}
        {/* This wall sits above the pusher. Coins hit this and slide off the pusher when it retracts. */}
        <mesh position={[0, 3.55, -2.2]} castShadow receiveShadow>
          <boxGeometry args={[wallWidth, 4, 1]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Neon Accents (Visual Only) */}
        <mesh position={[-neonX, 0.1, zCenter]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.2, bedLength]} />
          <meshBasicMaterial color="#06b6d4" toneMapped={false} />
        </mesh>
        <mesh position={[neonX, 0.1, zCenter]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.2, bedLength]} />
          <meshBasicMaterial color="#d946ef" toneMapped={false} />
        </mesh>
      </RigidBody>

      {/* --- The Pusher (Kinematic Position) --- */}
      <RigidBody
        key={`pusher-${dimKey}`}
        ref={pusherRef}
        name="pusher"
        type="kinematicPosition"
        position={[0, 0.75, 0]}
        colliders={false}
        friction={0.1}
        restitution={0}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[pusherWidth, 1.5, 4]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        </mesh>
        <CuboidCollider args={[pusherWidth / 2, 0.75, 2]} />
        <CuboidCollider args={[pusherWidth / 2, 0.05, 0.7]} position={[0, -0.7, 1.6]} />
        {/* Pusher Front Face Glow */}
        <mesh position={[0, 0, 2.01]}>
          <planeGeometry args={[pusherWidth - 0.8, 1]} />
          <meshStandardMaterial color="#000" emissive="#ff00ff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* Top texture/lines on pusher */}
        <mesh position={[0, 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pusherWidth - 0.8, 3]} />
          <meshBasicMaterial color="#444" opacity={0.5} transparent />
        </mesh>
      </RigidBody>

      {/* --- Collection Sensor (Global Drop Zone) --- */}
      {/* 
         Spans the entire area below the machine to catch all falling coins.
         Positioned at Y=-10. 
         Dimensions: 100x4x100 coverage.
      */}
      <CuboidCollider
        position={[0, -10, 0]}
        args={[50, 2, 50]}
        sensor
        onIntersectionEnter={(payload) => {
          const rigidBody = payload.other.rigidBodyObject;
          const userData = rigidBody?.userData as { coinId?: string; coinType?: CoinType } | undefined;
          if (userData?.coinId && userData?.coinType) {
            onCoinCollected(userData.coinId, userData.coinType);
          }
        }}
      />

      {/* Visual "Kill Plane" - purely for aesthetics now, physics handled by collider above */}
      <mesh position={[0, -12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} />
      </mesh>

    </group>
  );
};

export default Machine;
