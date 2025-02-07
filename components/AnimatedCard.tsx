// components/AnimatedCard.tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React from "react";

interface AnimatedCardProps {
  card: string;
  suit: string;
  className?: string;
}

export default function AnimatedCard({
  card,
  suit,
  className,
}: AnimatedCardProps) {
  const fileName = `${card.toLowerCase()}_of_${suit.toLowerCase()}.svg`;
  const src = `/SVG-cards-1.3/${fileName}`;

  const variants = {
    hidden: { opacity: 0, y: -50, rotate: -10 },
    visible: { opacity: 1, y: 0, rotate: 0 },
  };

  return (
    <motion.div
      className={`max-w-xs mx-auto border rounded-lg shadow-lg overflow-hidden ${className}`}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.05 }}
      variants={variants}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Image
        src={src}
        alt={`${card} of ${suit}`}
        width={300}
        height={450}
        className="w-full h-auto object-contain"
      />
    </motion.div>
  );
}
