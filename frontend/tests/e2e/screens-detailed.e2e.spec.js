import fs from "node:fs";
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
          responsesByQuestion: {},
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
    return (
      res.url().includes(`/api/${fragment}`) &&
      res.request().method() === method &&
      expectedStatuses.includes(res.status())
    );
  });
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
    await expect(page).toHaveURL(/\/auth(\?.*)?$/);
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
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();

    const otp = "123456";
    for (let i = 0; i < otp.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).fill(otp[i]);
    }
    await page.getByRole("button", { name: /^Verify$/i }).click();
    await expect(page.getByText("Step 3 of 3")).toBeVisible();

    await page.getByPlaceholder(/At least 8 characters/i).fill(PHONE_AUTH_PASSWORD);
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL(/\/(onboarding|welcome|profile-setup|discover)$/);
    expect(apiStatuses.some((item) => item.url.includes("/api/auth/signup") && item.status === 201)).toBeTruthy();
  });

  test("4) Welcome screen (/welcome) works and proceeds to onboarding", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: false });
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { name: /Let's read your stars/i })).toBeVisible();
    await page.getByRole("button", { name: /Begin/i }).click();
    await expect(page).toHaveURL(/\/(onboarding|profile-setup)$/);
  });

  test("5) Profile setup screen (/profile-setup) completes with API-backed flow", async ({ page }) => {
    const unique = uniqueId("onboard");
    const onboardingUser = await apiSignup(page.request, {
      name: "Onboarding User",
      email: `onboarding.${unique}@tara.demo`,
    });

    await page.goto("/");
    await page.evaluate(({ session }) => {
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
          basicSaved: false,
          birthSaved: false,
          responsesByQuestion: {},
          photos: [],
          bio: "",
          completed: false,
          completedAt: null,
          currentStep: 0,
          currentQuestionIndex: 0,
          __ownerUserId: String(session.user?.id || ""),
        }),
      );
    }, { session: onboardingUser });
    await page.goto("/profile-setup");
    await expect(page).toHaveURL(/\/(profile-setup|onboarding)$/);

    await page.getByPlaceholder("Your name").fill("Onboard Flow User");
    await clickEnabledContinue(page);

    await page.locator('input[type="date"]').fill("2012-01-01");
    await expect(page.getByText(/18\+ to use Tara/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/i })).toBeDisabled();

    await page.locator('input[type="date"]').fill("1996-05-21");
    await page.reload();
    await expect(page.getByRole("heading", { name: /When were you born/i })).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveValue("1996-05-21");
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

    await expect(page.getByRole("heading", { name: /Where were you born/i })).toBeVisible();
    await clickEnabledContinue(page);

    await expect(page.getByRole("heading", { name: /Time of birth/i })).toBeVisible();
    {
      const birthPromise = waitForApi(page, {
        fragment: "birth-details/",
        method: "POST",
        expectedStatuses: [200],
      });
      await clickEnabledContinue(page);
      await birthPromise;
    }

    await expect(page.getByRole("heading", { name: /Add your photos/i })).toBeVisible();
    const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
    const uploadPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "POST",
      expectedStatuses: [201],
    });
    await page.locator('input[type="file"]').first().setInputFiles(imagePath);
    await uploadPromise;
    await clickEnabledContinue(page);
    await expect(page.locator("button.tara-option-card:visible").first()).toBeVisible();

    const continueButton = page.getByRole("button", { name: /Continue/i });
    const firstQuestionHeading = page.locator("h1").last();
    const firstQuestionText = await firstQuestionHeading.textContent();
    const firstQuestionOptions = page.locator("button.tara-option-card:visible");
    await firstQuestionOptions.first().click();
    await clickEnabledContinue(page);

    const secondQuestionHeading = page.locator("h1").last();
    await expect(secondQuestionHeading).toBeVisible();
    if (firstQuestionText) {
      await expect(secondQuestionHeading).not.toHaveText(firstQuestionText);
    }
    const secondQuestionText = await secondQuestionHeading.textContent();

    const secondQuestionOptions = page.locator("button.tara-option-card:visible");
    const secondOptionCount = await secondQuestionOptions.count();
    for (let index = 0; index < secondOptionCount; index += 1) {
      await secondQuestionOptions.nth(index).click();
      if (await continueButton.isEnabled()) {
        break;
      }
    }
    await expect(continueButton).toBeEnabled();

    await page.reload();
    await expect(page.locator("text=Personality").first()).toBeVisible();
    await expect(page.locator("h1").last()).toHaveText(secondQuestionText || "");
    await expect(continueButton).toBeEnabled();
    await clickEnabledContinue(page);

    const thirdQuestionOptions = page.locator("button.tara-option-card:visible");
    await expect(thirdQuestionOptions.first()).toBeVisible();
    const thirdOptionCount = await thirdQuestionOptions.count();
    for (let index = 0; index < thirdOptionCount; index += 1) {
      await thirdQuestionOptions.nth(index).click();
      if (await continueButton.isEnabled()) {
        break;
      }
    }
    await clickEnabledContinue(page);

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
    await page.goto("/kundali");
    await expect(page.getByRole("heading", { name: /Your Kundali/i })).toBeVisible();

    const savePromise = waitForApi(page, {
      fragment: "astrology/birth-details/",
      method: "PUT",
      expectedStatuses: [200],
    });
    const kundaliPromise = waitForApi(page, {
      fragment: "astrology/kundali/",
      method: "GET",
      expectedStatuses: [200],
    });
    const horoscopePromise = waitForApi(page, {
      fragment: "astrology/daily-horoscope/",
      method: "GET",
      expectedStatuses: [200],
    });

    await page.getByRole("button", { name: /Update details/i }).click();
    await savePromise;
    await kundaliPromise;
    await horoscopePromise;
    await expect(page.getByRole("heading", { name: /Kundali Dashboard/i })).toBeVisible();
  });

  test("12) Profile screen (/profile) uses real summary data and honest empty states", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    const mePromise = waitForApi(page, {
      fragment: "profile/me/",
      method: "GET",
      expectedStatuses: [200],
    });
    const photosPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/profile");
    const meResponse = await mePromise;
    await photosPromise;
    const me = await meResponse.json();
    await expect(page.getByRole("heading", { name: /Profile/i })).toBeVisible();
    await expect(page.getByText(me.basic_info.name)).toBeVisible();
    await expect(page.getByTestId("profile-stat-matches-value")).toHaveText(String(me.stats.matches_count));
    await expect(page.getByTestId("profile-stat-likes-value")).toHaveText(String(me.stats.likes_received_count));
    await expect(page.getByTestId("profile-stat-seen-value")).toHaveText(String(me.stats.profile_impressions_count));

    if (me.profile_extras.bio) {
      await expect(page.getByTestId("profile-bio-card")).toContainText(me.profile_extras.bio);
    } else {
      await expect(page.getByTestId("profile-bio-card")).toContainText(/Add a short bio/i);
    }

    if (Array.isArray(me.photos) && me.photos.length > 0) {
      await expect(page.getByTestId("profile-photo-grid").locator("img")).toHaveCount(me.photos.length);
    } else {
      await expect(page.getByTestId("profile-photo-empty")).toContainText(/No photos yet/i);
    }

    await expect(page.locator("body")).not.toContainText("Scorpio · Pisces moon");
    await expect(page.locator("body")).not.toContainText("Intuitive · Romantic · Curious");
  });

  test("12b) Profile screen renders rich user data from backend summary", async ({ page, request }) => {
    const unique = uniqueId("profile-rich");
    const richUser = await apiSignup(request, {
      name: "Profile Rich User",
      email: `profile.rich.${unique}@tara.demo`,
    });

    const extrasResponse = await request.patch(`${API_BASE}/profile/extras/`, {
      data: {
        bio: "Painter, night walker, and the friend who remembers tiny details.",
        interests: ["Art", "Night drives", "Poetry"],
      },
      headers: {
        Authorization: `Bearer ${richUser.access}`,
      },
    });
    expect(extrasResponse.status()).toBe(200);

    const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
    const uploadResponse = await request.post(`${API_BASE}/profile/photos/`, {
      headers: {
        Authorization: `Bearer ${richUser.access}`,
      },
      multipart: {
        image: {
          name: "profile-1.png",
          mimeType: "image/png",
          buffer: fs.readFileSync(imagePath),
        },
      },
    });
    expect(uploadResponse.status()).toBe(201);

    await applySession(page, richUser, { onboardingComplete: true });
    const mePromise = waitForApi(page, {
      fragment: "profile/me/",
      method: "GET",
      expectedStatuses: [200],
    });
    const photosPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/profile");
    const meResponse = await mePromise;
    await photosPromise;
    const me = await meResponse.json();

    await expect(page.getByText(me.basic_info.name)).toBeVisible();
    await expect(page.getByTestId("profile-bio-card")).toContainText(me.profile_extras.bio);
    await expect(page.getByTestId("profile-photo-grid").locator("img")).toHaveCount(me.photos.length);
    await expect(page.locator("body")).toContainText("Art · Night drives · Poetry");
    await expect(page.locator("body")).not.toContainText("Scorpio · Pisces moon");
    await expect(page.locator("body")).not.toContainText("Intuitive · Romantic · Curious");
  });

  test("13) Edit profile list (/profile/edit) UI works", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: /Edit Profile/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bio/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Birth Details/i })).toBeVisible();
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

    await page.goto("/profile");
    await expect(page.getByTestId("profile-bio-card")).toContainText("Detailed E2E bio update");
  });

  test("14b) Edit interests section (/profile/edit/interests) updates via API", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit/interests");
    await expect(page.getByRole("heading", { name: /Edit Interests/i })).toBeVisible();

    await page.getByRole("button", { name: /^Music$/i }).click();
    await page.getByRole("button", { name: /^Travel$/i }).click();
    const patchPromise = waitForApi(page, {
      fragment: "profile/extras/",
      method: "PATCH",
      expectedStatuses: [200],
    });
    await page.getByRole("button", { name: /^Save Changes$/i }).click();
    const patchResponse = await patchPromise;
    const payload = await patchResponse.json();
    expect(payload.interests).toEqual(expect.arrayContaining(["Music", "Travel"]));
    await expect(page).toHaveURL(/\/profile\/edit$/);

    await page.goto("/profile");
    await expect(page.locator("body")).toContainText("Music");
    await expect(page.locator("body")).toContainText("Travel");
  });

  test("14c) Edit birth details section (/profile/edit/birth-details) persists via astrology API", async ({ page, request }) => {
    const unique = uniqueId("profile-birth");
    const birthUser = await apiSignup(request, {
      name: "Birth Edit User",
      email: `profile.birth.${unique}@tara.demo`,
    });

    await applySession(page, birthUser, { onboardingComplete: true });
    await page.goto("/profile/edit/birth-details");
    await expect(page.getByRole("heading", { name: /Edit Birth Details/i })).toBeVisible();

    await page.locator('input[id="astro-dob"]').fill("1994-08-17");
    await page.locator('input[id="astro-tob"]').fill("08:45");

    const searchPromise = waitForApi(page, {
      fragment: "astrology/location/search/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.getByPlaceholder(/Search city or place/i).fill("New Delhi");
    await searchPromise;
    await page.getByRole("button", { name: /New Delhi/i }).first().click();

    const savePromise = page.waitForResponse((res) => {
      return (
        res.url().includes("/api/astrology/birth-details/") &&
        ["POST", "PUT"].includes(res.request().method()) &&
        res.status() === 200
      );
    });
    await page.getByRole("button", { name: /Update details|Save details/i }).click();
    await savePromise;
    await expect(page.locator("body")).toContainText(/Birth details saved/i);

    await page.reload();
    await expect(page.locator('input[id="astro-dob"]')).toHaveValue("1994-08-17");
    await expect(page.locator('input[id="astro-tob"]')).toHaveValue("08:45");
    await expect(page.locator("body")).toContainText(/Selected location: New Delhi/i);
  });

  test("15) Settings screen (/settings) UI controls and logout guard", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
    await expect(page.locator("body")).toContainText("Preferences");
    await expect(page.locator("body")).toContainText("Notifications");
    await expect(page.locator("body")).toContainText("Appearance");
    await expect(page.locator("body")).toContainText("Privacy");
    await expect(page.locator("body")).toContainText("Account");

    const minAge = page.getByLabel("Minimum age");
    const maxAge = page.getByLabel("Maximum age");
    const distance = page.getByLabel("Discovery distance");
    const genderPreference = page.getByLabel("Gender preference");
    const matchesToggle = page.getByLabel("Toggle new matches notifications");
    const likesToggle = page.getByLabel("Toggle likes notifications");
    const visibilityToggle = page.getByLabel("Toggle profile visibility");

    await minAge.fill("24");
    await maxAge.fill("31");
    await distance.evaluate((element, value) => {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      descriptor?.set?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, "75");
    await genderPreference.selectOption("female");
    await matchesToggle.click();
    await likesToggle.click();
    await visibilityToggle.click();
    await page.getByRole("button", { name: /^Dark$/i }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toContainText("75 km");
    await expect(matchesToggle).toHaveAttribute("aria-pressed", "false");
    await expect(likesToggle).toHaveAttribute("aria-pressed", "false");
    await expect(visibilityToggle).toHaveAttribute("aria-pressed", "false");

    await page.reload();
    await expect(minAge).toHaveValue("24");
    await expect(maxAge).toHaveValue("31");
    await expect(distance).toHaveValue("75");
    await expect(genderPreference).toHaveValue("female");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(matchesToggle).toHaveAttribute("aria-pressed", "false");
    await expect(likesToggle).toHaveAttribute("aria-pressed", "false");
    await expect(visibilityToggle).toHaveAttribute("aria-pressed", "false");

    const storedSettings = await page.evaluate((userId) => {
      return JSON.parse(localStorage.getItem(`tara_user_settings_v1:${userId}`) || "{}");
    }, String(seed.primary.user.id));
    expect(storedSettings.discovery.minAge).toBe(24);
    expect(storedSettings.discovery.maxAge).toBe(31);
    expect(storedSettings.discovery.distanceKm).toBe(75);
    expect(storedSettings.discovery.genderPreference).toBe("female");
    expect(storedSettings.notifications.matches).toBe(false);
    expect(storedSettings.notifications.likes).toBe(false);
    expect(storedSettings.privacy.profileVisible).toBe(false);
    expect(storedSettings.appearance).toBe("dark");

    await page.getByRole("button", { name: /^Back$/i }).click();
    await expect(page).toHaveURL(/\/profile$/);

    await page.goto("/settings");

    await page.getByRole("button", { name: /^Logout$/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("16) Your vibe screen (/your-vibe) UI and profile API", async ({ page, request }) => {
    const loginResponse = await request.post(`${API_BASE}/auth/login/`, {
      data: {
        phone_number: "+919000000005",
        password: PHONE_AUTH_PASSWORD,
      },
    });
    expect(loginResponse.status()).toBe(200);
    const vibeUser = await loginResponse.json();

    await applySession(page, vibeUser, { onboardingComplete: true });
    const mePromise = waitForApi(page, {
      fragment: "profile/me/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/your-vibe");
    const meResponse = await mePromise;
    const me = await meResponse.json();
    await expect(page.getByRole("heading", { name: /Your Vibe/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(`Based on ${me.personality_responses.length} answered onboarding questions.`);

    const topTraits = Object.entries(me.traits || {})
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);

    for (const [key, value] of topTraits) {
      await expect(page.getByTestId(`vibe-card-${key}`)).toContainText(`${value.toFixed(1)}/10`);
    }

    await expect(page.getByTestId("vibe-card-overthinking")).toHaveCount(1);
    await expect(page.getByTestId("your-vibe-empty")).toHaveCount(0);
  });

  test("16b) Your vibe handles users without personality responses gracefully", async ({ page, request }) => {
    const unique = uniqueId("vibe-empty");
    const emptyUser = await apiSignup(request, {
      name: "Vibe Empty User",
      email: `vibe.empty.${unique}@tara.demo`,
    });

    await applySession(page, emptyUser, { onboardingComplete: true });
    const mePromise = waitForApi(page, {
      fragment: "profile/me/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/your-vibe");
    const meResponse = await mePromise;
    const me = await meResponse.json();

    expect(me.personality_responses).toEqual([]);
    expect(me.traits).toEqual({});
    await expect(page.getByRole("heading", { name: /Your Vibe/i })).toBeVisible();
    await expect(page.getByTestId("your-vibe-empty")).toContainText(/No vibe summary yet/i);
    await expect(page.locator("body")).toContainText(/Your vibe appears after you answer the personality questions in onboarding./i);
  });

  test("17) Stars today screen (/stars-today) UI and recommendations API", async ({ page, request }) => {
    const firstDailyResponse = await request.get(`${API_BASE}/daily-recommendations/`, {
      headers: {
        Authorization: `Bearer ${seed.primary.access}`,
      },
    });
    expect(firstDailyResponse.status()).toBe(200);
    const firstDailyPayload = await firstDailyResponse.json();
    const firstDailyResults = Array.isArray(firstDailyPayload?.results)
      ? firstDailyPayload.results
      : Array.isArray(firstDailyPayload)
        ? firstDailyPayload
        : [];
    expect(firstDailyResults.length).toBeGreaterThan(0);
    const firstDailyMatch = firstDailyResults[0];
    expect(firstDailyMatch.user_id).not.toBe(seed.primary.user.id);
    expect(firstDailyMatch.name).toBeTruthy();

    await applySession(page, seed.primary, { onboardingComplete: true });
    const recPromise = waitForApi(page, {
      fragment: "daily-recommendations/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/stars-today");
    const pageResponse = await recPromise;
    const pagePayload = await pageResponse.json();
    const pageResults = Array.isArray(pagePayload?.results)
      ? pagePayload.results
      : Array.isArray(pagePayload)
        ? pagePayload
        : [];

    await expect(page.getByRole("heading", { name: /Your Top Matches Today/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(firstDailyMatch.name);
    if (firstDailyMatch.insight) {
      await expect(page.locator("body")).toContainText(firstDailyMatch.insight);
    }
    expect(pageResults[0]?.user_id).toBe(firstDailyMatch.user_id);

    const refreshPromise = waitForApi(page, {
      fragment: "daily-recommendations/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.reload();
    const refreshed = await refreshPromise;
    const refreshedPayload = await refreshed.json();
    const refreshedResults = Array.isArray(refreshedPayload?.results)
      ? refreshedPayload.results
      : Array.isArray(refreshedPayload)
        ? refreshedPayload
        : [];
    expect(refreshedResults[0]?.user_id).toBe(firstDailyMatch.user_id);
    await expect(page.locator("body")).toContainText(firstDailyMatch.name);
  });

  test("17b) Notification bell creates, reads, and refreshes unread counts correctly", async ({ page, request }) => {
    const unique = uniqueId("notify");
    const sender = await apiSignup(request, {
      name: "Notify Sender",
      email: `notify.sender.${unique}@tara.demo`,
    });
    const recipient = await apiSignup(request, {
      name: "Notify Recipient",
      email: `notify.recipient.${unique}@tara.demo`,
    });

    const likeOne = await apiPost(request, sender.access, "swipe/like/", {
      target_user_id: recipient.user.id,
    });
    expect(likeOne.status()).toBe(200);

    const likeTwo = await apiPost(request, recipient.access, "swipe/like/", {
      target_user_id: sender.user.id,
    });
    expect(likeTwo.status()).toBe(200);
    const likeTwoData = await likeTwo.json();
    const matchId = likeTwoData.match_id;
    expect(matchId).toBeTruthy();

    const firstMessage = await apiPost(request, sender.access, `chat/${matchId}/message/`, {
      content: "Phase 25 first ping",
    });
    expect(firstMessage.status()).toBe(201);

    await applySession(page, recipient, { onboardingComplete: true });
    const initialNotifications = waitForApi(page, {
      fragment: "notifications/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.goto("/discover");
    await initialNotifications;

    const bellButton = page.getByLabel("Open notifications");
    await expect(bellButton).toBeVisible();
    await expect(bellButton).toContainText("2");

    const openRefresh = waitForApi(page, {
      fragment: "notifications/",
      method: "GET",
      expectedStatuses: [200],
    });
    await bellButton.click();
    await openRefresh;
    await expect(page.locator("body")).toContainText("You have a new match");
    await expect(page.locator("body")).toContainText("Someone messaged you");

    const markReadPromise = page.waitForResponse((res) => {
      return (
        res.url().includes("/api/notifications/read/") &&
        res.request().method() === "POST" &&
        res.status() === 200
      );
    });
    await page.getByRole("button", { name: /Mark all read/i }).click();
    await markReadPromise;
    await expect(bellButton.locator("span")).toHaveCount(0);

    const secondMessage = await apiPost(request, sender.access, `chat/${matchId}/message/`, {
      content: "Phase 25 second ping",
    });
    expect(secondMessage.status()).toBe(201);

    const focusRefresh = waitForApi(page, {
      fragment: "notifications/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await focusRefresh;
    await expect(bellButton).toContainText("1");

    const reloadRefresh = waitForApi(page, {
      fragment: "notifications/",
      method: "GET",
      expectedStatuses: [200],
    });
    await page.reload();
    await reloadRefresh;
    await expect(page.getByLabel("Open notifications")).toContainText("1");
  });

  test("18) Profile photos section (/profile/edit/photos) upload + delete APIs", async ({ page }) => {
    await applySession(page, seed.primary, { onboardingComplete: true });
    await page.goto("/profile/edit/photos");
    await expect(page.getByRole("heading", { name: /Edit Photos/i })).toBeVisible();

    const beforeCount = await page.getByAltText("Profile upload").count();

    const uploadPromise = waitForApi(page, {
      fragment: "profile/photos/",
      method: "POST",
      expectedStatuses: [201],
    });
    const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    await uploadPromise;
    await expect(page.getByAltText("Profile upload")).toHaveCount(beforeCount + 1);

    const deletePromise = page.waitForResponse((res) => {
      return res.url().includes("/api/profile/photos/") && res.request().method() === "DELETE";
    });
    await page.getByRole("button", { name: /^Delete$/i }).first().click();
    const deleteResponse = await deletePromise;
    expect(deleteResponse.status()).toBe(204);
    await expect(page.getByAltText("Profile upload")).toHaveCount(beforeCount);

    await page.reload();
    await expect(page.getByAltText("Profile upload")).toHaveCount(beforeCount);
  });
});
