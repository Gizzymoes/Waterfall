// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

// Add a suit property to the Card interface.
interface Card {
  card: string;
  suit: string;
  action: string;
  description: string;
  drawnBy?: string;
}

interface RoomData {
  players: string[];
  currentTurn: number;
  deck: Card[];
  currentCard: Card | null;
  thumbMaster: string | null;
  questionMaster: string | null;
  currentRule?: string;
  mates?: { [key: string]: string };
}

interface UpdateData {
  deck?: Card[];
  currentCard?: Card | null;
  currentRule?: string;
  thumbMaster?: string | null;
  questionMaster?: string | null;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [selectingMate, setSelectingMate] = useState(false);

  // Load the player's name for reconnection.
  useEffect(() => {
    const name = localStorage.getItem("playerName");
    if (!name) {
      router.push("/lobby");
    } else {
      setLocalName(name);
    }
  }, [router]);

  // Subscribe to real-time room updates.
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

  if (!roomData) return <p>Loading room data...</p>;

  const isMyTurn = localName === roomData.players[roomData.currentTurn];

  // --- Utility: Shuffle Function ---
  const shuffle = <T,>(array: T[]): T[] =>
    array.sort(() => Math.random() - 0.5);

  // --- Card Mapping (for deck regeneration) ---
  // Note: The mapping is based on rank only.
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

  // Generate a full 52-card deck with suits.
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

  // --- Game Actions ---

  const drawCard = async () => {
    if (!roomData.deck || roomData.deck.length === 0)
      return alert("No more cards in the deck!");
    if (!isMyTurn) return alert("It's not your turn!");
    const nextCard: Card = {
      ...roomData.deck[0],
      drawnBy: localName || "Unknown",
    };
    const roomRef = doc(db, "rooms", roomId);
    const updateData: UpdateData = {
      deck: roomData.deck.slice(1),
      currentCard: nextCard,
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
    const roomRef = doc(db, "rooms", roomId);
    const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
    await updateDoc(roomRef, { currentCard: null, currentTurn: nextTurn });
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
    router.push("/lobby");
  };

  // --- Rendering a Contextual Card Message ---
  const renderCardMessage = (): string | null => {
    if (!roomData.currentCard) return null;
    const { card, suit, drawnBy } = roomData.currentCard;
    const cardName = `${card} of ${suit}`;
    if (drawnBy === localName) {
      // Message for the player who drew the card.
      switch (card) {
        case "Ace":
          return `You drew ${cardName}. Start the Waterfall—drink continuously until you decide to stop.`;
        case "2":
          return `You drew ${cardName}. You must take two sips.`;
        case "3":
          return `You drew ${cardName}. Choose someone to take three sips.`;
        case "4":
          return `You drew ${cardName}. Quick, put your arm up for Heaven—the last to do so must drink.`;
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
          return `You drew ${cardName}. ${roomData.currentCard.description}`;
      }
    } else {
      // Message for other players.
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
          return `${drawnBy} drew ${cardName}. ${roomData.currentCard.description}`;
      }
    }
  };

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <h2>Players:</h2>
      <ul>
        {roomData.players.map((player, index) => (
          <li
            key={index}
            style={{
              fontWeight: roomData.currentTurn === index ? "bold" : "normal",
            }}
          >
            {player}
            {roomData.currentTurn === index && " ← (Current Turn)"}
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

        {selectingMate && isMyTurn ? (
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
      </div>
    </div>
  );
}
