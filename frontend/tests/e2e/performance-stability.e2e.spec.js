import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8003/api";
const PERF_PHONE = "+919990030000";
const PERF_PASSWORD = "Phase30Perf@123";

const seed = {
  perfAuth: null,
  longMatchId: null,
  longThreadSize: 0,
  recommendationCount: 0,
  matchesCount: 0,
  uploadUser: null,
};

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function defaultSignupPayload({ name, email }) {
  return {
    name,
    email,
    password: PERF_PASSWORD,
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

async function apiPhoneLogin(request, phoneNumber, password = PERF_PASSWORD) {
  const response = await request.post(`${API_BASE}/auth/login/`, {
    data: {
      phone_number: phoneNumber,
      password,
    },
  });
  expect(response.status()).toBe(200);
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

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBeFalsy();
}

test.describe.serial("Performance and stability checks", () => {
  test.beforeAll(async ({ request }) => {
    seed.perfAuth = await apiPhoneLogin(request, PERF_PHONE);

    const recommendationsResponse = await apiGet(request, seed.perfAuth.access, "recommendations/");
    expect(recommendationsResponse.status()).toBe(200);
    const recommendationsPayload = await recommendationsResponse.json();
    seed.recommendationCount = Number(recommendationsPayload?.count || recommendationsPayload?.results?.length || 0);

    const matchesResponse = await apiGet(request, seed.perfAuth.access, "matches/");
    expect(matchesResponse.status()).toBe(200);
    const matchesPayload = await matchesResponse.json();
    const matches = Array.isArray(matchesPayload) ? matchesPayload : matchesPayload?.results || [];
    seed.matchesCount = matches.length;

    for (const match of matches.slice(0, 20)) {
      const messagesResponse = await apiGet(request, seed.perfAuth.access, `chat/${match.match_id}/messages/`);
      expect(messagesResponse.status()).toBe(200);
      const messages = await messagesResponse.json();
      if (Array.isArray(messages) && messages.length > seed.longThreadSize) {
        seed.longThreadSize = messages.length;
        seed.longMatchId = match.match_id;
      }
    }

    seed.uploadUser = await apiSignup(request, {
      name: "Phase 30 Upload User",
      email: `${uniqueId("phase30-upload")}@tara.demo`,
    });

    expect(seed.recommendationCount).toBeGreaterThanOrEqual(50);
    expect(seed.matchesCount).toBeGreaterThanOrEqual(40);
    expect(seed.longThreadSize).toBeGreaterThanOrEqual(300);
    expect(seed.longMatchId).toBeTruthy();
  });

  test("discover stays responsive with a dense recommendation pool", async ({ page }) => {
    await applySession(page, seed.perfAuth);

    const startedAt = Date.now();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/recommendations/") &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.goto("/discover");
    const response = await responsePromise;
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: /Match/i }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const duration = Date.now() - startedAt;
    const payload = await response.json();
    const totalCount = Number(payload?.count || payload?.results?.length || 0);
    expect(totalCount).toBeGreaterThanOrEqual(50);
    expect(duration).toBeLessThan(10000);

    console.log(JSON.stringify({ metric: "discover_load_ms", duration, totalCount }));
  });

  test("matches screen handles a large matched list without freezing", async ({ page }) => {
    await applySession(page, seed.perfAuth);

    const startedAt = Date.now();
    await page.goto("/matches");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Matches", exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`${seed.matchesCount} souls aligned with yours\\.`))).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const allLinks = page.locator('a[href^="/matches/"]');
    await expect(allLinks.first()).toBeVisible();
    const totalRenderedLinks = await allLinks.count();
    const duration = Date.now() - startedAt;

    expect(totalRenderedLinks).toBeGreaterThanOrEqual(seed.matchesCount);
    expect(duration).toBeLessThan(10000);

    console.log(JSON.stringify({ metric: "matches_load_ms", duration, seedMatchesCount: seed.matchesCount, renderedLinks: totalRenderedLinks }));
  });

  test("long chat threads open and stay interactive", async ({ page }) => {
    await applySession(page, seed.perfAuth);

    const startedAt = Date.now();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/chat/${seed.longMatchId}/messages/`) &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await page.goto(`/chat/${seed.longMatchId}`);
    const response = await responsePromise;
    const messagesPayload = await response.json();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const loadDuration = Date.now() - startedAt;
    expect(Array.isArray(messagesPayload)).toBeTruthy();
    expect(messagesPayload.length).toBeGreaterThanOrEqual(300);
    expect(loadDuration).toBeLessThan(12000);

    const sendStartedAt = Date.now();
    const content = `Phase 30 live send ${Date.now()}`;
    const draftInput = page.getByPlaceholder("Type a message...");
    await draftInput.fill(content);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(content)).toBeVisible();
    await expect(draftInput).toHaveValue("");
    const sendDuration = Date.now() - sendStartedAt;
    expect(sendDuration).toBeLessThan(5000);

    console.log(JSON.stringify({ metric: "chat_load_ms", loadDuration, threadSize: messagesPayload.length, sendDuration }));
  });

  test("multiple image uploads in one session complete cleanly", async ({ page }) => {
    await applySession(page, seed.uploadUser);
    await page.goto("/profile/edit/photos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Edit Photos/i })).toBeVisible();

    const startedAt = Date.now();
    for (let index = 0; index < 5; index += 1) {
      const uploadResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/profile/photos/") &&
          response.request().method() === "POST" &&
          response.status() === 201,
      );
      await page.locator('input[type="file"]').setInputFiles('/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/assets/profile-1.png');
      await uploadResponse;
    }

    await expect(page.getByAltText("Profile upload")).toHaveCount(5);
    const duration = Date.now() - startedAt;
    expect(duration).toBeLessThan(20000);

    console.log(JSON.stringify({ metric: "multi_upload_ms", duration, uploaded: 5 }));
  });
});
