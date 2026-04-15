const SESSION_KEYS = {
  authPasswordType: "authPasswordType",
  currentUser: "currentUser",
  userRole: "userRole",
  isLoggedIn: "isLoggedIn",
};

export function getAuthPasswordType(storage = localStorage) {
  return (storage.getItem(SESSION_KEYS.authPasswordType) || "")
    .toLowerCase()
    .trim();
}

export function hasAdminPasswordAccess(storage = localStorage) {
  return getAuthPasswordType(storage) === "admin";
}

export function isStakePasswordSession(storage = localStorage) {
  return getAuthPasswordType(storage) === "stake";
}

export function getCurrentUserName(storage = localStorage) {
  return storage.getItem(SESSION_KEYS.currentUser) || "";
}

export function isLoggedInSession(storage = localStorage) {
  return storage.getItem(SESSION_KEYS.isLoggedIn) === "true";
}

export function getRequiredPasswordType(sharedPasswordType) {
  const normalizedType = String(sharedPasswordType || "")
    .toLowerCase()
    .trim();

  return normalizedType === "admin" ? "admin" : "stake";
}

export function setSessionAfterLogin(
  { userName, userRole, passwordType },
  storage = localStorage,
) {
  storage.setItem(SESSION_KEYS.isLoggedIn, "true");
  storage.setItem(SESSION_KEYS.currentUser, userName);
  storage.setItem(SESSION_KEYS.userRole, userRole);
  storage.setItem(SESSION_KEYS.authPasswordType, passwordType);
}
