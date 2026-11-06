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

function decodeCaesarShiftThree(ciphertext) {
  return [...ciphertext].map((character) => {
    if (character < "A" || character > "Z") return character;
    return String.fromCharCode((character.charCodeAt(0) - 65 + 23) % 26 + 65);
  }).join("").toLowerCase();
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
  await page.getByRole("link", { name: /Create an account/i }).click();
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
  await page.getByRole("link", { name: /Log in/i }).click();
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
    await expect(page.getByTestId("profile-stat-seen-value")).toHaveCount(0);

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

  test("4) chat game invite is accepted and both players can finish the game", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();

      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "This or That" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await expect(pageB.getByRole("button", { name: "Play" })).toBeVisible();

      await pageB.getByRole("button", { name: "Play" }).click();
      await expect(pageA.getByTestId("game-modal")).toBeVisible();
      await expect(pageB.getByTestId("game-modal")).toBeVisible();

      for (let round = 0; round < 5; round += 1) {
        const optionA = pageA.getByTestId("game-option-button").first();
        await expect(optionA).toBeVisible();
        const optionText = (await optionA.innerText()).trim();
        await optionA.click();
        await pageB.getByRole("button", { name: optionText, exact: true }).click();
      }

      await expect(pageA.getByTestId("game-modal")).toHaveCount(0);
      await expect(pageB.getByTestId("game-modal")).toHaveCount(0);
      await expect(pageA.locator("body")).toContainText(/You both picked the same|Opposites/);
      await expect(pageB.locator("body")).toContainText(/You both picked the same|Opposites/);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("5) Tic Tac Toe accepts a turn and syncs the board to both players", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      for (const page of [pageA, pageB]) {
        const staleGame = page.locator('button[aria-label^="Close "]').first();
        if (await staleGame.isVisible().catch(() => false)) await staleGame.click();
      }
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "See all games" }).click();
      await pageA.getByRole("button", { name: "Tic Tac Toe" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await pageB.getByRole("button", { name: "Play" }).click();

      await expect(pageA.getByTestId("game-modal")).toBeVisible();
      await expect(pageB.getByTestId("game-modal")).toBeVisible();
      await expect(pageA.getByTestId("tic-tac-toe-turn-status").getByText("Your turn", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("tic-tac-toe-turn-status").getByText("Release Pair A’s turn", { exact: true })).toBeVisible();
      await pageA.getByRole("gridcell", { name: "Cell 1, empty" }).click();
      await expect(pageA.getByRole("gridcell", { name: "Cell 1, X" })).toBeVisible();
      await expect(pageB.getByRole("gridcell", { name: "Cell 1, X" })).toBeVisible();
      await expect(pageA.getByTestId("tic-tac-toe-turn-status").getByText("Release Pair B’s turn", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("tic-tac-toe-turn-status").getByText("Your turn", { exact: true })).toBeVisible();
      await expect(pageA.locator("body")).not.toContainText("Unexpected server error");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("6) Pictionary drawing can be created and sent to the match", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "Pictionary" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await pageB.getByRole("button", { name: "Play" }).click();

      const modal = pageA.getByTestId("pictionary-modal");
      await expect(modal).toBeVisible();
      await expect(modal.getByTestId("pictionary-turn-status").getByText("Your turn to draw", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("pictionary-turn-status").getByText("Release Pair A’s turn to draw", { exact: true })).toBeVisible();
      const canvas = modal.getByTestId("pictionary-drawing-canvas");
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();
      await pageA.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.25);
      await pageA.mouse.down();
      await pageA.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45, { steps: 5 });
      await pageA.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.3, { steps: 5 });
      await pageA.mouse.up();
      await expect(canvas.locator("polyline")).toHaveCount(1);
      await expect(canvas.locator("polyline")).not.toHaveAttribute("points", "");
      await expect(modal.getByRole("button", { name: "Send drawing" })).toBeEnabled();
      await modal.getByRole("button", { name: "Send drawing" }).click();

      await expect(pageB.getByTestId("pictionary-modal").getByTestId("pictionary-turn-status").getByText("Your turn to guess", { exact: true })).toBeVisible();
      await expect(pageA.getByTestId("pictionary-turn-status").getByText("Release Pair B’s turn to guess", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("pictionary-turn-status").getByText("Your turn to guess", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("pictionary-modal").locator("svg polyline")).toHaveCount(1);
      await expect(pageA.locator("body")).not.toContainText("Unexpected server error");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("7) Dots and Boxes clearly shows whose turn it is", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      for (const page of [pageA, pageB]) {
        const stalePictionary = page.getByRole("button", { name: "Close Pictionary" });
        if (await stalePictionary.isVisible().catch(() => false)) await stalePictionary.click();
      }
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "See all games" }).click();
      await pageA.getByRole("button", { name: "Dots and Boxes" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await pageB.reload();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageB.getByRole("button", { name: "Play" }).click();

      await expect(pageA.getByTestId("dots-and-boxes-turn-status").getByText("Your turn", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("dots-and-boxes-turn-status").getByText("Release Pair A’s turn", { exact: true })).toBeVisible();
      await pageA.getByRole("button", { name: "Horizontal line row 1 column 1 available" }).click();
      await expect(pageA.getByTestId("dots-and-boxes-turn-status").getByText("Release Pair B’s turn", { exact: true })).toBeVisible();
      await expect(pageB.getByTestId("dots-and-boxes-turn-status").getByText("Your turn", { exact: true })).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("8) Snakes, Ladders & Secrets saves and syncs the 7x7 race for both players", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      for (const page of [pageA, pageB]) {
        const staleGame = page.locator('button[aria-label^="Close "]').first();
        if (await staleGame.isVisible().catch(() => false)) await staleGame.click();
      }
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "See all games" }).click();
      await pageA.getByRole("button", { name: "Snakes, Ladders & Secrets" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await pageB.getByRole("button", { name: "Play" }).click();

      const gameA = pageA.getByTestId("snakes-ladders-game");
      const gameB = pageB.getByTestId("snakes-ladders-game");
      await expect(gameA).toBeVisible();
      await expect(gameB).toBeVisible();
      await expect(gameA.locator("[data-square]")).toHaveCount(49);
      await expect(gameA.getByTestId("snakes-ladders-turn-status")).toContainText("Your turn · roll the die");
      await expect(gameB.getByTestId("snakes-ladders-turn-status")).toContainText("Release Pair A’s turn");
      await expect(gameB.getByTestId("snakes-ladders-roll")).toBeDisabled();

      await gameA.getByTestId("snakes-ladders-roll").click();
      await expect(gameA.getByText(/Last roll:/)).toBeVisible();
      await expect(gameB.getByText(/Last roll:/)).toBeVisible();
      await expect(pageA.locator("body")).not.toContainText("Unexpected server error");
      await expect(pageB.locator("body")).not.toContainText("Unexpected server error");

      await pageB.reload();
      const restoredGame = pageB.getByTestId("snakes-ladders-game");
      await expect(restoredGame).toBeVisible();
      await expect(restoredGame.locator("[data-square]")).toHaveCount(49);
      await expect(restoredGame.getByText(/Last roll:/)).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("9) Cipher Breaker keeps answers private and reveals both scores", async ({ browser }) => {
    const { context: contextA, page: pageA } = await openAuthedPage(browser, releaseSeed.pairA, `/chat/${releaseSeed.matchId}`);
    const { context: contextB, page: pageB } = await openAuthedPage(browser, releaseSeed.pairB, `/chat/${releaseSeed.matchId}`);

    try {
      for (const page of [pageA, pageB]) {
        const staleGame = page.locator('button[aria-label^="Close "]').first();
        if (await staleGame.isVisible().catch(() => false)) await staleGame.click();
      }
      await expect(pageA.getByPlaceholder("Type a message...")).toBeVisible();
      await expect(pageB.getByPlaceholder("Type a message...")).toBeVisible();
      await pageA.getByRole("button", { name: "Open games" }).click();
      await pageA.getByRole("button", { name: "See all games" }).click();
      await pageA.getByRole("button", { name: "Cipher Breaker" }).click();
      await expect(pageA.locator("body")).toContainText("Waiting for your match to join");
      await pageB.getByRole("button", { name: "Play" }).click();

      const modalA = pageA.getByTestId("game-modal");
      const modalB = pageB.getByTestId("game-modal");
      await expect(modalA).toBeVisible();
      await expect(modalB).toBeVisible();
      await expect(modalA.getByText("Caesar cipher · shift 3")).toBeVisible();
      await expect(modalA.getByText("Need a hint?")).toBeVisible();
      const modalBox = await modalA.boundingBox();
      const viewport = pageA.viewportSize();
      expect(modalBox?.x || 0).toBeGreaterThanOrEqual(0);
      expect((modalBox?.x || 0) + (modalBox?.width || 0)).toBeLessThanOrEqual((viewport?.width || 0) + 1);

      for (let index = 0; index < 5; index += 1) {
        const ciphertext = (await modalA.locator("p.font-mono").innerText()).trim();
        await modalA.getByRole("textbox", { name: "Your cipher solution" }).fill(decodeCaesarShiftThree(ciphertext));
        await modalA.getByRole("button", { name: "Lock in answer" }).click();
      }
      await expect(modalA.getByText("All your picks are saved ✨")).toBeVisible();
      await expect(pageA.locator("body")).not.toContainText("You cracked");

      for (let index = 0; index < 5; index += 1) {
        const ciphertext = (await modalB.locator("p.font-mono").innerText()).trim();
        await modalB.getByRole("textbox", { name: "Your cipher solution" }).fill(decodeCaesarShiftThree(ciphertext));
        await modalB.getByRole("button", { name: "Lock in answer" }).click();
      }
      await expect(pageA.locator("body")).toContainText("You cracked 10 of 10 ciphers together");
      await expect(pageB.locator("body")).toContainText("You cracked 10 of 10 ciphers together");
      await expect(pageA.locator("body")).not.toContainText("Unexpected server error");
      await expect(pageB.locator("body")).not.toContainText("Unexpected server error");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
