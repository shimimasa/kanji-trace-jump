// src/main.js
import "./style.css";
import { ScreenManager } from "./screens/ScreenManager.js";
import { loadProgress } from "./lib/progressStore.js";

import { HomeScreen } from "./screens/HomeScreen.js";
import { RangeSelectScreen } from "./screens/RangeSelectScreen.js";
import { GameScreen } from "./screens/GameScreen.js";
import { ResultScreen } from "./screens/ResultScreen.js";
import { ProgressScreen } from "./screens/ProgressScreen.js";
import { TitleBookScreen } from "./screens/TitleBookScreen.js";
import { KanjiDexScreen } from "./screens/KanjiDexScreen.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app が見つかりません");

const nav = new ScreenManager(root, {
  progress: loadProgress(),
  selectedRangeId: "kanji_g1",
});

nav.register("home", HomeScreen);
nav.register("rangeSelect", RangeSelectScreen);
nav.register("game", GameScreen);
nav.register("result", ResultScreen);
nav.register("progress", ProgressScreen);
nav.register("titleBook", TitleBookScreen);
nav.register("dex", KanjiDexScreen);
nav.go("home");
