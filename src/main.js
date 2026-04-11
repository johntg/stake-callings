import "./style.css";
import { createClient } from "@supabase/supabase-js";

// 1. DATABASE SETUP
const supabaseUrl = "https://orhcmllshkgqdektxshs.supabase.co";
const supabaseKey = "sb_publishable_1dTR4wmkKA4KPLqMa-tYaw_0GbMx41P";
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. APP STATE
const appState = {
  callings: [],
  members: [], // We now store the full member object (name, role, password_type)
  assignableNames: [],
  units: [
    "Allenton Ward",
    "Ashburton Ward",
    "Avon River Ward",
    "Cashmere Ward",
    "Hagley Ward",
    "Mona Vale Ward",
    "Rangiora Ward",
    "Riccarton Ward",
    "Stake",
  ],
  expandedGridId: null,
};

// 3. CORE LOGIC
async function startApp() {
  const app = document.getElementById("app");
  // document.body.style.background =
  //   "url('/background.jpg') no-repeat center center fixed";
  // document.body.style.backgroundSize = "cover";

  // Fetch full member details for the login logic
  const { data: members, error } = await supabase.from("members").select("*");
  if (!error && members) {
    appState.members = members;
    // Filter out people who shouldn't be assigned tasks (like viewers) if needed
    appState.assignableNames = members
      .filter((m) => m.role !== "viewer")
      .map((m) => m.name);
  }

  const isLoggedIn = localStorage.getItem("isLoggedIn");
  if (isLoggedIn) {
    await fetchCallings();
    renderHeader();
    renderCards();
  } else {
    renderLogin();
  }
}

// 4. THE LOGIN LOGIC (As per your CSV)
async function login(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const selectedName = formData.get("authName");
  const enteredPassword = formData.get("authPassword");

  // Master Passwords
  const STAKE_PW = "stake2026";
  const ADMIN_PW = "admin789";

  // Find the person in our loaded members list
  const person = appState.members.find((m) => m.name === selectedName);

  if (!person) {
    alert("Please select a valid name.");
    return;
  }

  // Check their required password type
  const requiredPassword =
    person.shared_password_type === "admin" ? ADMIN_PW : STAKE_PW;

  if (enteredPassword === requiredPassword) {
    // Success! Save their specific role (admin, assign, or viewer)
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", person.name);
    localStorage.setItem("userRole", person.role);
    window.location.reload();
  } else {
    alert("Incorrect password for your role.");
  }
}
window.login = login;

// 5. RENDERING THE LOGIN (Black Card)
function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
      <div class="card" style="background: #000; padding: 30px; border-radius: 16px; width: 100%; max-width: 350px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h2 style="color: white; text-align: center; margin-bottom: 25px;">Stake Sign In</h2>
        <form onsubmit="window.login(event)">
          
          <label style="color: #888; font-size: 0.7rem; letter-spacing: 1px;">NAME</label>
          <select name="authName" required style="width:100%; padding:12px; margin: 5px 0 20px 0; border-radius:8px; background: #fff;">
            <option value="">Select your name...</option>
            ${appState.members.map((m) => `<option value="${m.name}">${m.name}</option>`).join("")}
          </select>

          <label style="color: #888; font-size: 0.7rem; letter-spacing: 1px;">PASSWORD</label>
          <input type="password" name="authPassword" id="pw-input" placeholder="••••••••" required 
                 style="width:100%; padding:12px; margin: 5px 0 10px 0; border-radius:8px;">

          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 25px; color: #ccc; cursor: pointer;">
            <input type="checkbox" onclick="document.getElementById('pw-input').type = this.checked ? 'text' : 'password'">
            <span style="font-size: 0.8rem;">Show password</span>
          </label>

          <button type="submit" style="width:100%; padding:14px; background:#4E5FF2; color:white; border:none; border-radius:8px; font-weight:bold; cursor: pointer;">
            Sign In
          </button>
        </form>
      </div>
    </div>
  `;
}

// 6. HELPER FOR SIGNOUT
window.signOut = () => {
  localStorage.clear();
  window.location.reload();
};

// INITIALIZE
startApp();
