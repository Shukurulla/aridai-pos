import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { AuthProvider } from "./auth";
import { ModalProvider } from "./modal";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </AuthProvider>
  </React.StrictMode>,
);
