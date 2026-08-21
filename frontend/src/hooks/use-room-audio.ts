import { useEffect, useRef } from "react";

import { RoomMember } from "@/src/utils/api";
import { audioSession } from "@/src/utils/incall";
import { RTC_CONFIG, getRTC, webrtcAvailable } from "@/src/utils/webrtc";

interface RoomAudioParams {
  roomId: string;
  myId: string;
  members: RoomMember[];
  sendSignal: (data: Record<string, unknown>) => void;
  subscribe: (fn: (event: any) => void) => () => void;
}

/**
 * Full-mesh WebRTC audio for a voice room (web + native builds).
 * Speakers publish their mic; everyone receives. Deterministic initiator
 * (greater id offers) avoids glare. Mic toggle enables/disables the track.
 * ICE candidates are buffered per-peer until the remote description is set,
 * and failed connections are automatically re-initiated.
 */
export function useRoomAudio({
  roomId,
  myId,
  members,
  sendSignal,
  subscribe,
}: RoomAudioParams) {
  const peersRef = useRef<Map<string, any>>(new Map());
  const audioElsRef = useRef<Map<string, any>>(new Map());
  const pendingIceRef = useRef<Map<string, any[]>>(new Map());
  const localStreamRef = useRef<any>(null);
  const me = members.find((m) => m.id === myId);
  const iSpeak = !!me && (me.role === "host" || me.role === "speaker");
  const micOn = !!me?.mic_on;
  const iSpeakRef = useRef(iSpeak);

  // Keep local track enabled state in sync with mic_on
  useEffect(() => {
    localStreamRef.current?.getAudioTracks?.().forEach((t: any) => {
      t.enabled = micOn;
    });
  }, [micOn]);

  // Rebuild mesh when my speaking capability changes. Peers I initiate to
  // (smaller ids) are re-created by the membership effect below; peers that
  // initiate to ME (bigger ids) don't know my connection changed, so we ask
  // them to restart their side via an "rtc_restart" signal.
  useEffect(() => {
    if (!webrtcAvailable()) return;
    if (iSpeakRef.current !== iSpeak) {
      iSpeakRef.current = iSpeak;
      // Demoted to listener → release the mic entirely.
      if (!iSpeak) {
        localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
        localStreamRef.current = null;
      }
      closeAllPeers();
      members
        .filter((m) => m.id !== myId && m.id > myId)
        .forEach((m) => {
          sendSignal({ type: "rtc_restart", to: m.id, room_id: roomId });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iSpeak]);

  const closePeer = (peerId: string) => {
    peersRef.current.get(peerId)?.close?.();
    peersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    const el = audioElsRef.current.get(peerId);
    if (el && typeof el === "object" && "srcObject" in el) {
      el.srcObject = null;
    }
    audioElsRef.current.delete(peerId);
  };

  const closeAllPeers = () => {
    for (const id of Array.from(peersRef.current.keys())) closePeer(id);
  };

  const ensureLocalStream = async () => {
    if (!iSpeakRef.current) return null;
    if (!localStreamRef.current) {
      try {
        const rtc = getRTC();
        if (!rtc) return null;
        localStreamRef.current = await rtc.mediaDevices.getUserMedia({
          audio: true,
        });
        localStreamRef.current.getAudioTracks().forEach((t: any) => {
          t.enabled = micOn;
        });
      } catch {
        return null;
      }
    }
    return localStreamRef.current;
  };

  const flushIce = async (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.set(peerId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // stale candidate; ignore
      }
    }
  };

  const initiateTo = async (peerId: string) => {
    try {
      const pc = await createPeer(peerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      sendSignal({ type: "rtc_offer", to: peerId, room_id: roomId, sdp: offer });
    } catch {
      closePeer(peerId);
    }
  };

  const createPeer = async (peerId: string) => {
    const rtc = getRTC();
    if (!rtc) throw new Error("webrtc-unavailable");
    const pc = new rtc.PC(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    const stream = await ensureLocalStream();
    if (stream) {
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
    } else {
      // Listener: explicitly request a receive-only audio m-line so the offer
      // always contains audio (offerToReceiveAudio alone is unreliable on
      // native unified-plan builds).
      try {
        pc.addTransceiver?.("audio", { direction: "recvonly" });
      } catch {
        // older implementation — legacy offerToReceiveAudio still applies
      }
    }
    pc.onicecandidate = (e: any) => {
      if (e.candidate) {
        sendSignal({
          type: "rtc_ice",
          to: peerId,
          room_id: roomId,
          candidate: e.candidate,
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // Recover: tear down and re-offer if I'm the initiator.
        closePeer(peerId);
        if (myId > peerId) initiateTo(peerId);
      }
    };
    pc.ontrack = (e: any) => {
      if (rtc.native) {
        // react-native-webrtc plays remote audio tracks automatically.
        audioElsRef.current.set(peerId, e.streams?.[0] || null);
      } else {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        audioElsRef.current.set(peerId, audio);
      }
    };
    return pc;
  };

  // Connect/disconnect peers as membership changes
  useEffect(() => {
    if (!webrtcAvailable() || !me) return;
    const otherIds = new Set(
      members.filter((m) => m.id !== myId).map((m) => m.id),
    );
    // close departed
    for (const id of Array.from(peersRef.current.keys())) {
      if (!otherIds.has(id)) closePeer(id);
    }
    // initiate to new peers when I'm the designated initiator
    otherIds.forEach(async (peerId) => {
      if (peersRef.current.has(peerId)) return;
      if (myId > peerId) {
        await initiateTo(peerId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, myId, me?.role]);

  // Handle signaling
  useEffect(() => {
    if (!webrtcAvailable()) return;
    const unsub = subscribe(async (event: any) => {
      if (event.room_id !== roomId) return;
      const from = event.from;
      try {
        if (event.type === "rtc_offer") {
          closePeer(from);
          const pc = await createPeer(from);
          await pc.setRemoteDescription(event.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await flushIce(from);
          sendSignal({
            type: "rtc_answer",
            to: from,
            room_id: roomId,
            sdp: answer,
          });
        } else if (event.type === "rtc_answer") {
          await peersRef.current.get(from)?.setRemoteDescription(event.sdp);
          await flushIce(from);
        } else if (event.type === "rtc_ice") {
          if (event.candidate) {
            const queue = pendingIceRef.current.get(from) || [];
            queue.push(event.candidate);
            pendingIceRef.current.set(from, queue);
            await flushIce(from);
          }
        } else if (event.type === "rtc_restart") {
          // Peer's media setup changed (e.g. promoted to speaker) — tear down
          // and re-offer if I'm the designated initiator for this pair.
          closePeer(from);
          if (myId > from) await initiateTo(from);
        }
      } catch {
        // signaling race; peer will retry on next membership change
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, subscribe]);

  // Native audio session: route voice-room audio to the loudspeaker for the
  // whole life of the room session (no-op on web / Expo Go).
  useEffect(() => {
    const rtc = getRTC();
    if (!rtc?.native) return;
    audioSession.start(true);
    return () => audioSession.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAllPeers();
      localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { audioActive: webrtcAvailable() };
}
