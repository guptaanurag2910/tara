import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const IMAGE_PATH = path.resolve(__dirname, "../../src/assets/profile-1.png");

const seed = {
  matchedUser: null,
  uploadUser: null,
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

async function apiPhoneLogin(request, phoneNumber) {
  const response = await request.post(`${API_BASE}/auth/login/`, {
    data: {
      phone_number: phoneNumber,
      password: PHONE_AUTH_PASSWORD,
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

async function readScrollerMetrics(page) {
  return page.locator("div.overflow-y-auto.overscroll-contain").first().evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
}

async function expectFixedNavPersists(page, pathName, readyLocator) {
  await page.goto(pathName);
  await page.waitForLoadState("networkidle");
  await expect(readyLocator).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const nav = page.locator(".tara-fixed-nav");
  await expect(nav).toBeVisible();

  const before = await nav.boundingBox();
  const metricsBefore = await readScrollerMetrics(page);

  if (metricsBefore.scrollHeight > metricsBefore.clientHeight + 20) {
    await page.locator("div.overflow-y-auto.overscroll-contain").first().evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(150);
  }

  const after = await nav.boundingBox();
  const viewport = page.viewportSize();

  expect(Math.abs((after?.y || 0) - (before?.y || 0))).toBeLessThanOrEqual(1);
  expect((after?.y || 0) + (after?.height || 0)).toBeLessThanOrEqual((viewport?.height || 0) + 1);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  seed.matchedUser = await apiPhoneLogin(request, "+919000000005");
  const matchesResponse = await apiGet(request, seed.matchedUser.access, "matches/");
  expect(matchesResponse.status()).toBe(200);
  const payload = await matchesResponse.json();
  const matchList = Array.isArray(payload?.results) ? payload.results : payload;
  seed.matchId = matchList?.[0]?.match_id;
  expect(seed.matchId).toBeTruthy();

  seed.uploadUser = await apiSignup(request, {
    name: "Cross Browser Upload User",
    email: `${uniqueId("cross-browser")}@tara.demo`,
  });
});

test.describe("Desktop browser checks", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  });

  test("fixed footer stays visible across core app screens", async ({ page }) => {
    await applySession(page, seed.matchedUser);

    await expectFixedNavPersists(page, "/discover", page.getByRole("button", { name: "Filters" }));
    await expectFixedNavPersists(page, "/profile", page.getByRole("heading", { name: "Profile", exact: true }));
    await expectFixedNavPersists(page, `/chat/${seed.matchId}`, page.getByRole("button", { name: "Send" }));
  });

  test("desktop forms stay usable from auth to profile editing", async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page);

    const phoneInput = page.locator('input[type="tel"]');
    const passwordInput = page.getByPlaceholder(/Enter your password/i);
    await expect(phoneInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await phoneInput.fill("9000000005");
    await passwordInput.fill(PHONE_AUTH_PASSWORD);
    await page.getByRole("button", { name: /^Login$/i }).click();
    await expect(page).toHaveURL(/\/discover$/);

    await page.goto("/profile/edit/birth-details");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Edit Birth Details/i })).toBeVisible();
    await expect(page.getByLabel(/Date of Birth/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Search city or place/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Use Current Location/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("desktop image upload and chat sending work cleanly", async ({ page }) => {
    await applySession(page, seed.uploadUser);
    await page.goto("/profile/edit/photos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Edit Photos/i })).toBeVisible();

    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/profile/photos/") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await page.locator('input[type="file"]').setInputFiles(IMAGE_PATH);
    await uploadResponse;
    await expect(page.getByAltText("Profile upload")).toHaveCount(1);

    await applySession(page, seed.matchedUser);
    await page.goto(`/chat/${seed.matchId}`);
    await page.waitForLoadState("networkidle");
    const message = `Cross-browser desktop ${Date.now()}`;
    await page.getByPlaceholder("Type a message...").fill(message);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(message)).toBeVisible();
  });
});

test.describe("Mobile browser checks", () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });

  test("mobile fixed footer stays visible across core app screens", async ({ page }) => {
    await applySession(page, seed.matchedUser);

    await expectFixedNavPersists(page, "/discover", page.getByRole("button", { name: "Filters" }));
    await expectFixedNavPersists(page, "/profile", page.getByRole("heading", { name: "Profile", exact: true }));
    await expectFixedNavPersists(page, `/chat/${seed.matchId}`, page.getByRole("button", { name: "Send" }));
  });

  test("mobile forms stay usable on auth and profile birth details", async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page);

    const phoneInput = page.locator('input[type="tel"]');
    const passwordInput = page.getByPlaceholder(/Enter your password/i);
    await expect(phoneInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await phoneInput.fill("9000000005");
    await passwordInput.fill(PHONE_AUTH_PASSWORD);
    await page.getByRole("button", { name: /^Login$/i }).click();
    await expect(page).toHaveURL(/\/discover$/);

    await page.goto("/profile/edit/birth-details");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Edit Birth Details/i })).toBeVisible();
    await expect(page.getByLabel(/Date of Birth/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Search city or place/i)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("mobile image upload and chat composer work cleanly", async ({ page }) => {
    await applySession(page, seed.uploadUser);
    await page.goto("/profile/edit/photos");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Edit Photos/i })).toBeVisible();

    const beforeCount = await page.getByAltText("Profile upload").count();
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/profile/photos/") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await page.locator('input[type="file"]').setInputFiles(IMAGE_PATH);
    await uploadResponse;
    await expect(page.getByAltText("Profile upload")).toHaveCount(beforeCount + 1);

    await applySession(page, seed.matchedUser);
    await page.goto(`/chat/${seed.matchId}`);
    await page.waitForLoadState("networkidle");
    const navBox = await page.locator(".tara-fixed-nav").boundingBox();
    const input = page.getByPlaceholder("Type a message...");
    const sendButton = page.getByRole("button", { name: "Send" });
    await expect(input).toBeVisible();
    await expect(sendButton).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const inputBox = await input.boundingBox();
    expect((inputBox?.y || 0) + (inputBox?.height || 0)).toBeLessThanOrEqual((navBox?.y || 0) + 1);

    const message = `Cross-browser mobile ${Date.now()}`;
    await input.fill(message);
    await sendButton.click();
    await expect(page.getByText(message)).toBeVisible();
  });
});
