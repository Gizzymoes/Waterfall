// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  arrayRemove,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import AnimatedCard from "@/components/AnimatedCard";
import { motion, AnimatePresence } from "framer-motion";

interface CardType {
  card: string;
  suit: string;
  action: string;
  description: string;
  drawnBy?: string;
}

interface RoomData {
  players: string[];
  referee?: string | null;
  currentTurn: number;
  deck: CardType[];
  currentCard: CardType | null;
  thumbMaster: string | null;
  questionMaster: string | null;
  currentRule?: string;
  mates?: { [key: string]: string };
  penalties?: { [key: string]: number };
  isPaused?: boolean;
  pauseReason?: string;
  penaltyAnnouncement?: string;
}

interface UpdateData {
  deck?: CardType[];
  currentCard?: CardType | null;
  currentRule?: string;
  thumbMaster?: string | null;
  questionMaster?: string | null;
  isPaused?: boolean;
  pauseReason?: string;
  penaltyAnnouncement?: string;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [role, setRole] = useState<"player" | "referee" | "observer">("player");
  const [selectingMate, setSelectingMate] = useState(false);

  // Predefined fun messages for referee drink cards.
  const refereeFunMessages: { [key: string]: string[] } = {
    "2": [
      "Who do you think has been the loudest or most over-the-top in this game? Pick them to drink.",
      "Who do you think has been the biggest complainer this game? They drink.",
      "Who do you think hesitates the most before making a decision? Give them a drink.",
      "Who do you think has been the least lucky in this game? Let them drink their sorrows away.",
    ],
    "3": [
      "Who do you think has been roasting people the most? Pick them to drink.",
      "Who do you think has been making people laugh the hardest, intentionally or not? They drink.",
      "Who do you think is taking this game the most seriously? Time to balance it out with a drink.",
    ],
    Jack: [
      "Who do you think is getting away with drinking the least? Time for them to catch up.",
      "Who do you think keeps disappearing the most? Bring them back with a drink.",
    ],
    Queen: [
      "Who do you think has the worst luck in this game? Give them a drink.",
      "Who do you think secretly enjoys the attention the most? Time for a sip.",
    ],
    "8": [
      "Who do you think has been swearing the most? They drink.",
      "Who do you think is trying too hard to stay sober? Make them drink.",
      "Who do you think would be the worst designated driver right now? Pick them to drink.",
    ],
  };

  // Set local user name and role; if not set, redirect to lobby.
  useEffect(() => {
    const name = localStorage.getItem("playerName");
    const storedRole =
      (localStorage.getItem("playerRole") as
        | "player"
        | "referee"
        | "observer") || "player";
    if (!name) {
      router.push("/lobby");
    } else {
      setLocalName(name);
      setRole(storedRole);
    }
  }, [router]);

  // Subscribe to room data.
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data() as RoomData);
      } else {
        alert("Room not found.");
        router.push("/lobby");
      }
    });
    return () => unsubscribe();
  }, [roomId, router]);

  // Clear penalty announcement after 5 seconds.
  useEffect(() => {
    if (
      roomData?.penaltyAnnouncement &&
      roomData.penaltyAnnouncement.trim() !== ""
    ) {
      const timeout = setTimeout(() => {
        const roomRef = doc(db, "rooms", roomId);
        updateDoc(roomRef, { penaltyAnnouncement: "" });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [roomData?.penaltyAnnouncement, roomId]);

  // NEW: Scroll to top when a violation occurs or game is paused.
  useEffect(() => {
    if (
      (roomData?.penaltyAnnouncement &&
        roomData.penaltyAnnouncement.trim() !== "") ||
      roomData?.isPaused
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [roomData?.penaltyAnnouncement, roomData?.isPaused]);

  if (!roomData) return <p>Loading room data...</p>;

  const gameIsPaused = roomData.isPaused;
  const isMyTurn = localName === roomData.players[roomData.currentTurn];

  const shuffle = <T,>(array: T[]): T[] =>
    array.sort(() => Math.random() - 0.5);

  const cardMapping: {
    [key: string]: { action: string; description: string };
  } = {
    Ace: {
      action: "Waterfall",
      description: "Drink continuously until you decide to stop.",
    },
    "2": { action: "Take a Drink", description: "Take two sips." },
    "3": {
      action: "Give 2",
      description: "Choose someone to take three sips.",
    },
    "4": {
      action: "Heaven",
      description: "PUT YOUR ARM UP for Heaven! The last to do so drinks.",
    },
    "5": {
      action: "Categories",
      description: "Choose a category; the first to fail drinks.",
    },
    "6": {
      action: "Mate",
      description: "Choose a mate; when you drink, they drink too.",
    },
    "7": {
      action: "Thumb",
      description: "You're now the Thumb Master. Raise your thumb anytime.",
    },
    "8": { action: "Guys Drink", description: "All the guys drink." },
    "9": {
      action: "Bust a Rhyme",
      description: "Say a word; others must rhyme—first to fail drinks.",
    },
    "10": {
      action: "Question Master",
      description:
        "You're now the Question Master. Anyone answering your questions drinks.",
    },
    Jack: { action: "Take a Drink", description: "Take a drink." },
    Queen: { action: "Take a Drink", description: "Take a drink." },
    King: {
      action: "New Rule",
      description: "Create a new rule for the game.",
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

  const drawCard = async () => {
    if (!roomData.deck || roomData.deck.length === 0)
      return alert("No more cards in the deck!");
    if (!isMyTurn) return alert("It's not your turn!");
    if (gameIsPaused) return alert("The game is currently paused.");
    const nextCard: CardType = {
      ...roomData.deck[0],
      drawnBy: localName || "Unknown",
    };

    if (
      role === "referee" &&
      ["2", "3", "Jack", "Queen", "8"].includes(nextCard.card)
    ) {
      const messages = refereeFunMessages[nextCard.card] || [];
      if (messages.length > 0) {
        const randomIndex = Math.floor(Math.random() * messages.length);
        nextCard.description = messages[randomIndex];
      }
    }

    const roomRef = doc(db, "rooms", roomId);
    const updateData: UpdateData = {
      deck: roomData.deck.slice(1),
      currentCard: nextCard,
      penaltyAnnouncement: "",
    };

    if (nextCard.action === "New Rule") {
      const ruleText = prompt(
        "You picked out the Rule Card! Enter your new rule:"
      );
      if (ruleText) {
        updateData.currentRule = ruleText;
      }
    } else if (nextCard.action === "Mate") {
      setSelectingMate(true);
      await updateDoc(roomRef, updateData);
      return;
    } else if (nextCard.action === "Thumb") {
      updateData.thumbMaster = localName;
    } else if (nextCard.action === "Question Master") {
      updateData.questionMaster = localName;
    }
    await updateDoc(roomRef, updateData);
  };

  const endTurn = async () => {
    if (!isMyTurn) return;
    if (gameIsPaused) return alert("The game is currently paused.");
    const roomRef = doc(db, "rooms", roomId);
    const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
    await updateDoc(roomRef, {
      currentCard: null,
      currentTurn: nextTurn,
      penaltyAnnouncement: "",
    });
  };

  // Updates the players array and adjusts currentTurn if needed.
  const updatePlayersAfterRemoval = async (newPlayers: string[]) => {
    const roomRef = doc(db, "rooms", roomId);
    let newCurrentTurn = roomData!.currentTurn;
    if (newPlayers.length > 0) {
      newCurrentTurn = newCurrentTurn % newPlayers.length;
    } else {
      newCurrentTurn = 0;
    }
    await updateDoc(roomRef, {
      players: newPlayers,
      currentTurn: newCurrentTurn,
    });
  };

  // Function for a player to leave the game voluntarily.
  const handleLeaveGame = async () => {
    if (!confirm("Are you sure you want to leave the game?")) return;
    try {
      const newPlayers = roomData.players.filter((p) => p !== localName);
      const removedIndex = roomData.players.indexOf(localName!);
      let newCurrentTurn = roomData.currentTurn;
      if (removedIndex !== -1) {
        if (removedIndex < roomData.currentTurn) {
          newCurrentTurn = roomData.currentTurn - 1;
        } else if (removedIndex === roomData.currentTurn) {
          newCurrentTurn =
            newPlayers.length > 0
              ? roomData.currentTurn % newPlayers.length
              : 0;
        }
      }
      const roomRef = doc(db, "rooms", roomId);
      const updateData: any = {
        players: newPlayers,
        currentTurn: newCurrentTurn,
      };
      if (localName === roomData.referee) {
        updateData.referee = null;
      }
      await updateDoc(roomRef, updateData);
      localStorage.removeItem("playerName");
      localStorage.removeItem("roomId");
      localStorage.removeItem("playerRole");
      router.push("/lobby");
    } catch (error) {
      console.error("Error leaving game:", error);
      alert("Failed to leave the game. Please try again.");
    }
  };

  // Function for the referee to remove another player.
  const removePlayer = async (playerName: string) => {
    if (!confirm(`Are you sure you want to remove ${playerName}?`)) return;
    try {
      const newPlayers = roomData.players.filter((p) => p !== playerName);
      const removedIndex = roomData.players.indexOf(playerName);
      let newCurrentTurn = roomData.currentTurn;
      if (removedIndex !== -1) {
        if (removedIndex < roomData.currentTurn) {
          newCurrentTurn = roomData.currentTurn - 1;
        } else if (removedIndex === roomData.currentTurn) {
          newCurrentTurn =
            newPlayers.length > 0
              ? roomData.currentTurn % newPlayers.length
              : 0;
        }
      }
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        players: newPlayers,
        currentTurn: newCurrentTurn,
      });
    } catch (error) {
      console.error("Error removing player:", error);
      alert("Failed to remove player. Please try again.");
    }
  };

  const chooseMate = async (mateName: string) => {
    const roomRef = doc(db, "rooms", roomId);
    const updatedMates = { ...(roomData.mates || {}) };
    updatedMates[localName!] = mateName;
    await updateDoc(roomRef, { mates: updatedMates, currentCard: null });
    setSelectingMate(false);
  };

  const resetRound = async () => {
    const roomRef = doc(db, "rooms", roomId);
    const newDeck = shuffle(generateDeck());
    await updateDoc(roomRef, { deck: newDeck, currentCard: null });
  };

  const quitRoom = () => {
    localStorage.removeItem("playerName");
    localStorage.removeItem("roomId");
    localStorage.removeItem("playerRole");
    router.push("/lobby");
  };

  const markRuleViolation = async (playerName: string) => {
    if (role !== "referee") return;
    const reason = prompt(
      "Enter a short description explaining why you're giving this violation (and what a violation means):"
    );
    if (!reason) return;
    const roomRef = doc(db, "rooms", roomId);
    const currentPenalties = roomData.penalties || {};
    const newCount = (currentPenalties[playerName] || 0) + 1;
    const announcement = `Referee: ${playerName} has been given a violation for "${reason}". They must drink their penalty at the end of the game.`;
    await updateDoc(roomRef, {
      penalties: { ...currentPenalties, [playerName]: newCount },
      penaltyAnnouncement: announcement,
    });
  };

  const pauseGame = async () => {
    const reason = prompt(
      "Enter pause reason (e.g., Toilet Break):",
      "Toilet Break"
    );
    if (!reason) return;
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, { isPaused: true, pauseReason: reason });
  };

  const resumeGame = async () => {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, { isPaused: false, pauseReason: "" });
  };

  const renderCardMessage = (): string | null => {
    if (!roomData.currentCard) return null;
    const { card, suit, drawnBy, description } = roomData.currentCard;
    const cardName = `${card} of ${suit}`;
    if (drawnBy === localName) {
      if (role === "referee") {
        return `You drew ${cardName}. ${description}`;
      }
      switch (card) {
        case "Ace":
          return `You drew ${cardName}. Start the Waterfall—drink continuously until you decide to stop. Everyone must do the same`;
        case "2":
          return `You drew ${cardName}. Take two drinks.`;
        case "3":
          return `You drew ${cardName}. Choose someone to take three drinks.`;
        case "4":
          return `You drew ${cardName}. PUT YOUR ARM UP. The last to do so drinks.`;
        case "5":
          return `You drew ${cardName}. Pick a category. Then go in room order starting with yourself.`;
        case "6":
          return `You drew ${cardName}. Choose someone to be your mate and to drink along side you`;
        case "7":
          return `You drew ${cardName}. You're now the Thumb Master`;
        case "8":
          return `You drew ${cardName}. You must take a drink.`;
        case "9":
          return `You drew ${cardName}. Say a sentence that rhymes. Then go in room order and everyone must rhyme with that sentence.`;
        case "10":
          return `You drew ${cardName}. You're now the Question Master.`;
        case "Jack":
          return `You drew ${cardName}. You must take a drink.`;
        case "Queen":
          return `You drew ${cardName}. You must take a drink.`;
        case "King":
          return `You drew ${cardName} and created a new rule: ${
            roomData.currentRule || "No rule provided. What a mong"
          }`;
        default:
          return `You drew ${cardName}. ${description}`;
      }
    } else {
      if (
        drawnBy === roomData.referee &&
        ["2", "3", "Jack", "Queen", "8"].includes(card)
      ) {
        return `${drawnBy} is the referee. They drew ${cardName} and were prompted: "${description}". Whoever they select must drink for them.`;
      }
      switch (card) {
        case "Ace":
          return `${drawnBy} drew ${cardName}. Get ready for a waterfall.`;
        case "2":
          return `${drawnBy} drew ${cardName}. They've gotta drink twice`;
        case "3":
          return `${drawnBy} drew ${cardName}. They choose someone to take three drinks.`;
        case "4":
          return `${drawnBy} drew ${cardName}. PUT YOUR ARM UP, last to do it has to drink`;
        case "5":
          return `${drawnBy} drew ${cardName}. Categories time`;
        case "6":
          return `${drawnBy} drew ${cardName} and is choosing a mate.`;
        case "7":
          return `${drawnBy} drew ${cardName} and is now the Thumb Master.`;
        case "8":
          return `${drawnBy} drew ${cardName}. They must take a drink.`;
        case "9":
          return `${drawnBy} drew ${cardName}. It's pog sussy rhyme time. Going in room order, rhyme with the last sentence.`;
        case "10":
          return `${drawnBy} drew ${cardName} and is now the Question Master`;
        case "Jack":
          return `${drawnBy} drew ${cardName}. They must take a drink.`;
        case "Queen":
          return `${drawnBy} drew ${cardName}. They must take a drink.`;
        case "King":
          return `${drawnBy} drew ${cardName} and created a new rule: ${
            roomData.currentRule || "No rule provided."
          }`;
        default:
          return `${drawnBy} drew ${cardName}. ${description}`;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto p-4 space-y-6"
    >
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-3xl font-bold"
      >
        Room: {roomId}
      </motion.h1>

      {/* Animated Alerts for Violation & Pause */}
      <AnimatePresence>
        {roomData.penaltyAnnouncement &&
          roomData.penaltyAnnouncement.trim() !== "" && (
            <motion.div
              key="penaltyAnnouncement"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Alert
                variant="destructive"
                className="mt-4 border-2 border-red-600 shadow-lg"
              >
                <AlertTitle className="font-bold text-red-700">
                  Violation!
                </AlertTitle>
                <AlertDescription>
                  {roomData.penaltyAnnouncement}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {roomData.isPaused && (
          <motion.div
            key="pausedGame"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <Alert
              variant="default"
              className="mt-4 border-2 border-blue-600 shadow-lg"
            >
              <AlertTitle className="font-bold text-blue-700">
                Game Paused:
              </AlertTitle>
              <AlertDescription>{roomData.pauseReason}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Players List (names are white by default; referee name in blue) */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Players</h2>
          <ul className="space-y-2">
            {roomData.players.map((player, index) => (
              <li
                key={`player-${player || "empty"}-${index}`}
                className="flex flex-col sm:flex-row items-start sm:items-center"
              >
                <span
                  className={`font-bold text-white ${
                    player === roomData.referee ? "text-blue-600" : ""
                  }`}
                >
                  {player}
                </span>
                <div className="flex flex-wrap gap-1 mt-1 sm:mt-0 sm:ml-2">
                  {roomData.currentTurn === index && (
                    <span className="px-2 py-0.5 bg-green-200 text-green-700 rounded text-xs">
                      Current Turn
                    </span>
                  )}
                  {player === roomData.referee && (
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-700 rounded text-xs">
                      Referee
                    </span>
                  )}
                  {roomData.thumbMaster === player && (
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-700 rounded text-xs">
                      Thumb Master
                    </span>
                  )}
                  {roomData.questionMaster === player && (
                    <span className="px-2 py-0.5 bg-orange-200 text-orange-700 rounded text-xs">
                      Question Master
                    </span>
                  )}
                  {roomData.mates && roomData.mates[player] && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                      Mate: {roomData.mates[player]}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {/* Button for the current player to leave the game */}
          {role !== "observer" && (
            <div className="text-center mt-4">
              <Button variant="destructive" onClick={handleLeaveGame}>
                Leave Game
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Referee Controls */}
      {role === "referee" && (
        <AnimatePresence>
          <motion.div
            key="referee-controls"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <Card className="p-6 border-2 border-gray-300 shadow-md bg-gray-50">
              <h3 className="text-2xl font-bold mb-4 text-gray-800">
                Referee Controls
              </h3>
              <div className="mb-4">
                {roomData.isPaused ? (
                  <Button
                    onClick={resumeGame}
                    className="mb-2 bg-green-500 hover:bg-green-600 text-white rounded-xl"
                  >
                    Resume Game
                  </Button>
                ) : (
                  <Button
                    onClick={pauseGame}
                    className="mb-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl"
                  >
                    Pause Game
                  </Button>
                )}
              </div>
              <p className="mb-2 text-gray-700">
                Mark a violation for a player (this assigns a penalty for the
                end of the game):
              </p>
              <div className="space-y-2">
                {roomData.players
                  .filter((p) => p !== roomData.referee)
                  .map((p, index) => (
                    <div
                      key={`violation-${p || "empty"}-${index}`}
                      className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm"
                    >
                      <span className="text-gray-800">{p}</span>
                      <Button
                        size="sm"
                        onClick={() => markRuleViolation(p)}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                      >
                        Mark Violation
                      </Button>
                    </div>
                  ))}
              </div>
              {/* New Section for Removing a Player */}
              <div className="mt-4">
                <h4 className="text-lg font-bold text-gray-800">
                  Remove a Player
                </h4>
                <div className="space-y-2">
                  {roomData.players
                    .filter((p) => p !== roomData.referee)
                    .map((p, index) => (
                      <div
                        key={`remove-${p || "empty"}-${index}`}
                        className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm"
                      >
                        <span className="text-gray-800">{p}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removePlayer(p)}
                          className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Penalty Points</h2>
          {roomData.penalties && Object.keys(roomData.penalties).length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(roomData.penalties).map(([player, points]) => (
                <li key={`penalty-${player}`}>
                  {player}: {points} drink(s)
                </li>
              ))}
            </ul>
          ) : (
            <p>No penalties yet.</p>
          )}
          {roomData.deck.length === 0 && (
            <p className="mt-2 italic text-sm">
              Last card! Please finish your penalty drinks.
            </p>
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col md:flex-row md:justify-between items-center"
      >
        <p className="text-lg">Cards left: {roomData.deck.length}</p>
        {roomData.deck.length === 0 && (
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Button onClick={resetRound}>Reset Round</Button>
            <Button variant="destructive" onClick={quitRoom}>
              Quit Room
            </Button>
          </div>
        )}
      </motion.div>

      {roomData.currentRule && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Card className="p-4">
            <p>
              <strong>Current Rule:</strong> {roomData.currentRule}
            </p>
          </Card>
        </motion.div>
      )}

      {/* Current Card Section with Fixed Container Height */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Current Card</h2>
          <div className="relative min-h-[500px]">
            <AnimatePresence>
              {roomData.currentCard ? (
                <motion.div
                  key="current-card"
                  layout
                  className="absolute inset-0 flex flex-col items-center justify-center space-y-4"
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                >
                  <AnimatedCard
                    card={roomData.currentCard.card}
                    suit={roomData.currentCard.suit}
                    className="mb-4"
                  />
                  <p className="text-center">{renderCardMessage()}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="no-card"
                  layout
                  className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="mb-4">Your card will appear here.</p>
                  {isMyTurn && (
                    <Button onClick={drawCard} className="mx-auto">
                      Draw Card
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {role === "observer" ? (
        <Card className="p-6">
          <p>You are observing the game. You cannot take actions.</p>
        </Card>
      ) : gameIsPaused ? (
        <Card className="p-6">
          <p>Game is paused. Please wait for the referee to resume the game.</p>
        </Card>
      ) : isMyTurn ? (
        <div className="flex justify-center">
          {!roomData.currentCard ? (
            <Button onClick={drawCard}>Draw Card</Button>
          ) : (
            <Button onClick={endTurn}>End Turn</Button>
          )}
        </div>
      ) : (
        <Card className="p-6">
          <p>
            Waiting for {roomData.players[roomData.currentTurn]} to take their
            turn.
          </p>
        </Card>
      )}

      {selectingMate && isMyTurn && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-2">Select a Mate</h3>
            <div className="flex flex-wrap gap-2">
              {roomData.players
                .filter((p) => p !== localName)
                .map((p, index) => (
                  <Button
                    key={`mate-${p || "empty"}-${index}`}
                    onClick={() => chooseMate(p)}
                  >
                    {p}
                  </Button>
                ))}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
