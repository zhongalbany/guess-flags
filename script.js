const DATA_URL = "data/countries.json";
const APP_VERSION = "v1.0.3";
const STORAGE_KEYS = {
  stats: "guessFlags.stats",
  mistakes: "guessFlags.mistakes",
  settings: "guessFlags.settings",
  daily: "guessFlags.daily"
};

const screens = {
  home: document.getElementById("homeScreen"),
  game: document.getElementById("gameScreen"),
  stats: document.getElementById("statsScreen"),
  mistakes: document.getElementById("mistakesScreen")
};

const regionSelect = document.getElementById("regionSelect");
const chineseModeToggle = document.getElementById("chineseModeToggle");
const dailyButton = document.getElementById("dailyButton");
const dailyStatus = document.getElementById("dailyStatus");
const versionLabel = document.getElementById("versionLabel");
const flagDisplay = document.getElementById("flagDisplay");
const answerForm = document.getElementById("answerForm");
const answerInput = document.getElementById("answerInput");
const suggestions = document.getElementById("suggestions");
const submitButton = document.getElementById("submitButton");
const nextButton = document.getElementById("nextButton");
const studyPanel = document.getElementById("studyPanel");
const resultsPanel = document.getElementById("resultsPanel");
const resultText = document.getElementById("resultText");
const factCountry = document.getElementById("factCountry");
const factCapital = document.getElementById("factCapital");
const factContinent = document.getElementById("factContinent");
const finalScoreText = document.getElementById("finalScoreText");
const finalAccuracyText = document.getElementById("finalAccuracyText");
const scoreText = document.getElementById("scoreText");
const gameModeLabel = document.getElementById("gameModeLabel");
const statsContent = document.getElementById("statsContent");
const mistakesContent = document.getElementById("mistakesContent");
const practiceMistakesButton = document.getElementById("practiceMistakesButton");
const clearMistakesButton = document.getElementById("clearMistakesButton");

let countries = [];
let currentPool = [];
let currentCountry = null;
let gameMode = "normal";
let score = { correct: 0, attempted: 0 };
let hasAnsweredCurrentFlag = false;
let dailyIndex = 0;
let questionNumber = 0;

const emptyStats = {
  attempts: 0,
  correct: 0,
  currentStreak: 0,
  highestStreak: 0,
  byContinent: {}
};

let stats = loadFromStorage(STORAGE_KEYS.stats, emptyStats);
let mistakes = loadFromStorage(STORAGE_KEYS.mistakes, {});
let settings = loadFromStorage(STORAGE_KEYS.settings, { chineseMode: false });
let dailyScores = loadFromStorage(STORAGE_KEYS.daily, {});
let chineseMode = Boolean(settings.chineseMode);
chineseModeToggle.checked = chineseMode;
versionLabel.textContent = APP_VERSION;

function isChineseModeOn() {
  return chineseModeToggle.checked;
}

function loadFromStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || JSON.parse(JSON.stringify(fallback));
  } catch (error) {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function saveStats() {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}

function saveMistakes() {
  localStorage.setItem(STORAGE_KEYS.mistakes, JSON.stringify(mistakes));
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function saveDailyScores() {
  localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(dailyScores));
}

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u00c0-\u024f\u3400-\u9fff]+/g, " ")
    .trim();
}

function acceptedAnswers(country) {
  const answers = [country.name].concat(country.aliases || []);
  if (isChineseModeOn() && country.zh) answers.push(country.zh);
  return answers.map(normalizeAnswer);
}

function isCorrectAnswer(value, country) {
  return acceptedAnswers(country).includes(normalizeAnswer(value));
}

function showScreen(name) {
  Object.keys(screens).forEach((screenName) => {
    screens[screenName].classList.toggle("screen-active", screenName === name);
  });

  if (name === "home") renderDailyStatus();
  if (name === "stats") renderStats();
  if (name === "mistakes") renderMistakes();
}

function countriesForSelectedRegion() {
  const region = regionSelect.value;
  if (region === "All") return countries.slice();
  return countries.filter((country) => country.continent === region);
}

function shuffledCountries(list) {
  const shuffled = list.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

function startGame(mode) {
  gameMode = mode;
  const mistakeIds = Object.keys(mistakes);
  dailyIndex = 0;
  questionNumber = 0;

  if (mode === "daily") {
    currentPool = dailyCountries();
  } else {
    currentPool = mode === "mistakes"
      ? countries.filter((country) => mistakeIds.includes(country.code))
      : shuffledCountries(countriesForSelectedRegion());
  }

  if (!currentPool.length) {
    showScreen("mistakes");
    return;
  }

  score = { correct: 0, attempted: 0 };
  if (mode === "daily") {
    gameModeLabel.textContent = "Daily Challenge";
  } else {
    gameModeLabel.textContent = mode === "mistakes" ? "Mistakes practice" : `${regionSelect.value} countries`;
  }
  showScreen("game");
  nextQuestion();
}

function nextQuestion() {
  if (gameMode === "daily" && dailyIndex >= currentPool.length) {
    finishDailyChallenge();
    return;
  }

  if (gameMode === "normal" && questionNumber >= currentPool.length) {
    showNormalResults();
    return;
  }

  if (gameMode === "daily") {
    currentCountry = currentPool[dailyIndex++];
  } else if (gameMode === "normal") {
    currentCountry = currentPool[questionNumber];
  } else {
    currentCountry = currentPool[Math.floor(Math.random() * currentPool.length)];
  }

  questionNumber += 1;
  hasAnsweredCurrentFlag = false;
  flagDisplay.textContent = currentCountry.flag;
  answerInput.value = "";
  answerInput.disabled = false;
  submitButton.disabled = false;
  submitButton.hidden = false;
  suggestions.innerHTML = "";
  studyPanel.hidden = true;
  resultsPanel.hidden = true;
  nextButton.textContent = "Next";
  updateScore();
  window.setTimeout(() => answerInput.focus(), 80);
}

function updateScore() {
  const totalQuestions = currentPool.length || 0;
  const visibleQuestion = Math.min(questionNumber || 1, totalQuestions || 1);
  scoreText.innerHTML = `
    <span class="score-line">Question ${visibleQuestion} / ${totalQuestions}</span>
    <span class="score-line">Correct ${score.correct} / ${score.attempted}</span>
  `;
}

function submitAnswer(value) {
  if (!currentCountry || hasAnsweredCurrentFlag) return;

  const correct = isCorrectAnswer(value, currentCountry);
  hasAnsweredCurrentFlag = true;
  score.attempted += 1;
  stats.attempts += 1;

  if (!stats.byContinent[currentCountry.continent]) {
    stats.byContinent[currentCountry.continent] = { attempts: 0, correct: 0 };
  }
  stats.byContinent[currentCountry.continent].attempts += 1;

  if (correct) {
    score.correct += 1;
    stats.correct += 1;
    stats.currentStreak += 1;
    stats.highestStreak = Math.max(stats.highestStreak, stats.currentStreak);
    stats.byContinent[currentCountry.continent].correct += 1;
  } else {
    stats.currentStreak = 0;
    mistakes[currentCountry.code] = (mistakes[currentCountry.code] || 0) + 1;
  }

  saveStats();
  saveMistakes();
  showStudyMode(correct);
}

function showStudyMode(correct) {
  resultText.textContent = correct ? "Correct!" : "Not quite. Study this one.";
  resultText.className = `result-text ${correct ? "correct" : "wrong"}`;
  factCountry.textContent = isChineseModeOn() && currentCountry.zh
    ? `${currentCountry.zh} (${currentCountry.name})`
    : currentCountry.name;
  factCapital.textContent = currentCountry.capital;
  factContinent.textContent = currentCountry.continent;
  answerInput.disabled = true;
  submitButton.disabled = true;
  submitButton.hidden = true;
  suggestions.innerHTML = "";
  studyPanel.hidden = false;
  if (gameMode === "daily" && score.attempted >= currentPool.length) {
    saveDailyResult();
    nextButton.textContent = "Finish";
  }
  if (gameMode === "normal" && score.attempted >= currentPool.length) {
    nextButton.textContent = "See Results";
  }
  updateScore();
}

function showNormalResults() {
  currentCountry = null;
  hasAnsweredCurrentFlag = true;
  flagDisplay.textContent = "🏁";
  answerInput.value = "";
  answerInput.disabled = true;
  submitButton.disabled = true;
  submitButton.hidden = true;
  suggestions.innerHTML = "";
  studyPanel.hidden = true;
  resultsPanel.hidden = false;
  finalScoreText.textContent = `${score.correct} / ${score.attempted}`;
  finalAccuracyText.textContent = accuracy(score.correct, score.attempted);
  updateScore();
}

function renderSuggestions() {
  const query = normalizeAnswer(answerInput.value);
  suggestions.innerHTML = "";
  if (!query) return;

  suggestionPool()
    .map((country) => ({ country, rank: suggestionRank(country, query) }))
    .filter((match) => match.rank < 99)
    .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name))
    .slice(0, 10)
    .forEach((match) => {
      const country = match.country;
      const button = document.createElement("button");
      button.className = "suggestion";
      button.type = "button";
      button.setAttribute("role", "option");
      button.textContent = displayCountryName(country);
      button.addEventListener("click", () => submitAnswer(isChineseModeOn() && country.zh ? country.zh : country.name));
      suggestions.appendChild(button);
    });
}

function suggestionNames(country) {
  const names = [country.name].concat(country.aliases || []);
  if (country.zh) names.push(country.zh);
  return names;
}

function suggestionRank(country, query) {
  const names = suggestionNames(country).map(normalizeAnswer);
  if (names.some((name) => name === query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => name.split(" ").some((part) => part.startsWith(query)))) return 2;
  if (names.some((name) => name.includes(query))) return 3;
  return 99;
}

function suggestionPool() {
  if (screens.game.classList.contains("screen-active") && currentPool.length) {
    return currentPool;
  }
  return countriesForSelectedRegion();
}

function displayCountryName(country) {
  if (isChineseModeOn() && country.zh) return `${country.zh} (${country.name})`;
  return country.name;
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function seededNumber(seedText) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return seed || 1;
}

function randomFromSeed(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function dailyCountries() {
  const random = randomFromSeed(seededNumber(todayKey()));
  const list = countries.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }
  return list.slice(0, 20);
}

function saveDailyResult() {
  dailyScores[todayKey()] = {
    correct: score.correct,
    attempted: score.attempted,
    completed: true
  };
  saveDailyScores();
  renderDailyStatus();
}

function finishDailyChallenge() {
  saveDailyResult();
  showScreen("home");
}

function renderDailyStatus() {
  const result = dailyScores[todayKey()];
  if (!result || !result.completed) {
    dailyStatus.hidden = true;
    dailyStatus.textContent = "";
    dailyButton.textContent = "Daily Challenge";
    return;
  }

  dailyStatus.hidden = false;
  dailyStatus.textContent = `Today's Daily Challenge: ${result.correct} / ${result.attempted}. Replay anytime.`;
  dailyButton.textContent = "Replay Daily Challenge";
}

function accuracy(correct, attempts) {
  if (!attempts) return "0%";
  return `${Math.round((correct / attempts) * 100)}%`;
}

function panelItem(label, value) {
  const item = document.createElement("div");
  item.className = "panel-item";
  item.innerHTML = `<span class="panel-label">${label}</span><span class="panel-value">${value}</span>`;
  return item;
}

function renderStats() {
  statsContent.innerHTML = "";
  statsContent.appendChild(panelItem("Total accuracy", accuracy(stats.correct, stats.attempts)));
  statsContent.appendChild(panelItem("Highest streak", stats.highestStreak));

  ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"].forEach((continent) => {
    const row = stats.byContinent[continent] || { attempts: 0, correct: 0 };
    statsContent.appendChild(panelItem(continent, accuracy(row.correct, row.attempts)));
  });
}

function renderMistakes() {
  mistakesContent.innerHTML = "";
  const mistakeCountries = countries
    .filter((country) => mistakes[country.code])
    .sort((a, b) => a.name.localeCompare(b.name));

  practiceMistakesButton.disabled = mistakeCountries.length === 0;
  clearMistakesButton.disabled = mistakeCountries.length === 0;

  if (!mistakeCountries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No mistakes yet!";
    mistakesContent.appendChild(empty);
    return;
  }

  mistakeCountries.forEach((country) => {
    mistakesContent.appendChild(panelItem(`${country.flag} ${country.name}`, `${mistakes[country.code]} miss${mistakes[country.code] === 1 ? "" : "es"}`));
  });
}

document.getElementById("startButton").addEventListener("click", () => startGame("normal"));
dailyButton.addEventListener("click", () => startGame("daily"));
document.getElementById("statsButton").addEventListener("click", () => showScreen("stats"));
document.getElementById("mistakesButton").addEventListener("click", () => showScreen("mistakes"));
document.getElementById("homeButton").addEventListener("click", () => showScreen("home"));
document.querySelectorAll(".back-home").forEach((button) => {
  button.addEventListener("click", () => showScreen("home"));
});

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAnswer(answerInput.value);
});

answerInput.addEventListener("input", renderSuggestions);
nextButton.addEventListener("click", nextQuestion);
document.getElementById("playAgainButton").addEventListener("click", () => startGame("normal"));
document.getElementById("resultsHomeButton").addEventListener("click", () => showScreen("home"));
practiceMistakesButton.addEventListener("click", () => startGame("mistakes"));
chineseModeToggle.addEventListener("change", () => {
  chineseMode = chineseModeToggle.checked;
  settings.chineseMode = chineseMode;
  saveSettings();
});
clearMistakesButton.addEventListener("click", () => {
  mistakes = {};
  saveMistakes();
  renderMistakes();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
  });
}

fetch(DATA_URL)
  .then((response) => response.json())
  .then((data) => {
    countries = data;
    renderDailyStatus();
  })
  .catch(() => {
    document.querySelector(".hero p").textContent = "Country data could not load.";
  });
