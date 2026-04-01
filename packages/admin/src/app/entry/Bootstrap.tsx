import React from "react";
import ReactDOM from "react-dom/client";
import App from "@admin/app/entry/App";
import "@admin/app/styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
