// components/LoadingScreen.tsx
"use client";

import { motion } from "framer-motion";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = "Joining game...",
}: LoadingScreenProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ marginTop: 0 }}
    >
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-white mb-4"></div>
        <p className="text-lg text-white font-semibold">{message}</p>
      </div>
    </motion.div>
  );
}
