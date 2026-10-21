import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/martian-mono/latin-300.css";
// 400/500 are the full sets (latin, latin-ext, cyrillic / vietnamese): the
// browser fetches a subset only when a character from it is on screen, so
// names like Łódź or Москва stay in the font. 300 is the big numerals only.
import "@fontsource/martian-mono/400.css";
import "@fontsource/martian-mono/500.css";
import "@fontsource/mona-sans/400.css";
import "@fontsource/mona-sans/500.css";
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
