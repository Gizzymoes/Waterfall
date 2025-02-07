// app/lobby/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { setDoc, doc, updateDoc, arrayUnion } from "firebase/firestore";

interface Card {
  card: string;
  action: string;
  description: string;
}

// Define the mapping for each rank.
const cardMapping: { [key: string]: { action: string; description: string } } =
  {
    Ace: {
      action: "Waterfall",
      description:
        "An Ace has been drawn. It's waterfall time. You must drink and you can stop whenever you want. Everyone else has to drink as you do, and can only stop when you do.",
    },
    "2": {
      action: "Take a Drink",
      description: "A 2 has been drawn. Take two sips.",
    },
    "3": {
      action: "Give 2",
      description: "A 3 has been drawn. Choose someone to take 3 sips.",
    },
    "4": {
      action: "Heaven",
      description:
        "A 4 has been drawn. PUT YOUR ARM UP. The last person to do so must drink.",
    },
    "5": {
      action: "Categories",
      description:
        "A 5 has been drawn. Choose a category and everyone must name something in that category. The first to fail, or say it too slow, drinks.",
    },
    "6": {
      action: "Mate",
      description:
        "A 6 has been drawn. Choose a mate. When you drink, they drink too. If they are already someone's mate, they will be reassigned.",
    },
    "7": {
      action: "Thumb",
      description:
        "A 7 has been drawn. You are now the Thumb Master. Raise your thumb at any time and others must follow. The last to do so drinks.",
    },
    "8": {
      action: "Lads Drink",
      description: "An 8 has been drawn. Lads, take a drink.",
    },
    "9": {
      action: "Epic sussy Ryan Rhyme time",
      description:
        "A 9 has been drawn. Say a word and everyone else must say a word that rhymes. The first to fail drinks.",
    },
    "10": {
      action: "Question Master",
      description:
        "A 10 has been drawn. You are now the Question Master. Anyone who answers your questions must drink until a new Question Master is designated.",
    },
    Jack: {
      action: "Take a Drink",
      description: "A Jack has been drawn. Take a drink.",
    },
    Queen: {
      action: "Take a Drink",
      description: "A Queen has been drawn. Take a drink.",
    },
    King: {
      action: "New Rule",
      description:
        "A King has been drawn. Create a new rule for the game. Enter the rule text, and everyone must follow it or drink.",
    },
  };

// Generate a full 52-card deck (4 copies of each rank).
function generateDeck(): Card[] {
  const deck: Card[] = [];
  Object.keys(cardMapping).forEach((rank) => {
    for (let i = 0; i < 4; i++) {
      deck.push({
        card: rank,
        action: cardMapping[rank].action,
        description: cardMapping[rank].description,
      });
    }
  });
  return deck;
}

// Simple shuffle function.
function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

// Generate a short room code (4 uppercase letters).
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");

  // Redirect to login if not authenticated.
  useEffect(() => {
    if (localStorage.getItem("game-auth") !== "true") {
      router.push("/");
    }
  }, [router]);

  const handleCreateRoom = async () => {
    if (!name) return alert("Enter your name");
    try {
      const roomCode = generateRoomCode();
      // Create a new room document with a shuffled deck and initial state.
      await setDoc(doc(db, "rooms", roomCode), {
        players: [name],
        currentTurn: 0,
        deck: shuffle(generateDeck()),
        currentCard: null,
        thumbMaster: null,
        questionMaster: null,
        currentRule: "",
        mates: {},
      });
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomCode);
      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleJoinRoom = async () => {
    if (!name || !joinRoomId) {
      return alert("Enter both your name and a valid room ID");
    }
    try {
      const roomCode = joinRoomId.toUpperCase();
      const roomDocRef = doc(db, "rooms", roomCode);
      await updateDoc(roomDocRef, {
        players: arrayUnion(name),
      });
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomCode);
      router.push(`/room/${roomCode}`);
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
