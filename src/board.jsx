import React from "react";
import { createRoot } from "react-dom/client";
import { BoardApp } from "./canvas-board/board-app.jsx";
import "./canvas-board/board.css";

createRoot(document.getElementById("root")).render(<BoardApp />);
