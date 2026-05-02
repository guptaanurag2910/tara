import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const SEEDED_PHONE = "+919000000005";

const USER_SETTINGS_PREFIX = "tara_user_settings_v1";
const APPEARANCE_MODE_KEY = "tara_appearance_mode_v1";

const seed = {
  user: null,
  matchId: null,
  emptyUser: null,
};

const corePages = [
  {
    key: "discover",
    path: "/discover",
    ready: (page) => page.getByRole("heading", { name: /Find your next spark/i }),
    surface: ".tara-screen-intro",
  },
  {
    key: "stars",
    path: "/stars-today",
    ready: (page) => page.getByRole("heading", { name: /Top Matches Today/i }),
    surface: ".tara-screen-intro",
  },
  {
    key: "matches",
    path: "/matches",
    ready: (page) => page.getByRole("heading", { name: "Matches", exact: true }),
    surface: ".tara-screen-panel",
  },
  {
    key: "chat-list",
    path: "/chat",
    ready: (page) => page.getByRole("heading", { name: "Conversations", exact: true }),
    surface: ".tara-screen-panel",
  },
  {
    key: "chat-detail",
    path: () => `/chat/${seed.matchId}`,
    ready: (page) => page.getByRole("button", { name: "Send" }),
    surface: ".tara-screen-panel",
  },
  {
    key: "kundali",
    path: "/kundali",
    ready: (page) => page.getByRole("heading", { name: /Your Kundali/i }),
    surface: ".tara-screen-intro",
  },
  {
    key: "profile",
    path: "/profile",
    ready: (page) => page.getByRole("heading", { name: "Profile", exact: true }),
    surface: "[data-testid='profile-bio-card']",
  },
  {
    key: "settings",
    path: "/settings",
    ready: (page) => page.getByRole("heading", { name: "Settings", exact: true }),
    surface: ".tara-screen-panel",
  },
];

function settingsKey(userId) {
  return `${USER_SETTINGS_PREFIX}:${userId || "anon"}`;
}

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

async function apiSignup(request, { name, email }) {
  const response = await request.post(`${API_BASE}/auth/signup/`, {
    data: defaultSignupPayload({ name, email }),
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

async function applySession(page, authPayload, { appearance = "dark", onboardingComplete = true } = {}) {
  await page.addInitScript(
    ({ session, done }) => {
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
          currentStep: done ? 7 : 0,
          currentQuestionIndex: 0,
          __ownerUserId: String(session.user?.id || ""),
        }),
      );
    },
    { session: authPayload, done: onboardingComplete },
  );
}

async function setAppearanceStorage(page, userId, mode) {
  await page.evaluate(
    ({ nextMode, nextUserId, keyPrefix, appearanceKey }) => {
      localStorage.setItem(appearanceKey, nextMode);
      const userKey = `${keyPrefix}:${nextUserId || "anon"}`;
      const current = JSON.parse(localStorage.getItem(userKey) || "{}");
      localStorage.setItem(
        userKey,
        JSON.stringify({
          ...current,
          appearance: nextMode,
        }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: appearanceKey }));
      window.dispatchEvent(new StorageEvent("storage", { key: userKey }));
    },
    {
      nextMode: mode,
      nextUserId: seed.user?.user?.id,
      keyPrefix: USER_SETTINGS_PREFIX,
      appearanceKey: APPEARANCE_MODE_KEY,
    },
  );
}

async function waitForTheme(page, theme) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect.poll(async () => page.locator("html").getAttribute("data-theme-changing")).toBeNull();
}

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasOverflow).toBeFalsy();
}

async function readSurfaceMetrics(page, config) {
  const heading = config.ready(page);
  const surface = page.locator(config.surface).first();
  await expect(surface).toBeVisible();

  return {
    heading: await heading.boundingBox(),
    surface: await surface.boundingBox(),
  };
}

function expectBoxesStable(lightBox, darkBox, tolerance = 8) {
  expect(lightBox).toBeTruthy();
  expect(darkBox).toBeTruthy();
  expect(Math.abs((lightBox?.x || 0) - (darkBox?.x || 0))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((lightBox?.y || 0) - (darkBox?.y || 0))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((lightBox?.width || 0) - (darkBox?.width || 0))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((lightBox?.height || 0) - (darkBox?.height || 0))).toBeLessThanOrEqual(tolerance);
}

async function attachMainScreenshot(testInfo, page, name) {
  const main = page.locator("main").first();
  await expect(main).toBeVisible();
  const body = await main.screenshot({ animations: "disabled" });
  await testInfo.attach(name, {
    body,
    contentType: "image/png",
  });
}

async function readPseudoBackground(locator, pseudo = "::before") {
  return locator.evaluate((node, targetPseudo) => getComputedStyle(node, targetPseudo).backgroundImage, pseudo);
}

async function withRoute(page, matcher, handler, run) {
  await page.route(matcher, handler);
  try {
    await run();
  } finally {
    void page.unroute(matcher, handler);
  }
}

function delayedJsonRoute(payload, { delayMs = 1600, status = 200 } = {}) {
  return async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  };
}

function emptyJsonRoute(payload = [], status = 200) {
  return async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  };
}

test.describe.serial("Phase 14 QA pass", () => {
  test.setTimeout(240000);

  test.beforeAll(async ({ request }) => {
    seed.user = await apiPhoneLogin(request, SEEDED_PHONE);
    const matchesResponse = await apiGet(request, seed.user.access, "matches/");
    expect(matchesResponse.status()).toBe(200);
    const payload = await matchesResponse.json();
    const matchList = Array.isArray(payload?.results) ? payload.results : payload;
    seed.matchId = matchList?.[0]?.match_id;
    expect(seed.matchId).toBeTruthy();

    seed.emptyUser = await apiSignup(request, {
      name: "QA Empty User",
      email: `${uniqueId("qa-empty")}@tara.demo`,
    });
  });

  test("desktop: both themes stay consistent across core pages and attach screenshots", async ({ page }, testInfo) => {
    await applySession(page, seed.user, { appearance: "light" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const lightMetrics = {};
    const darkMetrics = {};

    for (const theme of ["light", "dark"]) {
      await setAppearanceStorage(page, seed.user.user.id, theme);
      for (const config of corePages) {
        const pathName = typeof config.path === "function" ? config.path() : config.path;
        await page.goto(pathName);
        await page.waitForLoadState("networkidle");
        await waitForTheme(page, theme);
        await expect(config.ready(page)).toBeVisible();
        await assertNoHorizontalOverflow(page);

        const metrics = await readSurfaceMetrics(page, config);
        if (theme === "light") {
          lightMetrics[config.key] = metrics;
        } else {
          darkMetrics[config.key] = metrics;
        }

        await attachMainScreenshot(testInfo, page, `desktop-${theme}-${config.key}`);
      }
    }

    for (const config of corePages) {
      expectBoxesStable(lightMetrics[config.key]?.heading, darkMetrics[config.key]?.heading, 10);
      expectBoxesStable(lightMetrics[config.key]?.surface, darkMetrics[config.key]?.surface, 12);
    }
  });

  test("theme switch during navigation stays smooth and survives route changes", async ({ page }) => {
    await applySession(page, seed.user, { appearance: "system" });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /^Day$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-changing", "true");
    await waitForTheme(page, "light");

    for (const pathName of ["/discover", "/matches", "/chat", `/chat/${seed.matchId}`, "/kundali", "/profile"]) {
      await page.goto(pathName);
      await page.waitForLoadState("networkidle");
      await waitForTheme(page, "light");
      await assertNoHorizontalOverflow(page);
    }

    await page.goto("/settings");
    await page.getByRole("button", { name: /^Night$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-changing", "true");
    await waitForTheme(page, "dark");

    for (const pathName of ["/profile", "/kundali", `/chat/${seed.matchId}`, "/chat", "/matches", "/discover"]) {
      await page.goto(pathName);
      await page.waitForLoadState("networkidle");
      await waitForTheme(page, "dark");
      await assertNoHorizontalOverflow(page);
    }
  });

  test("theme-specific empty states keep the same structure with different day/night atmosphere", async ({ page }) => {
    await applySession(page, seed.user, { appearance: "light" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const backgrounds = {
      light: {},
      dark: {},
    };

    for (const theme of ["light", "dark"]) {
      await setAppearanceStorage(page, seed.user.user.id, theme);

      await withRoute(page, /\/api\/recommendations\/?.*/, emptyJsonRoute([]), async () => {
        const empty = page.locator('[data-empty-kind="discovery"]');
        await page.goto("/discover");
        await waitForTheme(page, theme);
        await expect(empty).toBeVisible();
        await expect(empty.locator(".tara-empty-kicker")).toContainText("Discovery pause");
        await expect(empty.locator(".tara-empty-title")).toContainText("No more souls nearby right now");
        await expect(empty.getByRole("button", { name: /Refresh feed/i })).toBeVisible();
        backgrounds[theme].discovery = await readPseudoBackground(empty);
      });

      await withRoute(page, /\/api\/notifications\/?.*/, emptyJsonRoute([]), async () => {
        await page.goto("/discover");
        await waitForTheme(page, theme);
        await page.getByRole("button", { name: /Open notifications/i }).click();
        const empty = page.locator('[data-empty-kind="notifications"]');
        await expect(empty).toBeVisible();
        await expect(empty.locator(".tara-empty-kicker")).toContainText("All clear");
        await expect(empty.locator(".tara-empty-title")).toContainText("Nothing new yet");
        await expect(empty.getByRole("link", { name: /Explore people/i })).toBeVisible();
        backgrounds[theme].notifications = await readPseudoBackground(empty);
      });
    }

    for (const kind of ["discovery", "notifications"]) {
      expect(backgrounds.light[kind]).toBeTruthy();
      expect(backgrounds.dark[kind]).toBeTruthy();
      expect(backgrounds.light[kind]).not.toEqual(backgrounds.dark[kind]);
    }
  });

  test("matches, chat, and kundali empty states stay graceful for a fresh user in both themes", async ({ browser }) => {
    const backgrounds = {
      light: {},
      dark: {},
    };

    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage();
      await applySession(page, seed.emptyUser, { appearance: theme });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await setAppearanceStorage(page, seed.emptyUser.user.id, theme);

      await page.goto("/matches");
      await waitForTheme(page, theme);
      const matchesEmpty = page.locator('[data-empty-kind="matches"]');
      await expect(matchesEmpty).toBeVisible();
      await expect(matchesEmpty.locator(".tara-empty-kicker")).toContainText("Connections pending");
      await expect(matchesEmpty.locator(".tara-empty-title")).toContainText("No matches yet");
      await expect(matchesEmpty.getByRole("link", { name: /Go to Discover/i })).toBeVisible();
      backgrounds[theme].matches = await readPseudoBackground(matchesEmpty);

      await page.goto("/chat");
      await waitForTheme(page, theme);
      const chatEmpty = page.locator('[data-empty-kind="chat"]').first();
      await expect(chatEmpty).toBeVisible();
      await expect(chatEmpty.locator(".tara-empty-kicker")).toContainText("Quiet room");
      await expect(chatEmpty.locator(".tara-empty-title")).toContainText("No conversations yet");
      await expect(chatEmpty.getByRole("link", { name: /View matches/i })).toBeVisible();
      backgrounds[theme].chat = await readPseudoBackground(chatEmpty);

      await page.goto("/kundali");
      await waitForTheme(page, theme);
      const kundaliEmpty = page.locator('[data-empty-kind="kundali"]');
      await expect(kundaliEmpty).toBeVisible();
      await expect(kundaliEmpty.locator(".tara-empty-kicker")).toContainText("Chart pending");
      await expect(kundaliEmpty.locator(".tara-empty-title")).toContainText("Your kundali is waiting on birth details");
      await expect(kundaliEmpty.getByRole("button", { name: /Open birth details/i })).toBeVisible();
      backgrounds[theme].kundali = await readPseudoBackground(kundaliEmpty);

      await page.close();
    }

    for (const kind of ["matches", "chat", "kundali"]) {
      expect(backgrounds.light[kind]).toBeTruthy();
      expect(backgrounds.dark[kind]).toBeTruthy();
      expect(backgrounds.light[kind]).not.toEqual(backgrounds.dark[kind]);
    }
  });

  test("theme-specific skeleton states appear for loading flows and change atmosphere by theme", async ({ page }) => {
    await applySession(page, seed.user, { appearance: "light" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const backgrounds = {
      light: {},
      dark: {},
    };

    const checks = [
      {
        key: "discover",
        path: "/discover",
        matcher: /\/api\/recommendations\/?.*/,
        handler: delayedJsonRoute([]),
        locator: '[data-skeleton-kind="discovery"]',
      },
      {
        key: "matches",
        path: "/matches",
        matcher: /\/api\/matches\/?.*/,
        handler: delayedJsonRoute([]),
        locator: '[data-skeleton-kind="matches"]',
      },
      {
        key: "chat-list",
        path: "/chat",
        matcher: /\/api\/matches\/?.*/,
        handler: delayedJsonRoute([]),
        locator: '[data-skeleton-kind="chat-list"]',
      },
      {
        key: "chat-thread",
        path: `/chat/${seed.matchId}`,
        matcher: /\/api\/(matches\/\d+\/|chat\/\d+\/messages\/|matches\/\d+\/icebreakers\/)/,
        handler: delayedJsonRoute([]),
        locator: '[data-skeleton-kind="chat-thread"]',
      },
      {
        key: "profile",
        path: "/profile",
        matcher: /\/api\/(profile\/photos\/|profile\/me\/)/,
        handler: delayedJsonRoute([]),
        locator: '[data-skeleton-kind="profile"]',
      },
      {
        key: "kundali",
        path: "/kundali",
        matcher: /\/api\/astrology\/kundali\/?.*/,
        handler: delayedJsonRoute({}),
        locator: '[data-skeleton-kind="kundali"]',
      },
    ];

    for (const theme of ["light", "dark"]) {
      await setAppearanceStorage(page, seed.user.user.id, theme);
      for (const check of checks) {
        await withRoute(page, check.matcher, check.handler, async () => {
          await page.goto(check.path, { waitUntil: "domcontentloaded" });
          const skeleton = page.locator(check.locator).first();
          await expect(skeleton).toBeVisible();
          backgrounds[theme][check.key] = await readPseudoBackground(skeleton);
          await page.waitForLoadState("networkidle");
        });
      }
    }

    for (const key of checks.map((item) => item.key)) {
      expect(backgrounds.light[key]).toBeTruthy();
      expect(backgrounds.dark[key]).toBeTruthy();
      expect(backgrounds.light[key]).not.toEqual(backgrounds.dark[key]);
    }
  });

  test.describe("mobile viewport checks", () => {
    test.use({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });

    test("mobile: both themes keep core pages readable and stable", async ({ page }, testInfo) => {
      await applySession(page, seed.user, { appearance: "dark" });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      for (const theme of ["dark", "light"]) {
        await setAppearanceStorage(page, seed.user.user.id, theme);
        for (const config of corePages) {
          const pathName = typeof config.path === "function" ? config.path() : config.path;
          await page.goto(pathName);
          await page.waitForLoadState("networkidle");
          await waitForTheme(page, theme);
          await expect(config.ready(page)).toBeVisible();
          await assertNoHorizontalOverflow(page);
        }
        await attachMainScreenshot(testInfo, page, `mobile-${theme}-settings`);
      }
    });
  });
});
