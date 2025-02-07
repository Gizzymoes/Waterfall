// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

interface Card {
  card: string;
  action: string;
  description: string;
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

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [selectingMate, setSelectingMate] = useState(false);

  // Load player's name for reconnection.
  useEffect(() => {
    const name = localStorage.getItem("playerName");
    if (!name) {
      router.push("/lobby");
    } else {
      setLocalName(name);
    }
  }, [router]);

  // Subscribe to room updates.
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

  if (!roomData) {
    return <p>Loading room data...</p>;
  }

  const isMyTurn = localName === roomData.players[roomData.currentTurn];

  // Function to draw a card.
  const drawCard = async () => {
    if (!roomData.deck || roomData.deck.length === 0) {
      return alert("No more cards in the deck!");
    }
    if (!isMyTurn) {
      return alert("It's not your turn!");
    }
    const nextCard = roomData.deck[0];
    const roomRef = doc(db, "rooms", roomId);
    let updateData: any = {
      deck: roomData.deck.slice(1),
      currentCard: nextCard,
    };

    // Handle special actions.
    if (nextCard.action === "New Rule") {
      const ruleText = prompt("Enter your new rule:");
      if (ruleText) {
        updateData.currentRule = ruleText;
      }
    } else if (nextCard.action === "Mate") {
      // Trigger mate selection UI.
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

  // End turn normally.
  const endTurn = async () => {
    if (!isMyTurn) return;
    const roomRef = doc(db, "rooms", roomId);
    const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
    await updateDoc(roomRef, {
      currentCard: null,
      currentTurn: nextTurn,
    });
  };

  // Handle mate selection.
  const chooseMate = async (mateName: string) => {
    const roomRef = doc(db, "rooms", roomId);
    const updatedMates = { ...(roomData.mates || {}) };
    updatedMates[localName!] = mateName;
    await updateDoc(roomRef, {
      mates: updatedMates,
      currentCard: null,
    });
    setSelectingMate(false);
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
              {roomData.currentCard.card} - {roomData.currentCard.action}
            </strong>
            <p>{roomData.currentCard.description}</p>
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
