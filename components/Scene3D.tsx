import React, { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import { Environment, PerspectiveCamera, Stars, OrbitControls } from '@react-three/drei';
import { CoinType, GamePhase, CoinData, Artifact } from '../types';
import Machine from './world/Machine';
import Coins from './world/Coins';
import * as THREE from 'three';

interface Scene3DProps {
  activeCoins: CoinData[];
  onCoinCollected: (id: string, type: CoinType) => void;
  onSplit: (id: string, position: THREE.Vector3) => void;
  onExplode: (id: string) => void;
  onTransmute: (targetId: string) => void;
  onInteraction: (id1: string, id2: string, result: CoinType) => void;
  phase: GamePhase;
  artifacts: Artifact[];
  timeScale: number;
  isTabActive: boolean;
}

const PhysicsStepper: React.FC<{ steps: number, active: boolean }> = ({ steps, active }) => {
    const { world } = useRapier();
    
    useFrame(() => {
        if (!active || steps <= 1) return;
        
        // The default Physics component handles the first step and the sync.
        // We manually perform (steps - 1) additional steps to speed up simulation.
        // Since we are using kinematicVelocity for the pusher, the velocity persists 
        // across these extra steps, moving the pusher further per frame.
        for (let i = 0; i < steps - 1; i++) {
            world.step();
        }
    });
    
    return null;
};

const Scene3D: React.FC<Scene3DProps> = ({ 
    activeCoins, 
    onCoinCollected, 
    onSplit, 
    onExplode, 
    onTransmute, 
    onInteraction,
    phase,
    artifacts,
    timeScale,
    isTabActive
}) => {
  
  // Determine active upgrades and their levels
  const magnetArtifact = artifacts.find(a => a.id === 'magnet');
  const magnetLevel = magnetArtifact ? magnetArtifact.level : 0;

  const extenderArtifact = artifacts.find(a => a.id === 'extender');
  const extenderLevel = extenderArtifact ? extenderArtifact.level : 0;

  const isShopOpen = phase === GamePhase.SHOP;
  const isPaused = isShopOpen || !isTabActive;

  return (
    <Canvas shadows dpr={[1, 2]}>
      {/* 
        Adjusted Camera:
        Positioned to view the board from a comfortable isometric-like angle.
      */}
      <PerspectiveCamera 
        makeDefault 
        position={[0, 20, 18]} 
        fov={40} 
      />
      
      {/* Allow rotation around the center (0,0,0) */}
      <OrbitControls 
        target={[0, 0, 0]}
        enablePan={false}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.2} // Prevent going below the floor
        minDistance={15}
        maxDistance={60}
      />
      
      <color attach="background" args={['#050505']} />
      
      {/* Lighting - Cyberpunk style */}
      <ambientLight intensity={0.5} color="#4c1d95" />
      <pointLight position={[10, 10, 10]} intensity={1} color="#22d3ee" castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.8} color="#d946ef" />
      <spotLight 
        position={[0, 15, 0]} 
        angle={0.3} 
        penumbra={1} 
        intensity={2} 
        color="#ffffff" 
        castShadow
        shadow-mapSize={[1024, 1024]} 
      />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <Suspense fallback={null}>
        {/* 
           Physics Configuration:
           We only pause Physics completely when the Shop is open.
           Otherwise, it runs its default loop (1 step per frame + Sync).
           PhysicsStepper adds extra steps if timeScale > 1.
        */}
        <Physics gravity={[0, -19.62, 0]} timeStep={1/60} paused={isPaused}>
          <PhysicsStepper steps={timeScale} active={!isPaused} />
          
          <Machine 
             onCoinCollected={onCoinCollected} 
             extenderLevel={extenderLevel} 
             timeScale={timeScale}
          />
          <Coins 
            coins={activeCoins} 
            onSplit={onSplit} 
            onExplode={onExplode} 
            onTransmute={onTransmute}
            onInteraction={onInteraction}
            magnetLevel={magnetLevel}
          />
        </Physics>
        
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
};

export default Scene3D;
