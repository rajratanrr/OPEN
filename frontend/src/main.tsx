import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "@fontsource-variable/manrope";
import "@fontsource-variable/dm-sans";
import App from "./app/App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
if (
  import.meta.env.PROD &&
  !Capacitor.isNativePlatform() &&
  "serviceWorker" in navigator
)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline availability is optional; foreground queue remains available. */
    });
  });
