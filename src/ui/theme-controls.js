const THEME_STORAGE_KEY = "themeMode";

function getSystemThemeMode(windowRef = window) {
  if (
    typeof windowRef !== "undefined" &&
    typeof windowRef.matchMedia === "function"
  ) {
    return windowRef.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

function getResolvedThemeMode(mode, windowRef = window) {
  if (mode === "system") {
    return getSystemThemeMode(windowRef);
  }

  return mode === "dark" ? "dark" : "light";
}

export function getSavedThemeMode(storage = localStorage) {
  return storage.getItem(THEME_STORAGE_KEY) || "system";
}

export function applyThemeMode(
  mode,
  appState,
  { storage = localStorage, documentRef = document, windowRef = window } = {},
) {
  const storedMode =
    mode === "dark" || mode === "light" || mode === "system" ? mode : "system";

  const resolvedMode = getResolvedThemeMode(storedMode, windowRef);

  appState.themeMode = storedMode;

  if (typeof documentRef !== "undefined") {
    documentRef.body.classList.toggle("dark-mode", resolvedMode === "dark");
  }

  storage.setItem(THEME_STORAGE_KEY, storedMode);
}

export function setupSystemThemeChangeListener(
  appState,
  onSystemThemeChange,
  windowRef = window,
) {
  if (
    typeof windowRef === "undefined" ||
    typeof windowRef.matchMedia !== "function"
  ) {
    return () => {};
  }

  const themeMediaQuery = windowRef.matchMedia("(prefers-color-scheme: dark)");

  const handleSystemThemeChange = () => {
    if (appState.themeMode === "system") {
      onSystemThemeChange();
    }
  };

  if (typeof themeMediaQuery.addEventListener === "function") {
    themeMediaQuery.addEventListener("change", handleSystemThemeChange);

    return () =>
      themeMediaQuery.removeEventListener("change", handleSystemThemeChange);
  }

  if (typeof themeMediaQuery.addListener === "function") {
    themeMediaQuery.addListener(handleSystemThemeChange);

    return () => themeMediaQuery.removeListener(handleSystemThemeChange);
  }

  return () => {};
}
