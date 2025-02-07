// app/lobby/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  setDoc,
  doc,
  updateDoc,
  arrayUnion,
  collection,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface CardType {
  card: string;
  suit: string;
  action: string;
  description: string;
}

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

function generateDeck(): CardType[] {
  const deck: CardType[] = [];
  const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
  const ranks = Object.keys(cardMapping);
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        card: rank,
        suit,
        action: cardMapping[rank].action,
        description: cardMapping[rank].description,
      });
    }
  }
  return deck;
}

function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface LobbyRoom {
  id: string;
  players: string[];
  referee?: string | null;
}

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [activeLobbies, setActiveLobbies] = useState<LobbyRoom[]>([]);
  const [role, setRole] = useState<"player" | "referee" | "observer">("player");

  useEffect(() => {
    if (localStorage.getItem("game-auth") !== "true") {
      router.push("/");
    }
  }, [router]);

  // Subscribe to active lobbies.
  useEffect(() => {
    const roomsRef = collection(db, "rooms");
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      const lobbies: LobbyRoom[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        players: (doc.data() as { players: string[] }).players,
        referee: (doc.data() as any).referee || null,
      }));
      setActiveLobbies(lobbies);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!name) return alert("Enter your name");
    if (role === "observer") {
      return alert("Observers cannot create a room.");
    }
    try {
      const roomCode = generateRoomCode();
      await setDoc(doc(db, "rooms", roomCode), {
        players: [name],
        referee: role === "referee" ? name : null,
        currentTurn: 0,
        deck: shuffle(generateDeck()),
        currentCard: null,
        thumbMaster: null,
        questionMaster: null,
        currentRule: "",
        mates: {},
        penalties: {},
        isPaused: false,
        pauseReason: "",
        penaltyAnnouncement: "",
      });
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomCode);
      localStorage.setItem("playerRole", role);
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
      if (role === "observer") {
        // Observers join without updating the players list.
      } else if (role === "referee") {
        const roomSnap = await getDoc(roomDocRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          if (data.referee && data.referee !== name) {
            return alert("This room already has a referee.");
          }
          await updateDoc(roomDocRef, {
            referee: name,
            players: arrayUnion(name),
          });
        } else {
          return alert("Room not found.");
        }
      } else {
        await updateDoc(roomDocRef, { players: arrayUnion(name) });
      }
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomCode);
      localStorage.setItem("playerRole", role);
      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please check the room ID.");
    }
  };

  const handleJoinActiveLobby = async (roomId: string) => {
    if (!name) {
      alert("Enter your name first.");
      return;
    }
    try {
      const roomDocRef = doc(db, "rooms", roomId);
      if (role === "observer") {
        // Observers join without modifying the players list.
      } else if (role === "referee") {
        const roomSnap = await getDoc(roomDocRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          if (data.referee && data.referee !== name) {
            return alert("This room already has a referee.");
          }
          await updateDoc(roomDocRef, {
            referee: name,
            players: arrayUnion(name),
          });
        } else {
          return alert("Room not found.");
        }
      } else {
        await updateDoc(roomDocRef, { players: arrayUnion(name) });
      }
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomId);
      localStorage.setItem("playerRole", role);
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error joining active lobby:", error);
      alert("Failed to join active lobby. Please try again.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Lobby</h1>
            <div className="mb-4">
              <Label htmlFor="name" className="block mb-1">
                Your Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <p className="mb-1">Select Role:</p>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="role"
                    value="player"
                    checked={role === "player"}
                    onChange={(e) =>
                      setRole(
                        e.target.value as "player" | "referee" | "observer"
                      )
                    }
                  />
                  <span>Player</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="role"
                    value="referee"
                    checked={role === "referee"}
                    onChange={(e) =>
                      setRole(
                        e.target.value as "player" | "referee" | "observer"
                      )
                    }
                  />
                  <span>Referee</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="role"
                    value="observer"
                    checked={role === "observer"}
                    onChange={(e) =>
                      setRole(
                        e.target.value as "player" | "referee" | "observer"
                      )
                    }
                  />
                  <span>Observer</span>
                </label>
              </div>
            </div>
            <div className="mb-4">
              <Button onClick={handleCreateRoom} className="w-full">
                Create New Room
              </Button>
            </div>
            <div className="mb-4">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Room ID to join"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleJoinRoom}>Join Room</Button>
              </div>
            </div>
          </Card>
        </div>
        <div>
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Active Lobbies</h2>
            {activeLobbies.length === 0 ? (
              <p>No active lobbies.</p>
            ) : (
              <ul className="space-y-2">
                {activeLobbies.map((lobby) => (
                  <li
                    key={lobby.id}
                    className="flex items-center justify-between"
                  >
                    <span>
                      <strong>{lobby.id}</strong> ({lobby.players.length}{" "}
                      players)
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleJoinActiveLobby(lobby.id)}
                    >
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
