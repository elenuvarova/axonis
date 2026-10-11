import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/martian-mono/latin-300.css";
import "@fontsource/martian-mono/latin-400.css";
import "@fontsource/martian-mono/latin-500.css";
import "@fontsource/mona-sans/latin-400.css";
import "@fontsource/mona-sans/latin-500.css";
import App from "./App.jsx";
import { initConsent } from "./consent";
import { startTypography } from "./typography";
import "./styles.css";

// B² is dark by definition; there is no light palette in this pass.
document.documentElement.setAttribute("data-theme", "dark");

initConsent();
startTypography();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
