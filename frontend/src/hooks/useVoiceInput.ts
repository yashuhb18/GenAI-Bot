"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported =
    typeof window !== "undefined" && "MediaRecorder" in window;

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const mimeType = audioBlob.type || "audio/webm";
      const result = await api.speechToText(base64, mimeType);

      if (result.text) {
        setTranscript(result.text);
      } else {
        setError("No speech detected. Try again.");
      }
    } catch (err: any) {
      const msg = err?.message || "Transcription failed";
      if (msg.includes("503") || msg.includes("Groq")) {
        setError("Voice input needs a free Groq API key. Get one at console.groq.com");
      } else {
        setError(msg);
      }
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    setError(null);
    setTranscript("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          await transcribeAudio(blob);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed. Check microphone permissions.");
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // collect data every 100ms
      setIsListening(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else {
        setError("Could not access microphone.");
      }
    }
  }, [isSupported, transcribeAudio]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return {
    isListening: isListening || isTranscribing,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
