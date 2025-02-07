// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const SECRET_CODE = "josephissex"; // Change this to your desired secret code

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Automatically redirect if already authenticated
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
      setError("Incorrect code loser. Please try again.");
    }
  };

  return (
    <div>
      <h1>Welcome to Kings Cup</h1>
      <p>Please enter the secret code to continue:</p>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Secret Code"
        />
        <button type="submit" style={{ marginLeft: "0.5rem" }}>
          Enter
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
