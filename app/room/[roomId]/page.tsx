"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

interface Card {
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
  deck: Card[];
  currentCard: Card | null;
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
  deck?: Card[];
  currentCard?: Card | null;
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

  function generateDeck(): Card[] {
    const deck: Card[] = [];
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
    const nextCard: Card = {
      ...roomData.deck[0],
      drawnBy: localName || "Unknown",
    };

    // If a referee draws one of the drink-forcing cards, generate a fun message automatically.
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

  // --- Rendering a Contextual Card Message ---
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
          return `You drew ${cardName}. You're now the Thumb Master—raise your thumb whenever!`;
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
          return `You drew ${cardName}. Create a new rule for the game.`;
        default:
          return `You drew ${cardName}. ${description}`;
      }
    } else {
      // For other players observing the card.
      if (
        drawnBy === roomData.referee &&
        ["2", "3", "Jack", "Queen", "8"].includes(card)
      ) {
        return `${drawnBy} is the referee. She drew ${cardName} and was asked: "${description}". Whoever she selects must drink for her.`;
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
    <div>
      <h1>Room: {roomId}</h1>

      {/* Global Penalty Announcement Banner */}
      {roomData.penaltyAnnouncement &&
        roomData.penaltyAnnouncement.trim() !== "" && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              backgroundColor: "#ffeeba",
              border: "1px solid #f5c842",
            }}
          >
            <strong>{roomData.penaltyAnnouncement}</strong>
          </div>
        )}

      {/* Game Pause Banner */}
      {roomData.isPaused && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#d1ecf1",
            border: "1px solid #bee5eb",
          }}
        >
          <strong>Game Paused:</strong> {roomData.pauseReason}
        </div>
      )}

      <h2>Players:</h2>
      <ul>
        {roomData.players.map((player, index) => (
          <li
            key={index}
            style={{
              fontWeight: roomData.currentTurn === index ? "bold" : "normal",
              color: player === roomData.referee ? "purple" : "inherit",
            }}
          >
            {player}
            {roomData.currentTurn === index && " ← (Current Turn)"}
            {player === roomData.referee && " [Referee]"}
            {roomData.thumbMaster === player && " [Thumb Master]"}
            {roomData.questionMaster === player && " [Question Master]"}
            {roomData.mates && roomData.mates[player] && (
              <span style={{ fontSize: "0.8rem" }}>
                {" "}
                (Mate: {roomData.mates[player]})
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Global Penalty Points Panel */}
      {roomData.penalties && Object.keys(roomData.penalties).length > 0 && (
        <div
          style={{
            marginTop: "1rem",
            border: "1px solid red",
            padding: "0.5rem",
          }}
        >
          <h3>Penalty Points</h3>
          <ul>
            {Object.entries(roomData.penalties).map(([player, points]) => (
              <li key={player}>
                {player}: {points} drink(s)
              </li>
            ))}
          </ul>
          {roomData.deck.length === 0 && (
            <p>
              <em>Last card! Please finish your penalty drinks.</em>
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <p>Cards left: {roomData.deck.length}</p>
      </div>

      {roomData.deck.length === 0 && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            border: "1px solid black",
          }}
        >
          <p>The deck is empty.</p>
          <button onClick={resetRound} style={{ marginRight: "1rem" }}>
            Reset Round
          </button>
          <button onClick={quitRoom}>Quit Room</button>
        </div>
      )}

      {roomData.currentRule && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.5rem",
            border: "1px solid black",
          }}
        >
          <strong>Current Rule:</strong> {roomData.currentRule}
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <h2>Current Card:</h2>
        {roomData.currentCard ? (
          <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            <strong>
              {roomData.currentCard.card} of {roomData.currentCard.suit} -{" "}
              {roomData.currentCard.action}
            </strong>
            <p>{renderCardMessage()}</p>
          </div>
        ) : (
          <p>No card drawn yet.</p>
        )}

        {role === "observer" ? (
          <p>You are observing the game. You cannot take actions.</p>
        ) : gameIsPaused ? (
          <p>Game is paused. Please wait for the referee to resume the game.</p>
        ) : isMyTurn ? (
          <div>
            {!roomData.currentCard ? (
              <button onClick={drawCard}>Draw Card</button>
            ) : (
              <button onClick={endTurn}>End Turn</button>
            )}
          </div>
        ) : (
          <p>
            Waiting for {roomData.players[roomData.currentTurn]} to take their
            turn.
          </p>
        )}

        {selectingMate && isMyTurn && (
          <div>
            <p>Select a mate:</p>
            {roomData.players
              .filter((p) => p !== localName)
              .map((p, index) => (
                <button
                  key={index}
                  onClick={() => chooseMate(p)}
                  style={{ marginRight: "0.5rem" }}
                >
                  {p}
                </button>
              ))}
          </div>
        )}
      </div>

      {role === "referee" && (
        <div
          style={{
            marginTop: "2rem",
            border: "1px solid #ccc",
            padding: "1rem",
          }}
        >
          <h3>Referee Controls</h3>
          {roomData.isPaused ? (
            <button onClick={resumeGame} style={{ marginBottom: "1rem" }}>
              Resume Game
            </button>
          ) : (
            <button onClick={pauseGame} style={{ marginBottom: "1rem" }}>
              Pause Game
            </button>
          )}
          <p>
            Mark a violation for a player (this assigns a penalty for the end of
            the game):
          </p>
          {roomData.players
            .filter((p) => p !== roomData.referee)
            .map((p, index) => (
              <div key={index} style={{ marginBottom: "0.5rem" }}>
                <span style={{ marginRight: "1rem" }}>{p}</span>
                <button onClick={() => markRuleViolation(p)}>
                  Mark Violation
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
