import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { ClientMessage, PublicRoomState, ServerMessage } from "./types";
import { getClientId, getSessionId } from "./storage";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

const partyHost = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

export function usePlanningPokerRoom(roomId: string, name: string) {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const socketRef = useRef<PartySocket | null>(null);

  const clientId = useMemo(() => getClientId(), []);
  const sessionId = useMemo(() => getSessionId(), []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!roomId || !name.trim()) return;

    setStatus("connecting");
    setError("");

    const socket = new PartySocket({
      host: partyHost,
      party: "main",
      room: roomId,
      id: sessionId,
      query: () => ({ clientId })
    });

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      socket.send(
        JSON.stringify({
          type: "join",
          clientId,
          name: name.trim()
        } satisfies ClientMessage)
      );
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
    });

    socket.addEventListener("error", () => {
      setError("Realtime connection failed.");
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string) as ServerMessage;

        if (payload.type === "state") {
          setState(payload.state);
          setError("");
        }

        if (payload.type === "error") {
          setError(payload.message);
        }
      } catch {
        setError("Received an unreadable realtime update.");
      }
    });

    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [clientId, name, roomId, sessionId]);

  return {
    clientId,
    state,
    status,
    error,
    send
  };
}
