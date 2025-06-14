"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import LoadingScreen from "@/components/LoadingScreen";

const Card3D = dynamic(() => import("@/components/Card3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] md:h-[500px] flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-white"></div>
    </div>
  ),
});

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
  // Add the properties you are updating:
  players?: string[];
  currentTurn?: number;
  referee?: string | null;
  // Allow additional keys whose values can be one of these types:
  [key: string]:
    | CardType[]
    | CardType
    | null
    | string
    | boolean
    | number
    | string[]
    | undefined;
}

const shuffle = <T,>(array: T[]): T[] => array.sort(() => Math.random() - 0.5);

const cardMapping: {
  [key: string]: { action: string; description: string };
} = {
  Ace: {
    action: "Waterfall",
    description: "Drink continuously until you decide to stop.",
  },
  "2": { action: "Take a Drink", description: "Take two drinks." },
  "3": {
    action: "Give 3",
    description: "Choose someone to take three drinks.",
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

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [role, setRole] = useState<"player" | "referee" | "observer">("player");
  const [selectingMate, setSelectingMate] = useState(false);
  // New state for mate selection mode ("single" for drinking players, "pair" for referees)
  const [mateSelectionMode, setMateSelectionMode] = useState<"single" | "pair">(
    "single"
  );
  // New state for tracking selections in pair mode
  const [selectedMates, setSelectedMates] = useState<string[]>([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // State for the generic confirmation/input modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    description: string;
    inputLabel: string;
    inputValue: string;
    onConfirm: (value?: string) => void;
    confirmText: string;
    showInput: boolean;
    showPlayerSelect: boolean;
    playerSelectValue: string;
  }>({
    title: "",
    description: "",
    inputLabel: "",
    inputValue: "",
    onConfirm: () => {},
    confirmText: "Confirm",
    showInput: false,
    showPlayerSelect: false,
    playerSelectValue: "",
  });

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

  // Scroll to top when a violation occurs or game is paused.
  useEffect(() => {
    if (
      (roomData?.penaltyAnnouncement &&
        roomData.penaltyAnnouncement.trim() !== "") ||
      roomData?.isPaused
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [roomData?.penaltyAnnouncement, roomData?.isPaused]);

  const cardMessage = useMemo(() => {
    if (!roomData?.currentCard) return null;
    const { card, suit, drawnBy, description } = roomData.currentCard;
    const cardName = `${card} of ${suit}`;
    if (drawnBy === localName) {
      if (role === "referee") {
        // If the referee drew a mate card (card "6"), update the message accordingly.
        if (card === "6") {
          return `You drew ${cardName}. Choose two players to link as mates.`;
        }
        return `You drew ${cardName}. ${description}`;
      }
      switch (card) {
        case "Ace":
          return `You drew ${cardName}. Start the Waterfall—drink continuously until you decide to stop. Everyone must do the same.`;
        case "2":
          return `You drew ${cardName}. Take two drinks.`;
        case "3":
          return `You drew ${cardName}. Choose someone to take three drinks.`;
        case "4":
          return `You drew ${cardName}. PUT YOUR ARM UP. The last to do so drinks.`;
        case "5":
          return `You drew ${cardName}. Pick a category. Then go in room order starting with yourself.`;
        case "6":
          return `You drew ${cardName}. Choose someone to be your mate and to drink alongside you.`;
        case "7":
          return `You drew ${cardName}. You're now the Thumb Master.`;
        case "8":
          return `You drew ${cardName}. All the guys must take a drink.`;
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
          return `${drawnBy} drew ${cardName}. They've gotta drink twice.`;
        case "3":
          return `${drawnBy} drew ${cardName}. They choose someone to take three drinks.`;
        case "4":
          return `${drawnBy} drew ${cardName}. PUT YOUR ARM UP, last to do it has to drink.`;
        case "5":
          return `${drawnBy} drew ${cardName}. Categories time.`;
        case "6":
          return `${drawnBy} drew ${cardName} and is choosing a mate.`;
        case "7":
          return `${drawnBy} drew ${cardName} and is now the Thumb Master.`;
        case "8":
          return `${drawnBy} drew ${cardName}. All the guys must take a drink.`;
        case "9":
          return `${drawnBy} drew ${cardName}. It's pog sussy rhyme time. Going in room order, rhyme with the last sentence.`;
        case "10":
          return `${drawnBy} drew ${cardName} and is now the Question Master.`;
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
  }, [
    roomData?.currentCard,
    roomData?.currentRule,
    roomData?.referee,
    localName,
    role,
  ]);

  if (!roomData)
    return <p className="text-center py-10 text-lg">Loading room data...</p>;

  const gameIsPaused = roomData.isPaused;
  const isMyTurn = localName === roomData.players[roomData.currentTurn];
  const isSpectator = role === "observer";

  const drawCard = async () => {
    if (!roomData || !roomData.deck || roomData.deck.length === 0) return;
    if (isDrawing) return;
    if (isSpectator) return alert("Spectators cannot draw cards.");
    if (!isMyTurn) return alert("It's not your turn!");
    if (gameIsPaused) return alert("The game is currently paused.");

    setIsDrawing(true);

    // Simulate drawing card animation delay
    await new Promise((res) => setTimeout(res, 500));

    const nextCard: CardType = {
      ...roomData.deck[0],
      drawnBy: localName || "Unknown",
    };

    // Update Firestore
    const roomRef = doc(db, "rooms", roomId);

    if (nextCard.action === "New Rule") {
      await updateDoc(roomRef, {
        deck: roomData.deck.slice(1),
        currentCard: nextCard,
        thumbMaster: localName,
      });
      setModalContent({
        title: "Create a New Rule",
        description: "You drew a King! Enter a new rule for the game.",
        inputLabel: "New Rule",
        inputValue: "",
        onConfirm: async (ruleText) => {
          if (ruleText) {
            await updateDoc(roomRef, { currentRule: ruleText });
          }
        },
        confirmText: "Set Rule",
        showInput: true,
        showPlayerSelect: false,
        playerSelectValue: "",
      });
      setModalOpen(true);
    } else if (nextCard.action === "Mate") {
      // Set mate selection mode based on role.
      if (role === "referee") {
        setMateSelectionMode("pair");
      } else {
        setMateSelectionMode("single");
      }
      setSelectedMates([]);
      setSelectingMate(true);
      await updateDoc(roomRef, {
        deck: roomData.deck.slice(1),
        currentCard: nextCard,
      });
    } else if (nextCard.action === "Thumb") {
      await updateDoc(roomRef, {
        thumbMaster: localName,
      });
    } else if (nextCard.action === "Question Master") {
      await updateDoc(roomRef, {
        questionMaster: localName,
      });
    }
    await updateDoc(roomRef, {
      deck: roomData.deck.slice(1),
      currentCard: nextCard,
    });
    setIsDrawing(false);
  };

  // End turn function (used in normal cases)
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

  // Function for a player to leave the game voluntarily.
  const performLeaveGame = async () => {
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
      const updateData: UpdateData = {
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
      setIsLeaving(false); // Turn off loader on error
    }
  };

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false);
    // Wait for modal to close, then trigger loader + leave
    setTimeout(() => {
      setIsLeaving(true); // Show loader
      performLeaveGame(); // Perform actual leave logic
    }, 300); // Corresponds to animation duration
  };

  const handleLeaveGame = () => {
    setLeaveConfirmOpen(true);
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

  // Single mate selection for drinking players.
  const chooseMate = async (mateName: string) => {
    const roomRef = doc(db, "rooms", roomId);
    const updatedMates: { [key: string]: string } = {
      ...(roomData.mates ?? {}),
    };
    updatedMates[localName!] = mateName;
    const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
    await updateDoc(roomRef, {
      mates: updatedMates,
      currentCard: null,
      currentTurn: nextTurn,
    });
    setSelectingMate(false);
  };

  // For referee mate selection (pair mode): toggles selection of a player.
  const handleMatePairSelection = (playerName: string) => {
    if (selectedMates.includes(playerName)) {
      setSelectedMates(selectedMates.filter((name) => name !== playerName));
    } else {
      if (selectedMates.length < 2) {
        setSelectedMates([...selectedMates, playerName]);
      }
    }
  };

  // Confirm the pair selection: link the two chosen players as mates.
  const confirmMatePair = async () => {
    if (selectedMates.length !== 2) {
      alert("Please select exactly two players to link as mates.");
      return;
    }
    const roomRef = doc(db, "rooms", roomId);
    const updatedMates: { [key: string]: string } = {
      ...(roomData.mates ?? {}),
    };
    updatedMates[selectedMates[0]] = selectedMates[1];
    updatedMates[selectedMates[1]] = selectedMates[0];
    const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
    await updateDoc(roomRef, {
      mates: updatedMates,
      currentCard: null,
      currentTurn: nextTurn,
    });
    setSelectingMate(false);
  };

  const resetRound = async () => {
    setModalContent({
      title: "Reset Round",
      description:
        "This will reset the deck and all game states except for players. Are you sure?",
      onConfirm: async () => {
        if (!roomData || !roomId) return;
        await updateDoc(doc(db, "rooms", roomId), {
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
          currentTurn: 0,
        });
      },
      confirmText: "Reset",
      showInput: false,
      showPlayerSelect: false,
      inputLabel: "",
      inputValue: "",
      playerSelectValue: "",
    });
    setModalOpen(true);
  };

  const quitRoom = () => {
    setModalContent({
      title: "Quit Room",
      description: "Are you sure you want to end the game for everyone?",
      onConfirm: async () => {
        if (!roomId) return;
        await updateDoc(doc(db, "rooms", roomId), {
          players: [],
          deck: [],
        });
        router.push("/lobby");
      },
      confirmText: "Quit",
      showInput: false,
      showPlayerSelect: false,
      inputLabel: "",
      inputValue: "",
      playerSelectValue: "",
    });
    setModalOpen(true);
  };

  const markRuleViolation = async (playerName: string) => {
    if (!roomData?.penalties) return;
    const currentPenalties = roomData.penalties[playerName] || 0;
    await updateDoc(doc(db, "rooms", roomId), {
      [`penalties.${playerName}`]: currentPenalties + 1,
      penaltyAnnouncement: `${playerName} violated a rule! They now have ${
        currentPenalties + 1
      } penalty points.`,
    });
  };

  const pauseGame = async () => {
    setModalContent({
      title: "Pause Game",
      description: "Enter a reason for pausing the game.",
      inputLabel: "Reason for pausing",
      inputValue: "",
      onConfirm: async (reason) => {
        if (!reason || reason.trim() === "") return;
        await updateDoc(doc(db, "rooms", roomId), {
          isPaused: true,
          pauseReason: reason,
        });
      },
      confirmText: "Pause",
      showInput: true,
      showPlayerSelect: false,
      playerSelectValue: "",
    });
    setModalOpen(true);
  };

  const resumeGame = async () => {
    await updateDoc(doc(db, "rooms", roomId), {
      isPaused: false,
      pauseReason: "",
    });
  };

  const handleMarkViolation = () => {
    setModalContent({
      title: "Mark Violation",
      description: "Select a player to mark for a rule violation.",
      onConfirm: async (player) => {
        if (player) {
          markRuleViolation(player);
        }
      },
      confirmText: "Mark",
      showInput: false,
      showPlayerSelect: true,
      inputLabel: "",
      inputValue: "",
      playerSelectValue: roomData?.players[0] || "",
    });
    setModalOpen(true);
  };

  const handleRemovePlayer = () => {
    setModalContent({
      title: "Remove Player",
      description: "Select a player to remove from the game.",
      onConfirm: async (player) => {
        if (player) {
          removePlayer(player);
        }
      },
      confirmText: "Remove",
      showInput: false,
      showPlayerSelect: true,
      inputLabel: "",
      inputValue: "",
      playerSelectValue: roomData?.players[0] || "",
    });
    setModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-4 py-6 space-y-8"
    >
      {/* Header */}
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl font-bold text-center md:text-left"
      >
        Room: {roomId}
      </motion.h1>

      {/* Animated Alerts for Violation & Pause */}
      <div className="space-y-4">
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
                  className="border-2 border-red-600 shadow-lg"
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
                className="border-2 border-blue-600 shadow-lg"
              >
                <AlertTitle className="font-bold text-blue-700">
                  Game Paused:
                </AlertTitle>
                <AlertDescription>{roomData.pauseReason}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left Column: Players List & Penalty Points */}
        <div className="space-y-8">
          {/* Players List */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <Card className="p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Players</h2>
              <ul className="space-y-2">
                {roomData.players.map((player, index) => (
                  <li
                    key={`player-${player || "empty"}-${index}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center"
                  >
                    <span
                      className={`font-bold ${
                        player === roomData.referee ? "text-blue-600" : "white"
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
              {role !== "observer" && (
                <div className="mt-4">
                  <Button
                    variant="destructive"
                    onClick={handleLeaveGame}
                    className="w-full"
                  >
                    Leave Game
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Penalty Points */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <Card className="p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-2">Penalty Points</h2>
              {roomData.penalties &&
              Object.keys(roomData.penalties).length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(roomData.penalties).map(
                    ([player, points]) => (
                      <li key={`penalty-${player}`}>
                        {player}: {points} drink(s)
                      </li>
                    )
                  )}
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
        </div>

        {/* Right Column: Current Card, Game Controls & Cards Remaining */}
        <div className="space-y-8">
          {/* Current Card Section */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Card className="p-6 rounded-xl shadow-lg overflow-hidden">
              <h2 className="text-2xl font-bold mb-4">Current Card</h2>
              <div className="relative min-h-[400px] md:min-h-[500px]">
                <AnimatePresence>
                  {roomData.currentCard ? (
                    <motion.div
                      key="current-card"
                      layout
                      className="absolute inset-0 flex flex-col items-center justify-start space-y-4 p-4 pt-8"
                      initial={{ y: -30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 30, opacity: 0 }}
                    >
                      <Card3D
                        card={roomData.currentCard.card}
                        suit={roomData.currentCard.suit}
                      />
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-full px-4 text-center text-white"
                        >
                          <h3 className="text-2xl font-bold mb-2">
                            {roomData.currentCard.action}
                          </h3>
                          <p className="text-lg break-words max-w-full">
                            {cardMessage}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="no-card"
                      layout
                      className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <p className="mb-4 text-white/80">
                        Your card will appear here.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>

          {/* Game Controls */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center space-y-4"
          >
            {role === "observer" ? (
              <Card className="p-6 rounded-xl shadow-lg">
                <p>You are observing the game. You cannot take actions.</p>
              </Card>
            ) : gameIsPaused ? (
              <Card className="p-6 rounded-xl shadow-lg">
                <p>
                  Game is paused. Please wait for the referee to resume the
                  game.
                </p>
              </Card>
            ) : isMyTurn ? (
              <div className="flex flex-col items-center space-y-4 min-h-[44px]">
                <AnimatePresence mode="wait">
                  {!roomData.currentCard ? (
                    <motion.div
                      key="draw-card-btn"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <Button
                        onClick={drawCard}
                        disabled={isDrawing}
                        className="w-full md:w-auto"
                      >
                        {isDrawing ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            <span>Drawing...</span>
                          </div>
                        ) : (
                          "Draw Card"
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="end-turn-btn"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <Button onClick={endTurn} className="w-full md:w-auto">
                        End Turn
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="p-6 rounded-xl shadow-lg">
                <p>
                  Waiting for {roomData.players[roomData.currentTurn]} to take
                  their turn.
                </p>
              </Card>
            )}

            {roomData.deck.length === 0 && (
              <div className="flex flex-col md:flex-row items-center gap-4">
                <Button onClick={resetRound}>Reset Round</Button>
                <Button variant="destructive" onClick={quitRoom}>
                  Quit Room
                </Button>
              </div>
            )}
          </motion.div>

          {/* Cards Remaining Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-lg font-semibold">
              Cards Remaining: {roomData.deck.length}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Referee Controls */}
      {role === "referee" && (
        <AnimatePresence>
          <motion.div
            key="referee-controls"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <Card className="p-6 rounded-xl shadow-lg border border-white/20 bg-white/10 backdrop-blur-md text-white">
              <h3 className="text-2xl font-bold mb-4 text-white">
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
              <p className="mb-2 text-white/80">
                Mark a violation for a player (this assigns a penalty for the
                end of the game):
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  onClick={handleMarkViolation}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
                >
                  Mark Violation
                </Button>
              </div>

              <p className="mb-2 text-white/80">
                If a player has left, you can remove them from the game:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  onClick={handleRemovePlayer}
                  className="bg-red-700 hover:bg-red-800 text-white rounded-xl"
                >
                  Remove Player
                </Button>
              </div>

              <p className="mb-2 text-white/80">
                To start a fresh round with the same players, or if something
                has gone wrong, you can reset the round:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={resetRound}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
                >
                  Reset Round
                </Button>
                <Button
                  onClick={quitRoom}
                  className="bg-gray-700 hover:bg-gray-800 text-white rounded-xl"
                >
                  Quit Room
                </Button>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Current Rule */}
      {roomData.currentRule && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Card className="p-4 rounded-xl shadow-lg">
            <p>
              <strong>Current Rule:</strong> {roomData.currentRule}
            </p>
          </Card>
        </motion.div>
      )}

      {/* Selecting Mate Modal */}
      {selectingMate && isMyTurn && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Card className="p-6 rounded-xl shadow-lg">
            {mateSelectionMode === "pair" ? (
              <>
                <h3 className="text-xl font-semibold mb-2">
                  Select Two Players to Link as Mates
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roomData.players
                    .filter((p) => p !== localName)
                    .map((p, index) => {
                      const isSelected = selectedMates.includes(p);
                      return (
                        <Button
                          key={`mate-pair-${p || "empty"}-${index}`}
                          onClick={() => handleMatePairSelection(p)}
                          variant={isSelected ? "secondary" : "default"}
                          className={isSelected ? "ring-2 ring-blue-500" : ""}
                        >
                          {p}
                        </Button>
                      );
                    })}
                </div>
                {selectedMates.length === 2 && (
                  <div className="mt-4">
                    <Button onClick={confirmMatePair}>Confirm Mate Pair</Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-2">Select a Mate</h3>
                <div className="flex flex-wrap gap-2">
                  {roomData.players
                    .filter((p) => p !== localName)
                    .map((p, index) => (
                      <Button
                        key={`mate-single-${p || "empty"}-${index}`}
                        onClick={() => chooseMate(p)}
                      >
                        {p}
                      </Button>
                    ))}
                </div>
              </>
            )}
          </Card>
        </motion.div>
      )}

      <AnimatePresence>
        {leaveConfirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 0 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-sm p-6 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-2">Leave Game?</h2>
              <p className="mb-6 text-white/80">
                Are you sure you want to leave this room?
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLeaveConfirmOpen(false)}
                  className="bg-transparent hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleConfirmLeave}>
                  Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generic Referee Modal */}
      <AnimatePresence>
        {modalOpen && (
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
              <h2 className="text-2xl font-bold mb-2">{modalContent.title}</h2>
              <p className="mb-6 text-white/80">{modalContent.description}</p>

              {modalContent.showInput && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">
                    {modalContent.inputLabel}
                  </label>
                  <input
                    type="text"
                    value={modalContent.inputValue}
                    onChange={(e) =>
                      setModalContent((prev) => ({
                        ...prev,
                        inputValue: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {modalContent.showPlayerSelect && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">
                    Select Player
                  </label>
                  <select
                    value={modalContent.playerSelectValue}
                    onChange={(e) =>
                      setModalContent((prev) => ({
                        ...prev,
                        playerSelectValue: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {roomData?.players.map((p, index) => (
                      <option
                        key={`player-select-${p || "fallback"}-${index}`}
                        value={p}
                      >
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const valueToConfirm = modalContent.showPlayerSelect
                      ? modalContent.playerSelectValue
                      : modalContent.inputValue;
                    modalContent.onConfirm(valueToConfirm);
                    setModalOpen(false);
                  }}
                >
                  {modalContent.confirmText}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLeaving && <LoadingScreen message="Leaving game..." />}
    </motion.div>
  );
}
