const SESSION_KEYS = {
  authPasswordType: "authPasswordType",
  currentUser: "currentUser",
  userRole: "userRole",
  isLoggedIn: "isLoggedIn",
  loginTime: "loginTime",
};

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function clearSession(storage = localStorage) {
  Object.values(SESSION_KEYS).forEach((key) => storage.removeItem(key));
}

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
  if (storage.getItem(SESSION_KEYS.isLoggedIn) !== "true") return false;

  const loginTime = parseInt(
    storage.getItem(SESSION_KEYS.loginTime) || "0",
    10,
  );
  if (!loginTime || Date.now() - loginTime > SESSION_DURATION_MS) {
    clearSession(storage);
    return false;
  }

  return true;
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
  storage.setItem(SESSION_KEYS.loginTime, Date.now().toString());
}
