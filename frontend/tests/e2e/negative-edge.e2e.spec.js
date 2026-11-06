import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const INVALID_UPLOAD_PATH = path.resolve(__dirname, "./fixtures/not-image.txt");

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

async function createPhoneAccount(request, name) {
  const localNumber = `9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`;
  const response = await request.post(`${API_BASE}/auth/signup/`, {
    data: {
      phone_number: `+91${localNumber}`,
      otp: "123456",
      password: PHONE_AUTH_PASSWORD,
      name,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function apiGet(request, token, endpoint) {
  return request.get(`${API_BASE}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function applySession(page, authPayload, { onboardingComplete = true, onboardingProfile = {} } = {}) {
  await page.addInitScript(
    ({ session, done, profileOverrides }) => {
      localStorage.setItem("tara_access_token", session.access);
      localStorage.setItem("tara_refresh_token", session.refresh);
      localStorage.setItem("tara_user", JSON.stringify(session.user));

      const baseProfile = {
        name: session.user?.name || "",
        date_of_birth: session.user?.date_of_birth || "1997-01-01",
        gender: session.user?.gender || "other",
        preference: session.user?.preference || "everyone",
        birth_place: session.user?.birth_place || "Bengaluru",
        birth_time: session.user?.birth_time || "",
        latitude: session.user?.latitude ? String(session.user.latitude) : "12.971600",
        longitude: session.user?.longitude ? String(session.user.longitude) : "77.594600",
        basicSaved: true,
        birthSaved: true,
        responsesByQuestion: {},
        photos: [],
        bio: "",
        completed: done,
        completedAt: done ? new Date().toISOString() : null,
        currentStep: done ? 7 : 0,
        currentQuestionIndex: 0,
        __ownerUserId: String(session.user?.id || ""),
      };

      localStorage.setItem(
        "tara_onboarding_profile_v2",
        JSON.stringify({
          ...baseProfile,
          ...profileOverrides,
          __ownerUserId: String(session.user?.id || ""),
        }),
      );
    },
    { session: authPayload, done: onboardingComplete, profileOverrides: onboardingProfile },
  );
}

test.describe.serial("Negative and edge-case validation", () => {
  const seed = {
    matchedUser: null,
    otherUser: null,
    otherUsersMatchId: null,
  };

  test.beforeAll(async ({ request }) => {
    seed.matchedUser = await createPhoneAccount(request, "Negative Edge Member");
    seed.otherUser = await createPhoneAccount(request, "Unaffiliated Member");
    const matchPartner = await createPhoneAccount(request, "Negative Edge Partner");

    const matchedHeaders = { Authorization: `Bearer ${seed.matchedUser.access}` };
    const partnerHeaders = { Authorization: `Bearer ${matchPartner.access}` };
    const firstLike = await request.post(`${API_BASE}/swipe/like/`, {
      headers: matchedHeaders,
      data: { target_user_id: matchPartner.user.id },
    });
    expect(firstLike.status()).toBe(200);
    const mutualLike = await request.post(`${API_BASE}/swipe/like/`, {
      headers: partnerHeaders,
      data: { target_user_id: seed.matchedUser.user.id },
    });
    expect(mutualLike.status()).toBe(200);
    const matchPayload = await mutualLike.json();
    seed.otherUsersMatchId = matchPayload.match_id;
    expect(seed.otherUsersMatchId).toBeTruthy();
  });

  test("wrong-password login and existing-number signup stay clear", async ({ page }) => {
    const phoneDigits = seed.matchedUser.user.phone_number.replace(/^\+91/, "");
    await page.goto("/auth?mode=login");
    await page.locator('input[type="tel"]').fill(phoneDigits);
    await page.getByPlaceholder(/Enter your password/i).fill("DefinitelyWrong@123");
    await page.getByRole("button", { name: /^Login$/i }).click();
    await expect(page.getByText(/Incorrect password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Reset password instead/i })).toBeVisible();

    await page.goto("/auth?mode=signup");
    await page.locator('input[placeholder="98765 43210"]').fill(phoneDigits);
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page).toHaveURL(/\/auth\?mode=login$/);
    await expect(page.getByText(/already has an account/i)).toBeVisible();
  });

  test("photo step rejects invalid uploads cleanly", async ({ page, request }) => {
    const authPayload = await apiSignup(request, {
      name: "Invalid Upload User",
      email: `${uniqueId("invalid-upload")}@tara.demo`,
    });

    await applySession(page, authPayload, {
      onboardingComplete: false,
      onboardingProfile: {
        name: "Invalid Upload User",
        date_of_birth: "1996-05-21",
        gender: "female",
        preference: "everyone",
        birth_place: "New Delhi, Delhi, India",
        latitude: "28.613895",
        longitude: "77.209006",
        basicSaved: true,
        birthSaved: true,
        currentStep: 6,
        photos: [],
      },
    });

    await page.goto("/profile-setup");
    await expect(page.getByRole("heading", { name: /Add your photos/i })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles(INVALID_UPLOAD_PATH);
    await expect(page.getByText(/Only image files are allowed/i)).toBeVisible();
  });

  test("incomplete onboarding resumes after refresh midway", async ({ page, request }) => {
    const authPayload = await apiSignup(request, {
      name: "Resume Onboarding User",
      email: `${uniqueId("resume-onboarding")}@tara.demo`,
    });

    await applySession(page, authPayload, {
      onboardingComplete: false,
      onboardingProfile: {
        name: "Resume Onboarding User",
        date_of_birth: "1996-05-21",
        gender: "",
        preference: "",
        basicSaved: false,
        birthSaved: false,
        currentStep: 1,
      },
    });

    await page.goto("/profile-setup");
    await expect(page.getByRole("heading", { name: /When were you born/i })).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveValue("1996-05-21");
    await page.reload();
    await expect(page.getByRole("heading", { name: /When were you born/i })).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveValue("1996-05-21");
  });

  test("another user's match route is blocked safely", async ({ page }) => {
    await applySession(page, seed.otherUser);
    await page.goto(`/matches/${seed.otherUsersMatchId}`);
    await expect(page.getByRole("heading", { name: /Match unavailable/i })).toBeVisible();
    await expect(page.getByText(/This match isn't available anymore/i)).toBeVisible();
    await page.getByRole("button", { name: "Back to matches" }).click();
    await expect(page).toHaveURL(/\/matches$/);
  });

  test("matches list loading, empty, error, and retry states", async ({ page }) => {
    await applySession(page, seed.otherUser);
    let responseMode = "loading";
    let notifyLoadingStarted;
    let releaseLoading;
    const loadingStarted = new Promise((resolve) => { notifyLoadingStarted = resolve; });
    const loadingGate = new Promise((resolve) => { releaseLoading = resolve; });
    await page.route("**/api/matches/", async (route) => {
      if (responseMode === "loading") {
        notifyLoadingStarted();
        await loadingGate;
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      } else if (responseMode === "error") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "temporarily unavailable" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
    });

    const navigation = page.goto("/matches");
    await loadingStarted;
    await expect(page.getByText("Finding your connections...")).toBeVisible();
    releaseLoading();
    await navigation;
    await expect(page.getByRole("heading", { name: "No matches yet" })).toBeVisible();

    responseMode = "error";
    await page.reload();
    await expect(page.getByRole("heading", { name: "Couldn't load your matches" })).toBeVisible();
    responseMode = "empty";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "No matches yet" })).toBeVisible();
  });

  test("match detail server error can be retried", async ({ page }) => {
    await applySession(page, seed.matchedUser);
    let shouldFail = true;
    await page.route(`**/api/matches/${seed.otherUsersMatchId}/`, async (route) => {
      if (shouldFail) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "temporarily unavailable" }) });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/matches/${seed.otherUsersMatchId}`);
    await expect(page.getByText("Compatibility details are unavailable right now. Please try again shortly.")).toBeVisible();
    const retry = page.waitForResponse((response) => response.url().includes(`/api/matches/${seed.otherUsersMatchId}/`) && response.status() === 200);
    shouldFail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await retry;
    await expect(page.getByRole("link", { name: /Start chatting/i })).toBeVisible();
  });

  test("kundali stays stable when astrology birth rows are missing", async ({ page, request }) => {
    const authPayload = await apiSignup(request, {
      name: "Missing Astrology Rows",
      email: `${uniqueId("missing-astro")}@tara.demo`,
    });

    await applySession(page, authPayload);
    await page.goto("/kundali");

    await expect(page.getByRole("heading", { name: /Your Kundali/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Birth Details/i })).toBeVisible();
    await expect(
      page.getByText(/Kundali is not generated yet\. Save your birth details to generate your chart\./i),
    ).toBeVisible();
  });

  test("discover shows a clean backend-500 fallback", async ({ page }) => {
    await applySession(page, seed.matchedUser);
    await page.route("**/api/recommendations/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/discover");
    await expect(page.getByText("We couldn't load your matches")).toBeVisible();
    await expect(page.getByText(/Match service is busy right now/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Try Again/i })).toBeVisible();
  });

  test("discover recovers after a timeout-style failure with manual retry", async ({ page }) => {
    await applySession(page, seed.matchedUser);

    let firstRequest = true;
    await page.route("**/api/recommendations/**", async (route) => {
      if (firstRequest) {
        firstRequest = false;
        await route.abort("timedout");
        return;
      }
      await route.fallback();
    });

    await page.goto("/discover");
    await expect(page.getByText("We couldn't load your matches")).toBeVisible();
    await expect(page.getByText(/Check your connection and try again/i)).toBeVisible();

    await page.unroute("**/api/recommendations/**");
    const retryResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/recommendations/") &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /Try Again/i }).click();
    await retryResponse;

    await expect(page.getByText("We couldn't load your matches")).toHaveCount(0);
  });
});
