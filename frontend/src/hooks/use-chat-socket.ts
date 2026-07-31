import { useEffect, useRef } from "react";

import { getAuthToken, wsUrl } from "@/src/utils/api";

export interface ChatEvent {
  type: string;
  conversation_id?: string;
  ids?: unknown;
  message?: {
    id: string;
    conversation_id: string;
    sender_id: string;
    text: string;
    created_at: string;
  };
}

/** Connects to the chat WebSocket while mounted; reconnects on drops. */
export function useChatSocket(onEvent: (event: ChatEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!getAuthToken()) return;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(wsUrl());
      ws.onmessage = (e) => {
        try {
          handlerRef.current(JSON.parse(e.data));
        } catch {
          // ignore malformed events
        }
      };
      ws.onclose = () => {
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);
}
