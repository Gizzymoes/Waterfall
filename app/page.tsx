// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { waitForAuth } from "@/lib/firebase";

const SECRET_CODE = process.env.NEXT_PUBLIC_SECRET_CODE;

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Automatically redirect if already authenticated.
  useEffect(() => {
    waitForAuth.then(() => {
      const auth = localStorage.getItem("game-auth");
      if (auth === "true") {
        router.push("/lobby");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (code === SECRET_CODE) {
      localStorage.setItem("game-auth", "true");
      await waitForAuth; // Ensure auth is ready
      router.push("/lobby");
    } else {
      setError("Incorrect code. Please try again.");
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-white"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-screen bg-background"
    >
      <Card className="w-full max-w-md p-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl font-bold text-center"
          >
            King&apos;s Cup
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-center text-lg pb-4"
          >
            Enter the secret code to join the party.
          </motion.p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div variants={itemVariants}>
              <Label htmlFor="secret-code" className="block mb-2">
                Secret Code
              </Label>
              <Input
                id="secret-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••••"
                className="w-full"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <Button type="submit" className="w-full">
                Enter
              </Button>
            </motion.div>
          </form>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="!mt-6 text-center text-red-400 font-semibold"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </Card>
    </motion.div>
  );
}
