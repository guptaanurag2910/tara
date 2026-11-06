import { expect, test } from "@playwright/test";

const api = "**/api/matching/game-night/**";
const future = "2030-10-30T14:30:00Z";

async function memberPage(page) {
  await page.addInitScript(() => {
    localStorage.setItem("tara_access_token", "test-token");
    localStorage.setItem("tara_user", JSON.stringify({ id: 1, name: "Test Member" }));
    localStorage.setItem("tara_onboarding_profile_v2", JSON.stringify({ completed: true, basicSaved: true, birthSaved: true, __ownerUserId: "1" }));
  });
}

test("Game Night shows the configured next window", async ({ page }) => {
  await memberPage(page);
  await page.route(api, (route) => {
    if (route.request().url().endsWith("/schedule/")) return route.fulfill({ json: {
      is_open: false, starts_at: future, ends_at: "2030-10-30T15:30:00Z", timezone: "Asia/Kolkata",
      windows: [{ weekday: "Wednesday", start: "20:00", end: "21:00", timezone: "Asia/Kolkata" }],
    } });
    return route.fulfill({ json: { state: "idle" } });
  });
  await page.goto("/game-night");
  await expect(page.getByRole("heading", { name: "Game Night", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game Night" })).toBeDisabled();
  await expect(page.getByText("Wednesday · 20:00–21:00 · Asia/Kolkata")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add a 15-minute calendar reminder" }).click();
  await expect((await download).suggestedFilename()).toBe("tara-game-night.ics");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("member can enter a temporary room without creating a match", async ({ page }) => {
  await memberPage(page);
  const room = {
    state: "room", id: 42, status: "active", game_kind: "plot_twist", game_name: "Plot Twist",
    game: { card: { starter: "A tiny spaceship lands beside your picnic.", twist: "Its pilot asks for a favor." }, lines: [], next_user_id: 1 },
    partner: { id: 2, name: "Co-player" }, your_id: 1, your_vote: "", both_voted: false,
    game_done: false, match_id: null, play_ends_at: future, expires_at: future, messages: [],
  };
  await page.route(api, (route) => {
    const url = route.request().url();
    if (url.endsWith("/schedule/")) return route.fulfill({ json: { is_open: true, starts_at: future, timezone: "Asia/Kolkata", windows: [] } });
    if (url.endsWith("/queue/") && route.request().method() === "POST") return route.fulfill({ json: room });
    return route.fulfill({ json: { state: "idle" } });
  });
  await page.goto("/game-night");
  await page.getByRole("button", { name: "Join Game Night" }).click();
  await expect(page.getByRole("heading", { name: "Plot Twist" })).toBeVisible();
  await expect(page.getByText("Co-player")).toBeVisible();
  await expect(page.getByRole("button", { name: "Match" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Game Night recovers from a schedule API failure with retry", async ({ page }) => {
  await memberPage(page);
  let scheduleAttempts = 0;
  await page.route("**/api/matching/game-night/schedule/", (route) => {
    scheduleAttempts += 1;
    if (scheduleAttempts === 1) return route.fulfill({ status: 503, json: { detail: "Schedule is temporarily unavailable." } });
    return route.fulfill({ json: { is_open: false, starts_at: null, timezone: "Asia/Kolkata", windows: [] } });
  });
  await page.route("**/api/matching/game-night/queue/", (route) => route.fulfill({ json: { state: "idle" } }));

  await page.goto("/game-night");
  await expect(page.getByRole("alert")).toContainText("Schedule is temporarily unavailable.");
  const attemptsBeforeRetry = scheduleAttempts;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No windows are enabled right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game Night" })).toBeDisabled();
  await expect.poll(() => scheduleAttempts).toBeGreaterThan(attemptsBeforeRetry);
});

test("staff can edit a Game Night window in the admin portal", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("tara_admin_access", "staff-token"));
  let savedStart = "20:00:00";
  await page.route("**/api/admin-portal/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/overview/")) return route.fulfill({ json: { users: 0, new_users_today: 0, active_users_week: 0, recommendations: 0, matches: 0, swipes_today: 0, messages: 0, game_sessions: 0, unread_notifications: 0, realtime_matches: 0, signups: [], recent_users: [] } });
    if (url.endsWith("/game-night/windows/")) return route.fulfill({ json: [{ id: 1, weekday: 2, weekday_name: "Wednesday", start_time: savedStart, end_time: "21:00:00", timezone_name: "Asia/Kolkata", is_enabled: true }] });
    if (url.endsWith("/game-night/windows/1/") && route.request().method() === "PATCH") {
      savedStart = route.request().postDataJSON().start_time;
      return route.fulfill({ json: { id: 1, weekday: 2, weekday_name: "Wednesday", start_time: savedStart, end_time: "21:00:00", timezone_name: "Asia/Kolkata", is_enabled: true } });
    }
    return route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Game Night" }).first().click();
  await expect(page.getByText("Wednesday", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Start").fill("19:00");
  await page.getByRole("button", { name: "Save window" }).click();
  await expect.poll(() => savedStart).toBe("19:00");
});
