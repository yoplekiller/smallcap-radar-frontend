"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const FCM_TOKEN_KEY = "smallcap_fcm_token";

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

const isNative = Capacitor.isNativePlatform();

// ── FCM (Android 앱) ────────────────────────────────────────────────────────

async function fcmEnable(): Promise<boolean> {
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return false;

    await PushNotifications.register();

    return await new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        try {
          await fetch(`${API_URL}/push/fcm-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.value }),
          });
          localStorage.setItem(FCM_TOKEN_KEY, token.value);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
      PushNotifications.addListener("registrationError", () => resolve(false));
      setTimeout(() => resolve(false), 10000);
    });
  } catch {
    return false;
  }
}

async function fcmDisable(): Promise<void> {
  const token = localStorage.getItem(FCM_TOKEN_KEY);
  if (token) {
    await fetch(`${API_URL}/push/fcm-unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    localStorage.removeItem(FCM_TOKEN_KEY);
  }
  await PushNotifications.removeAllListeners();
}

// ── Web Push (브라우저 PWA) ──────────────────────────────────────────────────

async function webPushEnable(): Promise<boolean> {
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
    return true;
  } catch {
    return false;
  }
}

async function webPushDisable(): Promise<void> {
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
}

async function webPushIsOn(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function PushToggle() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (isNative) {
      const token = localStorage.getItem(FCM_TOKEN_KEY);
      setStatus(token ? "on" : "off");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    webPushIsOn().then((on) => setStatus(on ? "on" : "off"));
  }, []);

  useEffect(() => {
    if (!isNative && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function toggle() {
    if (status === "unsupported" || status === "denied" || status === "loading") return;

    setStatus("loading");

    if (status === "on") {
      if (isNative) {
        await fcmDisable();
      } else {
        await webPushDisable();
      }
      setStatus("off");
      return;
    }

    const ok = isNative ? await fcmEnable() : await webPushEnable();
    setStatus(ok ? "on" : "off");
  }

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
