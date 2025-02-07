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

// Removed: import LoadingScreen from "@/components/LoadingScreen";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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
      description: "An Ace has been drawn. It's waterfall time...",
    },
    "2": {
      action: "Waterfall",
      description: "A 2 has been drawn. Some example...",
    },
    // ... rest of your mapping
    King: {
      action: "New Rule",
      description: "A King has been drawn. Create a new rule...",
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

  // Removed: const [isLoading, setIsLoading] = useState(false);
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
      const lobbies: LobbyRoom[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        players: (doc.data() as { players: string[] }).players,
        referee: (doc.data() as any).referee || null,
      }));
      setActiveLobbies(lobbies);
    });
    return () => unsubscribe();
  }, []);

  // Actually creates a new room.
  const actuallyCreateRoom = async () => {
    try {
      // Removed: setIsLoading(true);
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

      // Navigate to the new room
      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error creating room:", error);
      setError("Error creating room. Please try again.");
      // Removed: setIsLoading(false);
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
      // Removed: setIsLoading(true);
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
        // Normal player
        await updateDoc(roomDocRef, { players: arrayUnion(name) });
      }
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomCode);
      localStorage.setItem("playerRole", role);

      // Navigate
      router.push(`/room/${roomCode}`);
    } catch (error) {
      console.error("Error joining room:", error);
      setError("Failed to join room. Please check the room ID.");
      // Removed: setIsLoading(false);
    }
  };

  // Joins an active lobby from the list
  const handleJoinActiveLobby = async (roomId: string) => {
    if (!name) {
      setError("Enter your name first.");
      return;
    }
    try {
      // Removed: setIsLoading(true);
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
        // Normal player
        await updateDoc(roomDocRef, { players: arrayUnion(name) });
      }
      localStorage.setItem("playerName", name);
      localStorage.setItem("roomId", roomId);
      localStorage.setItem("playerRole", role);

      // Navigate
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Error joining active lobby:", error);
      setError("Failed to join active lobby. Please try again.");
      // Removed: setIsLoading(false);
    }
  };

  // Framer Motion variants for the error alert
  const errorVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <>
      {/* We no longer wrap everything with "isLoading && <LoadingScreen />" */}
      <AnimatePresence>
        {/* Lobby Content */}
        <motion.div
          key="lobby-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="container mx-auto p-4"
        >
          <AnimatePresence>
            {error && (
              <motion.div
                variants={errorVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="mb-4"
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
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-4"
            >
              <Card className="p-6 rounded-xl border shadow-sm overflow-hidden">
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
                    className="w-full rounded-xl border border-gray-300 shadow-sm"
                  />
                </div>
                <div className="mb-4">
                  <Button
                    onClick={handleCreateRoom}
                    className="w-full rounded-xl"
                    variant="outline"
                  >
                    Create New Room
                  </Button>
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
                        className="form-radio text-blue-500"
                      />
                      <span className="text-sm font-medium">Player</span>
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
                        className="form-radio text-blue-500"
                      />
                      <span className="text-sm font-medium">Referee</span>
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
                        className="form-radio text-blue-500"
                      />
                      <span className="text-sm font-medium">Observer</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      placeholder="Room ID to join"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      className="flex-1 rounded-xl border border-gray-300 shadow-sm"
                    />
                    <Button
                      onClick={handleJoinRoom}
                      variant="outline"
                      className="rounded-xl"
                    >
                      Join Room
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <Card className="p-6 rounded-xl border shadow-sm overflow-hidden">
                <h2 className="text-xl font-bold mb-4">Active Lobbies</h2>
                {activeLobbies.length === 0 ? (
                  <p>No active lobbies.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeLobbies.map((lobby, index) => (
                      <li
                        key={`lobby-${lobby.id || "empty"}-${index}`}
                        className="flex items-center justify-between"
                      >
                        <span>
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
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                confirmAction();
              }}
            >
              Confirm
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
