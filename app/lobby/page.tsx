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
import { motion, AnimatePresence } from "framer-motion";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface CardType {
  card: string;
  suit: string;
  action: string;
  description: string;
}

interface LobbyRoomData {
  players: string[];
  referee?: string | null;
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
  const [error, setError] = useState("");

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  useEffect(() => {
    if (localStorage.getItem("game-auth") !== "true") {
      router.push("/");
    }
  }, [router]);

  // Subscribe to active lobbies
  useEffect(() => {
    const roomsRef = collection(db, "rooms");
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      const lobbies: LobbyRoom[] = snapshot.docs.map((doc) => {
        const data = doc.data() as LobbyRoomData;
        return {
          id: doc.id,
          players: data.players,
          referee: data.referee || null,
        };
      });

      setActiveLobbies(lobbies);
    });
    return () => unsubscribe();
  }, []);

  // Actually creates a new room.
  const actuallyCreateRoom = async () => {
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
      setError("Error creating room. Please try again.");
    }
  };

  // Shows confirmation dialog before actually creating a room
  const handleCreateRoom = () => {
    if (!name) {
      return setError("Enter your name");
    }
    if (role === "observer") {
      return setError("Observers cannot create a room.");
    }
    setConfirmTitle("Start New Room");
    setConfirmDescription("Are you sure you want to start a new room?");
    setConfirmAction(() => actuallyCreateRoom);
    setConfirmOpen(true);
  };

  // Joins a room by ID
  const handleJoinRoom = async () => {
    if (!name || !joinRoomId) {
      return setError("Enter both your name and a valid room ID");
    }
    try {
      const roomCode = joinRoomId.toUpperCase();
      const roomDocRef = doc(db, "rooms", roomCode);

      if (role === "observer") {
        // Observers do not update the players list
      } else if (role === "referee") {
        const roomSnap = await getDoc(roomDocRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          if (data.referee && data.referee !== name) {
            return setError("This room already has a referee.");
          }
          await updateDoc(roomDocRef, {
            referee: name,
            players: arrayUnion(name),
          });
        } else {
          return setError("Room not found.");
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
      setError("Failed to join room. Please check the room ID.");
    }
  };

  // Joins an active lobby from the list
  const handleJoinActiveLobby = async (roomId: string) => {
    if (!name) {
      setError("Enter your name first.");
      return;
    }
    try {
      const roomDocRef = doc(db, "rooms", roomId);

      if (role === "observer") {
        // Observers do not update the players list
      } else if (role === "referee") {
        const roomSnap = await getDoc(roomDocRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          if (data.referee && data.referee !== name) {
            return setError("This room already has a referee.");
          }
          await updateDoc(roomDocRef, {
            referee: name,
            players: arrayUnion(name),
          });
        } else {
          return setError("Room not found.");
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
      setError("Failed to join active lobby. Please try again.");
    }
  };

  const errorVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="lobby-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="container mx-auto p-4 sm:p-6 md:p-8"
        >
          <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
              Multiplayer Lobby
            </h1>

            {error && (
              <motion.div
                variants={errorVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                <Alert
                  variant="destructive"
                  className="rounded-xl overflow-hidden bg-red-50 border border-red-200"
                >
                  <AlertTitle className="text-red-700">Error</AlertTitle>
                  <AlertDescription className="text-red-600">
                    {error}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Common inputs for name and role */}
            <div className="mb-8">
              <Label htmlFor="name" className="block text-sm mb-1 text-white">
                Your Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium text-white mb-1 mt-6">
                Select Role
              </p>
              <div className="flex items-center space-x-3 flex-wrap">
                {(
                  [
                    { value: "player", label: "Player" },
                    { value: "referee", label: "Referee" },
                    { value: "observer", label: "Observer" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setRole(opt.value as "player" | "referee" | "observer")
                    }
                    className={
                      (role === opt.value
                        ? "bg-white/20 backdrop-blur-md"
                        : "bg-white/5 hover:bg-white/10") +
                      " rounded-full px-4 py-1 text-sm font-semibold text-white transition-colors"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <motion.div layout className="min-h-[20px] pt-1">
                <AnimatePresence mode="wait">
                  {role === "observer" && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-yellow-300"
                    >
                      Note: Observers cannot create a room.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Create a Room</h2>
                <p className="text-sm text-white/80 mb-4">
                  Start a new room to play with friends.
                </p>
                <Button
                  onClick={handleCreateRoom}
                  variant="outline"
                  className="w-full"
                >
                  Create Room
                </Button>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Join a Room</h2>
                <div className="mb-4">
                  <Label
                    htmlFor="join-room"
                    className="block text-sm text-white mb-1"
                  >
                    Room ID
                  </Label>
                  <Input
                    id="join-room"
                    type="text"
                    placeholder="Enter room code"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={handleJoinRoom}
                  variant="outline"
                  className="w-full"
                >
                  Join Room
                </Button>
              </Card>
            </div>

            {/* Active lobbies */}
            <div className="mt-8">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Active Lobbies</h2>
                {activeLobbies.length === 0 ? (
                  <p className="text-sm text-white/80">
                    No active lobbies available.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activeLobbies.map((lobby, index) => (
                      <li
                        key={`lobby-${lobby.id || "empty"}-${index}`}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/20 py-2 gap-2"
                      >
                        <span className="text-sm font-medium text-left">
                          <strong>{lobby.id || "Unknown"}</strong> (
                          {lobby.players.length} players)
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleJoinActiveLobby(lobby.id)}
                          variant="outline"
                          className="rounded-xl"
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
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-sm p-6 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-2">{confirmTitle}</h2>
              <p className="mb-6 text-white/80">{confirmDescription}</p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  className="bg-transparent hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    confirmAction();
                    setConfirmOpen(false);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
