import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";   // ✅ 여기
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>                                 // ✅ 여기
      <App />
    </HashRouter>
  </React.StrictMode>
);