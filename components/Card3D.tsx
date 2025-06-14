"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { MeshPhysicalMaterial } from "three";

interface Card3DProps {
  card: string;
  suit: string;
  onLoad?: () => void;
}

function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<{
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({ alpha: null, beta: null, gamma: null });

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      });
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  return orientation;
}

function CardModel({ card, suit, onLoad }: Card3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const orientation = useDeviceOrientation();
  const isMobile = orientation.beta !== null && orientation.gamma !== null;
  const [isLoaded, setIsLoaded] = useState(false);

  const suitSymbols: { [key: string]: string } = {
    Hearts: "♥",
    Diamonds: "♦",
    Clubs: "♣",
    Spades: "♠",
  };
  const rankAbbreviations: { [key: string]: string } = {
    Ace: "A",
    King: "K",
    Queen: "Q",
    Jack: "J",
  };

  const suitSymbol = suitSymbols[suit] || "?";
  const cardRank = rankAbbreviations[card] || card;
  const cardColor =
    suit === "Hearts" || suit === "Diamonds"
      ? new THREE.Color("#e11d48")
      : new THREE.Color("#1e293b"); // A softer dark slate color

  useEffect(() => {
    if (onLoad && isLoaded) {
      onLoad();
    }
  }, [onLoad, isLoaded]);

  useFrame((state) => {
    if (groupRef.current) {
      // Intro animation
      const targetScale = isLoaded ? 1 : 0;
      groupRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );

      // Interaction rotation
      let targetRotation;
      if (isMobile) {
        const { beta, gamma } = orientation;
        const x = THREE.MathUtils.degToRad((beta || 0) - 90);
        const y = THREE.MathUtils.degToRad(gamma || 0);
        targetRotation = new THREE.Euler(x, y, 0);
      } else {
        const { x, y } = state.mouse;
        targetRotation = hovered
          ? new THREE.Euler(y * 0.2, x * 0.4, 0)
          : new THREE.Euler(0, 0, 0);
      }

      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRotation.x,
        0.1
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotation.y,
        0.1
      );
    }
  });

  const glassMaterial = new MeshPhysicalMaterial({
    transmission: 1.0,
    thickness: 0.1,
    roughness: 0.2,
    envMapIntensity: 0.8,
    color: new THREE.Color("white"),
    metalness: 0,
    transparent: true,
    opacity: 0.6,
  });

  const CARD_DEPTH = 0.05;
  const TEXT_Z_POS = CARD_DEPTH / 2 + 0.001; // Slightly in front of the card face

  return (
    <group
      ref={groupRef}
      scale={0}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox
        args={[2.7, 4, CARD_DEPTH]} // Made the card thinner
        radius={0.15}
        smoothness={4}
        onAfterRender={() => !isLoaded && setIsLoaded(true)}
      >
        <primitive object={glassMaterial} />
      </RoundedBox>

      {/* Card Content with improved layout */}
      <Text
        position={[-1.15, 1.7, TEXT_Z_POS]}
        fontSize={0.4}
        color={cardColor}
        anchorX="left"
      >
        {cardRank}
      </Text>
      <Text
        position={[-1.15, 1.35, TEXT_Z_POS]} // Increased spacing
        fontSize={0.3}
        color={cardColor}
        anchorX="left"
      >
        {suitSymbol}
      </Text>

      <Text
        position={[0, 0, TEXT_Z_POS]}
        fontSize={2.2}
        color={cardColor}
        anchorX="center"
        anchorY="middle"
        material-opacity={1.0}
      >
        {suitSymbol}
      </Text>

      <Text
        position={[1.0, -1.7, TEXT_Z_POS]} // Moved further inside
        rotation-z={Math.PI}
        fontSize={0.4}
        color={cardColor}
        anchorX="right"
      >
        {cardRank}
      </Text>
      <Text
        position={[1.0, -1.35, TEXT_Z_POS]} // Moved further inside
        rotation-z={Math.PI}
        fontSize={0.3}
        color={cardColor}
        anchorX="right"
      >
        {suitSymbol}
      </Text>
    </group>
  );
}

export default function Card3D({ card, suit, onLoad }: Card3DProps) {
  return (
    <div className="w-full h-[400px] md:h-[500px] cursor-pointer touch-none">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 50 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} color="#ffffff" />
        <pointLight
          position={[-10, -10, -10]}
          color="#e11d48"
          intensity={0.8}
        />
        <CardModel card={card} suit={suit} onLoad={onLoad} />
      </Canvas>
    </div>
  );
}
