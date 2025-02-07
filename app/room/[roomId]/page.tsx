// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import AnimatedCard from "@/components/AnimatedCard";
import { motion } from "framer-motion";

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
      "Who swore the most in your opinion? That person drinks!",
      "Who has been the most aggressive? That person takes a drink!",
      "Who took the longest to answer? They drink!",
      "Who needs a timeout? They must drink!",
    ],
    "3": [
      "Who owes you a compliment? That person drinks!",
      "Who is the class clown tonight? They take a drink!",
      "Who needs to lighten up? They drink!",
    ],
    Jack: [
      "Who had the worst dance moves? They drink!",
      "Who is the biggest chatterbox? They take a drink!",
    ],
    Queen: [
      "Who is the life of the party? They drink!",
      "Who told the worst joke? They take a sip!",
    ],
    "8": [
      "Who swore the most last round? They drink!",
      "Who acted the wildest? They drink!",
      "Who took too long to get ready? They drink!",
    ],
  };

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
      const ruleText = prompt("Enter your new rule:");
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
          return `You drew ${cardName}. Start the Waterfall—drink continuously until you decide to stop.`;
        case "2":
          return `You drew ${cardName}. You must take two sips.`;
        case "3":
          return `You drew ${cardName}. Choose someone to take three sips.`;
        case "4":
          return `You drew ${cardName}. Quick, put your arm up for Heaven—the last to do so drinks.`;
        case "5":
          return `You drew ${cardName}. Pick a category and get ready for the challenge!`;
        case "6":
          return `You drew ${cardName}. Choose someone to be your mate!`;
        case "7":
          return `You drew ${cardName}. You're now the Thumb Master—start raising your thumb!`;
        case "8":
          return `You drew ${cardName}. You must take a drink.`;
        case "9":
          return `You drew ${cardName}. Start the rhyme challenge—say a word, and everyone must follow.`;
        case "10":
          return `You drew ${cardName}. You're now the Question Master—start asking questions!`;
        case "Jack":
          return `You drew ${cardName}. You must take a drink.`;
        case "Queen":
          return `You drew ${cardName}. You must take a drink.`;
        case "King":
          return `You drew ${cardName} and created a new rule: ${
            roomData.currentRule || "No rule provided."
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
          return `${drawnBy} drew ${cardName}. Get ready—the Waterfall is starting!`;
        case "2":
          return `${drawnBy} drew ${cardName}. They must take two sips.`;
        case "3":
          return `${drawnBy} drew ${cardName}. They will choose someone to take three sips.`;
        case "4":
          return `${drawnBy} drew ${cardName}. Quick—watch as they put their arm up for Heaven!`;
        case "5":
          return `${drawnBy} drew ${cardName}. Prepare for a category challenge!`;
        case "6":
          return `${drawnBy} drew ${cardName} and is choosing a mate.`;
        case "7":
          return `${drawnBy} drew ${cardName} and is now the Thumb Master!`;
        case "8":
          return `${drawnBy} drew ${cardName}. They must take a drink.`;
        case "9":
          return `${drawnBy} drew ${cardName}. A rhyme challenge is on!`;
        case "10":
          return `${drawnBy} drew ${cardName} and is now the Question Master!`;
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

      {roomData.penaltyAnnouncement &&
        roomData.penaltyAnnouncement.trim() !== "" && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{roomData.penaltyAnnouncement}</AlertDescription>
          </Alert>
        )}

      {roomData.isPaused && (
        <Alert variant="default" className="mt-4">
          <AlertTitle>Game Paused:</AlertTitle>
          <AlertDescription>{roomData.pauseReason}</AlertDescription>
        </Alert>
      )}

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
                className={`flex items-center ${
                  roomData.currentTurn === index ? "font-bold" : ""
                } ${player === roomData.referee ? "text-primary" : ""}`}
              >
                {player}
                {roomData.currentTurn === index && (
                  <span className="ml-2">(Current Turn)</span>
                )}
                {player === roomData.referee && (
                  <span className="ml-2">[Referee]</span>
                )}
                {roomData.thumbMaster === player && (
                  <span className="ml-2">[Thumb Master]</span>
                )}
                {roomData.questionMaster === player && (
                  <span className="ml-2">[Question Master]</span>
                )}
                {roomData.mates && roomData.mates[player] && (
                  <span className="ml-2 text-sm">
                    (Mate: {roomData.mates[player]})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

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

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Current Card</h2>
          <div className="min-h-[500px] flex flex-col items-center justify-center">
            {roomData.currentCard ? (
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="space-y-4"
              >
                <AnimatedCard
                  card={roomData.currentCard.card}
                  suit={roomData.currentCard.suit}
                  className="mb-4"
                />
                <p className="text-center">{renderCardMessage()}</p>
              </motion.div>
            ) : (
              <div className="text-center text-muted">
                <p className="mb-4">Your card will appear here.</p>
                {isMyTurn && (
                  <Button onClick={drawCard} className="mx-auto">
                    Draw Card
                  </Button>
                )}
              </div>
            )}
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

      {role === "referee" && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card className="p-6">
            <h3 className="text-2xl font-bold mb-4">Referee Controls</h3>
            <div className="mb-4">
              {roomData.isPaused ? (
                <Button onClick={resumeGame} className="mb-2">
                  Resume Game
                </Button>
              ) : (
                <Button onClick={pauseGame} className="mb-2">
                  Pause Game
                </Button>
              )}
            </div>
            <p className="mb-2">
              Mark a violation for a player (this assigns a penalty for the end
              of the game):
            </p>
            <div className="space-y-2">
              {roomData.players
                .filter((p) => p !== roomData.referee)
                .map((p, index) => (
                  <div
                    key={`violation-${p || "empty"}-${index}`}
                    className="flex items-center space-x-4"
                  >
                    <span>{p}</span>
                    <Button size="sm" onClick={() => markRuleViolation(p)}>
                      Mark Violation
                    </Button>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
