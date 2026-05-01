import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});

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

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(hasOverflow).toBeFalsy();
}

async function readScrollerMetrics(page) {
  return page.locator("div.overflow-y-auto.overscroll-contain").first().evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
}

test.describe.serial("Mobile-first layout validation", () => {
  const seed = {
    appUser: null,
    onboardingUser: null,
    matchId: null,
  };

  test.beforeAll(async ({ request }) => {
    seed.appUser = await apiPhoneLogin(request, "+919000000005");
    const matchesResponse = await apiGet(request, seed.appUser.access, "matches/");
    expect(matchesResponse.status()).toBe(200);
    const payload = await matchesResponse.json();
    const matchList = Array.isArray(payload?.results) ? payload.results : payload;
    seed.matchId = matchList?.[0]?.match_id;
    expect(seed.matchId).toBeTruthy();

    seed.onboardingUser = await apiSignup(request, {
      name: "Mobile Onboarding User",
      email: `${uniqueId("mobile-onboarding")}@tara.demo`,
    });
  });

  test("main mobile screens keep the bottom nav visible and fixed", async ({ page }) => {
    await applySession(page, seed.appUser);

    const screens = [
      { path: "/discover", ready: () => page.getByRole("button", { name: "Filters" }) },
      { path: "/matches", ready: () => page.getByRole("heading", { name: "Matches", exact: true }) },
      { path: "/chat", ready: () => page.getByRole("heading", { name: "Conversations", exact: true }) },
      { path: `/chat/${seed.matchId}`, ready: () => page.getByRole("button", { name: "Send" }) },
      { path: "/kundali", ready: () => page.getByRole("heading", { name: /Your Kundali/i }) },
      { path: "/profile", ready: () => page.getByRole("heading", { name: "Profile", exact: true }) },
      { path: "/stars-today", ready: () => page.getByRole("heading", { name: /Top Matches Today/i }) },
      { path: "/settings", ready: () => page.getByRole("heading", { name: "Settings", exact: true }) },
    ];

    for (const screen of screens) {
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
      await expect(screen.ready()).toBeVisible();
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
        const after = await nav.boundingBox();
        const metricsAfter = await readScrollerMetrics(page);

        expect(metricsAfter.scrollTop).toBeGreaterThan(metricsBefore.scrollTop);
        expect(Math.abs((after?.y || 0) - (before?.y || 0))).toBeLessThanOrEqual(1);
        expect(Math.abs((after?.height || 0) - (before?.height || 0))).toBeLessThanOrEqual(1);
      }

      const viewport = page.viewportSize();
      expect((before?.y || 0) + (before?.height || 0)).toBeLessThanOrEqual((viewport?.height || 0) + 1);
    }
  });

  test("chat composer stays usable and game modal fits the viewport", async ({ page }) => {
    await applySession(page, seed.appUser);
    await page.goto(`/chat/${seed.matchId}`);
    await page.waitForLoadState("networkidle");

    const navBox = await page.locator(".tara-fixed-nav").boundingBox();
    const input = page.locator('input[placeholder="Type a message..."]');
    const sendButton = page.getByRole("button", { name: "Send" });

    await expect(input).toBeVisible();
    await expect(sendButton).toBeVisible();
    await input.focus();
    await assertNoHorizontalOverflow(page);

    const inputBox = await input.boundingBox();
    const sendBox = await sendButton.boundingBox();
    expect(inputBox?.width || 0).toBeGreaterThan(180);
    expect(sendBox?.width || 0).toBeGreaterThan(60);
    expect((inputBox?.y || 0) + (inputBox?.height || 0)).toBeLessThanOrEqual((navBox?.y || 0) + 1);
    expect((sendBox?.y || 0) + (sendBox?.height || 0)).toBeLessThanOrEqual((navBox?.y || 0) + 1);

    await page.getByRole("button", { name: "This or That" }).click();
    const modal = page.locator("text=Round 1 of 3").locator("..").locator("..");
    await expect(modal).toBeVisible();
    const modalBox = await modal.boundingBox();
    const viewport = page.viewportSize();

    expect(modalBox?.x || 0).toBeGreaterThanOrEqual(0);
    expect(modalBox?.y || 0).toBeGreaterThanOrEqual(0);
    expect((modalBox?.x || 0) + (modalBox?.width || 0)).toBeLessThanOrEqual((viewport?.width || 0) + 1);
    expect((modalBox?.y || 0) + (modalBox?.height || 0)).toBeLessThanOrEqual((viewport?.height || 0) + 1);
  });

  test("auth, onboarding, and profile forms stay narrow-phone friendly", async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page);

    const phoneInput = page.locator('input[type="tel"]');
    const passwordInput = page.locator('input[placeholder="Enter your password"]');
    const loginButton = page.getByRole("button", { name: "Login" });
    await expect(phoneInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    await passwordInput.focus();

    const loginButtonBox = await loginButton.boundingBox();
    expect(loginButtonBox?.width || 0).toBeGreaterThan(250);

    await applySession(page, seed.onboardingUser, {
      onboardingComplete: false,
      onboardingProfile: {
        name: "",
        date_of_birth: "",
        gender: "",
        preference: "",
        basicSaved: false,
        birthSaved: false,
        currentStep: 0,
      },
    });
    await page.goto("/profile-setup");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /What should we call you/i })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const nameInput = page.getByPlaceholder("Your name");
    const continueButton = page.getByRole("button", { name: /Continue/i });
    await nameInput.focus();

    const nameInputBox = await nameInput.boundingBox();
    const continueButtonBox = await continueButton.boundingBox();
    expect(nameInputBox?.width || 0).toBeGreaterThan(280);
    expect(continueButtonBox?.width || 0).toBeGreaterThan(280);

    await applySession(page, seed.appUser);
    await page.goto("/profile/edit/bio");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page);
    const textArea = page.locator("textarea");
    await expect(textArea).toBeVisible();
    await textArea.focus();
    const textAreaBox = await textArea.boundingBox();
    expect(textAreaBox?.width || 0).toBeGreaterThan(280);
  });
});
