import { useState, useEffect } from "react";

const GIS_URL = "https://accounts.google.com/gsi/client";
let scriptPromise = null;

export function useGoogleIdentityServices() {
  const [ready, setReady] = useState(
    () => !!(window.google && window.google.accounts && window.google.accounts.oauth2)
  );

  useEffect(() => {
    if (ready) return;

    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GIS_URL}"]`);
        if (existing) {
          existing.addEventListener("load", resolve);
          existing.addEventListener("error", reject);
          return;
        }
        const script = document.createElement("script");
        script.src = GIS_URL;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    scriptPromise
      .then(() => setReady(true))
      .catch(() => console.error("Failed to load Google Identity Services."));
  }, [ready]);

  return ready;
}
