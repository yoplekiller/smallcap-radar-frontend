"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

type Status = "unsupported" | "denied" | "off" | "on" | "loading";

export default function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    });
  }, []);

  async function toggle() {
    if (status === "unsupported" || status === "denied") return;

    if (status === "on") {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      return;
    }

    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch(`${API_URL}/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      await fetch(`${API_URL}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {}
  }

  useEffect(() => {
    registerSW();
  }, []);

  if (status === "unsupported") return null;

  return (
    <button
      onClick={toggle}
      title={
        status === "on"
          ? "알림 끄기"
          : status === "denied"
          ? "브라우저에서 알림을 허용해주세요"
          : "세력 포착 푸시 알림 켜기"
      }
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
        status === "on"
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : status === "loading"
          ? "bg-gray-700 text-gray-400 cursor-wait"
          : status === "denied"
          ? "bg-gray-800 text-gray-500 cursor-not-allowed"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
      }`}
    >
      {status === "loading" ? (
        <span className="animate-pulse">...</span>
      ) : (
        <>
          <span>{status === "on" ? "🔔" : "🔕"}</span>
          <span>{status === "on" ? "알림 ON" : "알림 OFF"}</span>
        </>
      )}
    </button>
  );
}
