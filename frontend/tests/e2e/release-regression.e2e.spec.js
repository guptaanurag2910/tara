import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:8000/api";
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const EXISTING_USER_PHONE = "9000000005";

const releaseSeed = {
  pairA: null,
  pairB: null,
  matchId: null,
};

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function uniquePhone() {
  return `9${Date.now().toString().slice(-9)}`;
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
          __ownerUserId: String(session.user?.id || ""),
        }),
      );
    },
    { authPayload, onboardingComplete },
  );
}

async function openAuthedPage(browser, authPayload, targetPath) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await applySession(page, authPayload, { onboardingComplete: true });
  await page.goto(targetPath);
  return { context, page };
}

async function finishNewPhoneSignup(page, phoneDigits) {
  await page.goto("/");
  await page.getByRole("link", { name: /Begin your journey/i }).click();
  await expect(page).toHaveURL(/\/auth\?mode=signup$/);

  await page.locator('input[placeholder="98765 43210"]').fill(phoneDigits);
  await page.getByRole("button", { name: /Continue/i }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();

  const otp = "123456";
  for (let i = 0; i < otp.length; i += 1) {
    await page.getByLabel(`Digit ${i + 1}`).fill(otp[i]);
  }

  await page.getByRole("button", { name: /^Verify$/i }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByPlaceholder(/At least 8 characters/i).fill("ReleasePack@123");
  await page.getByRole("button", { name: /Create account/i }).click();
}

async function loginExistingUser(page) {
  const recommendationsPromise = page.waitForResponse(
    (res) =>
      res.url().includes("/api/recommendations/") &&
      res.request().method() === "GET" &&
      res.status() === 200,
  );

  await page.goto("/");
  await page.getByRole("link", { name: /I already have an account/i }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.locator('input[placeholder="90000 00001"]').fill(EXISTING_USER_PHONE);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/discover$/);

  return recommendationsPromise;
}

test.describe.serial("Release regression pack before release", () => {
  test.beforeAll(async ({ request }) => {
    const unique = uniqueId("release-regression");
    releaseSeed.pairA = await apiSignup(request, {
      name: "Release Pair A",
      email: `release.pair.a.${unique}@tara.demo`,
    });
    releaseSeed.pairB = await apiSignup(request, {
      name: "Release Pair B",
      email: `release.pair.b.${unique}@tara.demo`,
    });

    const likeOne = await apiPost(request, releaseSeed.pairA.access, "swipe/like/", {
      target_user_id: releaseSeed.pairB.user.id,
    });
    expect(likeOne.status()).toBe(200);

    const likeTwo = await apiPost(request, releaseSeed.pairB.access, "swipe/like/", {
      target_user_id: releaseSeed.pairA.user.id,
    });
    expect(likeTwo.status()).toBe(200);
    const likeTwoData = await likeTwo.json();
    releaseSeed.matchId = likeTwoData.match_id;
    expect(releaseSeed.matchId).toBeTruthy();
  });

  test("1) new signup works and lands in onboarding", async ({ page }) => {
    await finishNewPhoneSignup(page, uniquePhone());
    await expect(page).toHaveURL(/\/(onboarding|welcome|profile-setup)$/);
  });

  test("2) existing login works, skips onboarding, discover/kundali/profile are real, and logout returns home", async ({ page }) => {
    const recommendationsResponse = await loginExistingUser(page);
    await page.reload();
    await expect(page).toHaveURL(/\/discover$/);

    const recommendationsPayload = await recommendationsResponse.json();
    const recommendationList = Array.isArray(recommendationsPayload?.results)
      ? recommendationsPayload.results
      : recommendationsPayload;
    expect(recommendationList.length).toBeGreaterThan(0);
    expect(recommendationList[0]?.name).toBeTruthy();
    await expect(page.locator("body")).toContainText(recommendationList[0].name);

    const kundaliPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/astrology/kundali/") &&
        res.request().method() === "GET" &&
        res.status() === 200,
    );
    await page.goto("/kundali");
    await expect(page.getByRole("heading", { name: /Your Kundali/i })).toBeVisible();
    await kundaliPromise;
    await expect(page.locator("body")).toContainText(/Lagna|Moon|Sun/i);

    const profilePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/profile/me/") &&
        res.request().method() === "GET" &&
        res.status() === 200,
    );
    await page.goto("/profile");
    const profileResponse = await profilePromise;
    const me = await profileResponse.json();
    await expect(page.getByTestId("profile-stat-matches-value")).toHaveText(String(me.stats.matches_count));
    await expect(page.getByTestId("profile-stat-likes-value")).toHaveText(String(me.stats.likes_received_count));
    await expect(page.getByTestId("profile-stat-seen-value")).toHaveText(String(me.stats.profile_impressions_count));

    await page.goto("/settings");
    await page.getByRole("button", { name: /^Logout$/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("3) mutual like creates a match and chat works both ways", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, "/matches");
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, "/matches");

    try {
      await expect(pageA.locator("body")).toContainText(releaseSeed.pairB.user.name);
      await expect(pageB.locator("body")).toContainText(releaseSeed.pairA.user.name);

      await pageA.goto(`/chat/${releaseSeed.matchId}`);
      await pageB.goto(`/chat/${releaseSeed.matchId}`);
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();

      const messageA = uniqueId("release-chat-a");
      const messageB = uniqueId("release-chat-b");

      await pageA.getByPlaceholder("Type a message...").fill(messageA);
      await pageA.getByRole("button", { name: /^Send$/i }).click();
      await expect(pageB.locator("body")).toContainText(messageA);

      await pageB.getByPlaceholder("Type a message...").fill(messageB);
      await pageB.getByRole("button", { name: /^Send$/i }).click();
      await expect(pageA.locator("body")).toContainText(messageB);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("4) game session completes inside chat", async ({ browser, request }) => {
    const startResponse = await apiPost(request, releaseSeed.pairA.access, "games/start/", {
      match_id: releaseSeed.matchId,
      category: "this_or_that",
    });
    expect(startResponse.status()).toBe(201);
    const startPayload = await startResponse.json();
    const sessionId = startPayload.session_id;
    const questions = Array.isArray(startPayload.questions) ? startPayload.questions : [];
    expect(questions).toHaveLength(3);

    try {
      let lastAnswerResponse = null;
      for (const question of questions) {
        const optionText = String(question?.options?.[0]?.text || question?.options?.[0] || "").trim();
        expect(optionText).toBeTruthy();

        const answerA = await apiPost(request, releaseSeed.pairA.access, "games/answer/", {
          session_id: sessionId,
          question_id: question.id,
          text_answer: optionText,
        });
        expect(answerA.status()).toBe(200);

        const answerB = await apiPost(request, releaseSeed.pairB.access, "games/answer/", {
          session_id: sessionId,
          question_id: question.id,
          text_answer: optionText,
        });
        expect(answerB.status()).toBe(200);
        lastAnswerResponse = await answerB.json();
      }

      expect(lastAnswerResponse?.is_completed).toBeTruthy();

      const { context, page } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
      try {
        await expect(page.locator("body")).toContainText(/You both picked the same/i);
      } finally {
        await context.close();
      }
    } finally {
      // no-op cleanup block keeps the surrounding structure parallel to the other release scenarios
    }
  });
});
