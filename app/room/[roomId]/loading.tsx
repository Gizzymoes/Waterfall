// app/room/[roomId]/loading.tsx
import React from "react";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Next.js automatically displays this while it
 * is navigating to /room/[roomId].
 */
export default function Loading() {
  return <LoadingScreen />;
}
