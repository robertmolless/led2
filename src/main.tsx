import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Регистрация service worker'а. Используем относительный путь, чтобы корректно
// работать под любым base path (например /led-screen-builder/ на GitHub Pages).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // import.meta.env.BASE_URL уже содержит / в конце, например "/led-screen-builder/".
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
