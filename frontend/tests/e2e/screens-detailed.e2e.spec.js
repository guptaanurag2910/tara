import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";

const seed = {
  primary: null,
  secondary: null,
  matchId: null,
};

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function defaultSignupPayload({ name, email }) {
  return {
    name,
    email,
    password: PHONE_AUTH_PASSWORD,
    date_of_birth: "1997-01-01",
    gender: "other",
    preference: "everyone",
    birth_place: "Bengaluru",
    latitude: "12.971600",
    longitude: "77.594600",
    is_birth_time_default: true,
  };
}

async function apiSignup(request, { name, email }) {
  const response = await request.post(`${API_BASE}/auth/signup/`, {
    data: defaultSignupPayload({ name, email }),
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function apiPost(request, token, endpoint, data) {
  return request.post(`${API_BASE}/${endpoint}`, {
    data,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function applySession(page, authPayload, { onboardingComplete = true } = {}) {
  await page.addInitScript(
    ({ authPayload: session, onboardingComplete: done }) => {
      localStorage.setItem("tara_access_token", session.access);
      localStorage.setItem("tara_refresh_token", session.refresh);
      localStorage.setItem("tara_user", JSON.stringify(session.user));

      localStorage.setItem(
        "tara_onboarding_profile_v2",
        JSON.stringify({
          name: session.user?.name || "",
          date_of_birth: session.user?.date_of_birth || "1997-01-01",
          gender: session.user?.gender || "other",
          preference: session.user?.preference || "everyone",
          birth_place: session.user?.birth_place || "Bengaluru",
          birth_time: session.user?.birth_time || "09:30",
          latitude: session.user?.latitude ? String(session.user.latitude) : "12.971600",
          longitude: session.user?.longitude ? String(session.user.longitude) : "77.594600",
          basicSaved: true,
          birthSaved: true,
          photos: [],
          bio: "",
          completed: done,
          completedAt: done ? new Date().toISOString() : null,
        }),
      );
    },
    { authPayload, onboardingComplete },
  );
}

async function waitForApi(page, { fragment, method = "GET", expectedStatuses = [200] }) {
  const response = await page.waitForResponse((res) => {
    return res.url().includes(`/api/${fragment}`) && res.request().method() === method;
  });
  expect(expectedStatuses).toContain(response.status());
  return response;
}

async function clickEnabledContinue(page) {
  const continueButton = page.getByRole("button", { name: /Continue/i });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}

test.describe.serial("Detailed screen-by-screen UI + API validation", () => {
  test.beforeAll(async ({ request }) => {
    const unique = uniqueId("seed");
    seed.primary = await apiSignup(request, {
      name: "Seed Primary",
      email: `seed.primary.${unique}@tara.demo`,
    });
    seed.secondary = await apiSignup(request, {
      name: "Seed Secondary",
      email: `seed.secondary.${unique}@tara.demo`,
    });

    const birthResponse = await apiPost(request, seed.primary.access, "birth-details/", {
      date_of_birth: "1997-01-01",
      time_of_birth: "09:30",
      place_of_birth: "Bengaluru",
      latitude: "12.971600",
      longitude: "77.594600",
    });
    expect(birthResponse.status()).toBe(200);

    const likeOne = await apiPost(request, seed.primary.access, "swipe/like/", {
      target_user_id: seed.secondary.user.id,
    });
    expect(likeOne.status()).toBe(200);

    const likeTwo = await apiPost(request, seed.secondary.access, "swipe/like/", {
      target_user_id: seed.primary.user.id,
    });
    expect(likeTwo.status()).toBe(200);
    const likeTwoData = await likeTwo.json();
    seed.matchId = likeTwoData.match_id;
    expect(seed.matchId).toBeTruthy();

    const seedMessage = await apiPost(request, seed.secondary.access, `chat/${seed.matchId}/message/`, {
      content: "Hey from seeded setup",
    });
    expect(seedMessage.status()).toBe(201);
  });

  test("1) Landing screen (/) UI renders correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Love written/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Begin your journey/i })).toBeVisible();
  });

  test("2) Login redirect route (/login) routes to /auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("3) Auth screen (/auth) OTP flow works and calls auth APIs", async ({ page }) => {
    const phone = `9${Date.now().toString().slice(-9)}`;
    const apiStatuses = [];

    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/api/auth/login") || url.includes("/api/auth/signup") || url.includes("/api/auth/me")) {
        apiStatuses.push({ url, status: res.status() });
      }
    });

    await page.goto("/auth");
    await page.locator('input[placeholder="98765 43210"]').fill(phone);
    await page.getByRole("button", { name: /Send code/i }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    const otp = "123456";
    for (let i = 0; i < otp.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).fill(otp[i]);
    }

    await expect(page).toHaveURL(/\/(welcome|profile-setup|discover)$/);
    expect(apiStatuses.some((item) => item.url.includes("/api/auth/login") && [200, 401].includes(item.status))).toBeTruthy();
    expect(apiStatuses.some((item) => item.url.includes("/api/auth/signup") && item.status === 201) || apiStatuses.some((item) => item.url.includes("/api/auth/login") && item.status === 200)).toBeTruthy();
  });

  test("4) Welcome screen (/welcome) works and proceeds to onboarding", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: false });
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { name: /Let's read your stars/i })).toBeVisible();
    await page.getByRole("button", { name: /Begin/i }).click();
    await expect(page).toHaveURL(/\/profile-setup$/);
  });

  test("5) Profile setup screen (/profile-setup) completes with API-backed flow", async ({ page }) => {
    const unique = uniqueId("onboard");
    const onboardingUser = await apiSignup(page.request, {
      name: "Onboarding User",
      email: `onboarding.${unique}@tara.demo`,
    });

    await applySession(page, onboardingUser, { onboardingComplete: false });
    await page.goto("/profile-setup");
    await expect(page).toHaveURL(/\/profile-setup$/);

    await page.getByPlaceholder("Your name").fill("Onboard Flow User");
    await clickEnabledContinue(page);

    await page.locator('input[type="date"]').fill("1996-05-21");
    await clickEnabledContinue(page);

    await page.getByRole("button", { name: "Woman" }).click();
    await clickEnabledContinue(page);

    await page.getByRole("button", { name: "Everyone" }).click();
    {
      const basicPromise = waitForApi(page, {
        fragment: "profile/basic/",
        method: "POST",
        expectedStatuses: [200],
      });
      await clickEnabledContinue(page);
      await basicPromise;
    }

    await page.getByLabel("Place of Birth").fill("Mumbai, India");
    await clickEnabledContinue(page);

    await page.locator('input[type="time"]').fill("09:30");
    {
      const birthPromise = waitForApi(page, {
        fragment: "profile/birth/",
        method: "POST",
        expectedStatuses: [200],
      });
      const questionPromise = waitForApi(page, {
        fragment: "personality/questions/",
        method: "GET",
        expectedStatuses: [200],
      });
      await clickEnabledContinue(page);
      await birthPromise;
      await questionPromise;
    }

    for (let i = 0; i < 3; i += 1) {
      const continueButton = page.getByRole("button", { name: /Continue/i });
      const optionButtons = page.locator("button.tara-option-card:visible");
      await expect(optionButtons.first()).toBeVisible();
      const optionCount = await optionButtons.count();
      for (let index = 0; index < optionCount; index += 1) {
        await optionButtons.nth(index).click();
        if (await continueButton.isEnabled()) {
          break;
        }
      }
      await clickEnabledContinue(page);
    }

    {
      const mePromise = waitForApi(page, {
        fragment: "auth/me",
        method: "GET",
        expectedStatuses: [200],
      });
      await page.getByRole("button", { name: /Find my matches/i }).click();
      await mePromise;
    }

    await expect(page).toHaveURL(/\/discover$/);
  });

  test("6) Discover screen (/discover) loads recommendations and swipe works", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const recPromise = waitForApi(page, {
      fragment: "recommendations/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/discover");
    await recPromise;

    const likeButton = page.getByRole("button", { name: "♡" });
    await expect(likeButton).toBeVisible();
    if (await likeButton.isEnabled()) {
      const swipePromise = waitForApi(page, {
        fragment: "swipe/like/",
        method: "POST",
        expectedStatuses: [200],
      });
      await likeButton.click();
      await swipePromise;
    } else {
      await expect(page.getByText(/Check back later for new matches/i)).toBeVisible();
    }
  });

  test("7) Matches list screen (/matches) UI and matches API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const matchesPromise = waitForApi(page, {
      fragment: "matches/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/matches");
    await matchesPromise;
    await expect(page.getByRole("heading", { name: /^Matches$/i })).toBeVisible();
  });

  test("8) Match detail screen (/matches/:id) UI and detail API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const detailPromise = waitForApi(page, {
      fragment: `matches/${seed.matchId}/`,
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto(`/matches/${seed.matchId}`);
    await detailPromise;
    await expect(page.getByRole("link", { name: /Start chatting/i })).toBeVisible();
  });

  test("9) Chat list screen (/chat) UI and API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const matchesPromise = waitForApi(page, {
      fragment: "matches/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/chat");
    await matchesPromise;
    await expect(page.getByRole("heading", { name: /Conversations/i })).toBeVisible();
  });

  test("10) Chat room screen (/chat/:id) loads history and sends message via API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const historyPromise = waitForApi(page, {
      fragment: `chat/${seed.matchId}/messages/`,
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto(`/chat/${seed.matchId}`);
    await historyPromise;
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    await page.getByPlaceholder("Type a message...").fill("E2E detailed screen test message");
    const sendPromise = waitForApi(page, {
      fragment: `chat/${seed.matchId}/message/`,
      method: "POST",
      expectedStatuses: [201],
    });
    await page.getByRole("button", { name: /^Send$/i }).click();
    await sendPromise;
  });

  test("11) Kundali screen (/kundali) UI and astrology APIs", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const kundaliPromise = waitForApi(page, {
      fragment: "kundali/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/kundali");
    await kundaliPromise;
    const horoscopePromise = waitForApi(page, {
      fragment: "horoscope/",
      method: "GET",
      expectedStatuses: [200],
    });
    await horoscopePromise;
    await expect(page.getByRole("heading", { name: /Written in your stars/i })).toBeVisible();
  });

  test("12) Profile screen (/profile) UI and profile photos API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const photosPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/profile");
    await photosPromise;
    await expect(page.getByRole("heading", { name: /Profile/i })).toBeVisible();
  });

  test("13) Edit profile list (/profile/edit) UI works", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: /Edit Profile/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bio/i })).toBeVisible();
  });

  test("14) Edit profile section (/profile/edit/bio) updates via API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit/bio");
    await expect(page.getByRole("heading", { name: /Edit Bio/i })).toBeVisible();

    await page.locator("textarea").fill("Detailed E2E bio update");
    const patchPromise = waitForApi(page, {
      fragment: "profile/extras/",
      method: "PATCH",
      expectedStatuses: [200],
    });
    await page.getByRole("button", { name: /^Save Changes$/i }).click();
    await patchPromise;
    await expect(page).toHaveURL(/\/profile\/edit$/);
  });

  test("15) Settings screen (/settings) UI controls and logout guard", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();

    await page.getByRole("button", { name: /^Logout$/i }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("16) Your vibe screen (/your-vibe) UI and profile API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const mePromise = waitForApi(page, {
      fragment: "profile/me/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/your-vibe");
    await mePromise;
    await expect(page.getByRole("heading", { name: /Your Vibe/i })).toBeVisible();
  });

  test("17) Stars today screen (/stars-today) UI and recommendations API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const recPromise = waitForApi(page, {
      fragment: "recommendations/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/stars-today");
    await recPromise;
    await expect(page.getByRole("heading", { name: /Your Top Matches Today/i })).toBeVisible();
  });

  test("18) Profile photos section (/profile/edit/photos) upload + delete APIs", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit/photos");
    await expect(page.getByRole("heading", { name: /Edit Photos/i })).toBeVisible();

    const uploadPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "POST",
      expectedStatuses: [201],
    });
    const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    await uploadPromise;

    const deletePromise = page.waitForResponse((res) => {
      return res.url().includes("/api/profile/photos/") && res.request().method() === "DELETE";
    });
    await page.getByRole("button", { name: /^Delete$/i }).first().click();
    const deleteResponse = await deletePromise;
    expect(deleteResponse.status()).toBe(204);
  });
});
