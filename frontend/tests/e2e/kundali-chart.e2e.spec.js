import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";

test("birth chart shows real Lagna, Moon, Sun, and house perspectives", async ({ page, request }) => {
  const signup = await request.post(`${API_BASE}/auth/signup/`, {
    data: {
      name: "Chart Explorer",
      email: `chart.explorer.${Date.now()}@tara.demo`,
      password: PASSWORD,
      date_of_birth: "1997-01-01",
      gender: "other",
      preference: "everyone",
      birth_place: "Bengaluru",
      latitude: "12.971600",
      longitude: "77.594600",
      is_birth_time_default: true,
    },
  });
  expect(signup.status()).toBe(201);
  const session = await signup.json();
  const birth = await request.post(`${API_BASE}/astrology/birth-details/`, {
    data: {
      date_of_birth: "1997-01-01",
      time_of_birth: "09:30",
      place_of_birth: "Bengaluru",
      latitude: "12.971600",
      longitude: "77.594600",
    },
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(birth.status()).toBe(200);
  const chartResponse = await request.get(`${API_BASE}/astrology/kundali/`, {
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(chartResponse.status()).toBe(200);
  const chart = await chartResponse.json();

  await page.addInitScript(({ auth }) => {
    localStorage.setItem("tara_access_token", auth.access);
    localStorage.setItem("tara_refresh_token", auth.refresh);
    localStorage.setItem("tara_user", JSON.stringify(auth.user));
    localStorage.setItem("tara_onboarding_profile_v2", JSON.stringify({
      name: auth.user?.name,
      date_of_birth: auth.user?.date_of_birth,
      gender: auth.user?.gender,
      preference: auth.user?.preference,
      birth_place: auth.user?.birth_place,
      birth_time: "09:30",
      latitude: "12.971600",
      longitude: "77.594600",
      basicSaved: true,
      birthSaved: true,
      completed: true,
      completedAt: new Date().toISOString(),
      photos: [],
      responsesByQuestion: {},
      __ownerUserId: String(auth.user?.id || ""),
    }));
  }, { auth: session });
  await page.goto("/kundali");
  await page.getByRole("tab", { name: "Birth chart" }).click();

  await expect(page.getByRole("button", { name: "Diagram" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: /Lagna chart, North Indian layout/i })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Expand chart" }).click();
  const focusDialog = page.getByRole("dialog", { name: "Lagna chart" });
  await expect(focusDialog).toBeVisible();
  await expect(page.locator(".tara-fixed-nav")).toHaveJSProperty("inert", true);
  await expect(focusDialog.getByRole("button", { name: "Close expanded chart" })).toBeFocused();
  await focusDialog.getByRole("button", { name: /House 2, /i }).click();
  await expect(focusDialog.getByText("HOUSE 02")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(focusDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expand chart" })).toBeFocused();
  await expect(page.locator(".tara-fixed-nav")).toHaveJSProperty("inert", false);
  await expect(page.locator(".kundali-house-detail-heading strong")).toHaveText(chart.chart_data.houses["2"].sign);
  await page.getByRole("button", { name: /House 3, /i }).click();
  await expect(page.getByText("HOUSE 03")).toBeVisible();

  await page.getByRole("button", { name: "Moon", exact: true }).click();
  await expect(page.locator(".kundali-house-detail-heading strong")).toHaveText(chart.moon_sign);
  await expect(page.getByText(/not a separately calculated divisional chart/i)).toBeVisible();
  await page.getByRole("button", { name: "Sun", exact: true }).click();
  await expect(page.locator(".kundali-house-detail-heading strong")).toHaveText(chart.sun_sign);
  await page.getByRole("button", { name: "Lagna", exact: true }).click();

  await page.getByRole("button", { name: "Houses" }).click();
  await expect(page.locator(".kundali-house-grid button")).toHaveCount(12);
  await page.locator("summary").filter({ hasText: "Planet placements" }).click();
  await expect(page.locator(".kundali-position-row")).toHaveCount(Object.keys(chart.chart_data.planets).length);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
