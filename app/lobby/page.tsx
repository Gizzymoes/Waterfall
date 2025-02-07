// app/lobby/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

interface Card {
  card: string;
  action: string;
}

// A sample deck of cards. You can customize these as needed.
const defaultDeck: Card[] = [
  { card: "Ace", action: "Waterfall" },
  { card: "2", action: "You" },
  { card: "3", action: "Me" },
  { card: "4", action: "Floor" },
  { card: "5", action: "Guys" },
  { card: "6", action: "Chicks" },
  { card: "7", action: "Heaven" },
  { card: "8", action: "Mate" },
  { card: "9", action: "Rhyme" },
  { card: "10", action: "Categories" },
  { card: "Jack", action: "Never Have I Ever" },
  { card: "Queen", action: "Question Master" },
  { card: "King", action: "Make a Rule" },
];

// A simple shuffle function
function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  // Check if the user is authenticated; if not, redirect to login
  useEffect(() => {
    if (localStorage.getItem("game-auth") !== "true") {
      router.push("/");
    }
  }, [router]);

  const handleCreateRoom = async () => {
    if (!name) return alert("Enter your name");
    try {
      // Create a new room document in Firestore with a shuffled deck
      const roomRef = await addDoc(collection(db, "rooms"), {
        players: [name],
        currentTurn: 0, // Index for turn order (first player)
        deck: shuffle(defaultDeck),
        currentCard: null,
      });
      // Save session info (player name and room id) in localStorage for reconnection
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomRef.id);
      router.push(`/room/${roomRef.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleJoinRoom = async () => {
    if (!name || !joinRoomId) {
      return alert("Enter both your name and a valid room ID");
    }
    try {
      const roomDoc = doc(db, "rooms", joinRoomId);
      // Add this player to the room’s players array
      await updateDoc(roomDoc, {
        players: arrayUnion(name),
      });
      // Save session info
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", joinRoomId);
      router.push(`/room/${joinRoomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please check the room ID.");
    }
  };

  return (
    <div>
      <h1>Lobby</h1>
      <div>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginRight: "1rem" }}
        />
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleCreateRoom}>Create New Room</button>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <input
          type="text"
          placeholder="Room ID to join"
          value={joinRoomId}
          onChange={(e) => setJoinRoomId(e.target.value)}
          style={{ marginRight: "1rem" }}
        />
        <button onClick={handleJoinRoom}>Join Room</button>
      </div>
    </div>
  );
}
