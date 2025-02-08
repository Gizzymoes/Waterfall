// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

const SECRET_CODE = process.env.NEXT_PUBLIC_SECRET_CODE;

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Automatically redirect if already authenticated.
  useEffect(() => {
    const auth = localStorage.getItem("game-auth");
    if (auth === "true") {
      router.push("/lobby");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === SECRET_CODE) {
      localStorage.setItem("game-auth", "true");
      router.push("/lobby");
    } else {
      setError("Incorrect code. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-screen bg-background"
    >
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-center mb-4">
          Welcome to Kings Cup
        </h1>
        <p className="text-center mb-6">
          Please enter the secret code to continue:
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="secret-code" className="block mb-1">
              Secret Code
            </Label>
            <Input
              id="secret-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Secret Code"
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
        {error && <p className="mt-4 text-center text-destructive">{error}</p>}
      </Card>
    </motion.div>
  );
}
