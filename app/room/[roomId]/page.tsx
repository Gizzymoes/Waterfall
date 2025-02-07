// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

interface Card {
  card: string;
  action: string;
}

interface RoomData {
  players: string[];
  currentTurn: number;
  deck: Card[];
  currentCard: Card | null;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  // Load the player's name from localStorage to support reconnection
  useEffect(() => {
    const name = localStorage.getItem("playerName");
    if (!name) {
      // If the name is missing, redirect to the lobby
      router.push("/lobby");
    } else {
      setLocalName(name);
    }
  }, [router]);

  // Listen for real-time updates to the room document
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

  // Determine if it is the current player's turn
  const isMyTurn = localName === roomData.players[roomData.currentTurn];

  // Function to draw a card (allowed only if it's your turn and no card is drawn yet)
  const drawCard = async () => {
    if (!roomData.deck || roomData.deck.length === 0) {
      return alert("No more cards in the deck!");
    }
    if (!isMyTurn) {
      return alert("It's not your turn!");
    }
    const nextCard = roomData.deck[0];
    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        // Remove the drawn card from the deck and set it as the current card
        deck: roomData.deck.slice(1),
        currentCard: nextCard,
      });
    } catch (error) {
      console.error("Error drawing card:", error);
    }
  };

  // Function to end the turn (allowed only if it's your turn and a card has been drawn)
  const endTurn = async () => {
    if (!isMyTurn) return;
    try {
      const roomRef = doc(db, "rooms", roomId);
      // Advance the turn index, wrapping around to the first player if needed
      const nextTurn = (roomData.currentTurn + 1) % roomData.players.length;
      await updateDoc(roomRef, {
        currentCard: null,
        currentTurn: nextTurn,
      });
    } catch (error) {
      console.error("Error ending turn:", error);
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
            {player} {roomData.currentTurn === index && "← (Current Turn)"}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "2rem" }}>
        <h2>Current Card:</h2>
        {roomData.currentCard ? (
          <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            {roomData.currentCard.card} - {roomData.currentCard.action}
          </div>
        ) : (
          <p>No card drawn yet.</p>
        )}

        {isMyTurn ? (
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
