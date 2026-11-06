import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:8000/api";

function uniquePhone() {
  return `9${Date.now().toString().slice(-9)}`;
}

async function createPhoneAccount(request) {
  const phoneDigits = uniquePhone();
  const response = await request.post(`${API_BASE}/auth/signup/`, {
    data: {
      phone_number: `+91${phoneDigits}`,
      otp: "123456",
      password: PHONE_AUTH_PASSWORD,
      name: `E2E ${phoneDigits.slice(-4)}`,
    },
  });
  expect(response.status()).toBe(201);
  return phoneDigits;
}

async function clickEnabledContinue(page) {
  const continueButton = page.getByRole("button", { name: /Continue/i });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}

async function completePhoneAuth(page, phoneDigits) {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/auth(\?.*)?$/);

  await page.locator('input[placeholder="98765 43210"]').fill(phoneDigits);
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
}

async function completeOnboarding(page) {
  if (page.url().includes("/discover")) {
    return;
  }

  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: /Begin/i }).click();
  }

  await expect(page).toHaveURL(/\/(profile-setup|onboarding)$/);

  await page.getByPlaceholder("Your name").fill("E2E Tara User");
  await clickEnabledContinue(page);

  await page.locator('input[type="date"]').fill("1996-05-21");
  await clickEnabledContinue(page);

  await page.getByRole("button", { name: "Woman" }).click();
  await clickEnabledContinue(page);

  await page.getByRole("button", { name: "Everyone" }).click();
  await clickEnabledContinue(page);

  await expect(page.getByRole("heading", { name: /Where were you born/i })).toBeVisible();
  await page.getByPlaceholder("Search your place of birth").fill("New Delhi");
  await page.getByRole("button", { name: /New Delhi/i }).first().click();
  await clickEnabledContinue(page);

  await expect(page.getByRole("heading", { name: /Time of birth/i })).toBeVisible();
  await clickEnabledContinue(page);

  await expect(page.getByRole("heading", { name: /Add your photos/i })).toBeVisible();
  const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
  await page.locator('input[type="file"]').first().setInputFiles(imagePath);

  const mePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/me") &&
      resp.request().method() === "GET" &&
      resp.status() === 200,
  );
  await page.getByRole("button", { name: /Find my matches/i }).click();
  await mePromise;
  await expect(page).toHaveURL(/\/discover$/);
}

test("unauthenticated users are redirected from protected routes", async ({ page }) => {
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/$/);
});

test("signup route detects an existing number and switches to login", async ({ page, request }) => {
  const phoneDigits = await createPhoneAccount(request);
  await page.goto("/auth?mode=signup");
  await page.locator('input[placeholder="98765 43210"]').fill(phoneDigits);
  await page.getByRole("button", { name: /Continue/i }).click();

  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByText(/already has an account/i)).toBeVisible();
  await expect(page.getByPlaceholder(/Enter your password/i)).toBeVisible();
});

test("existing user login skips onboarding and lands on discover", async ({ page, request }) => {
  const phoneDigits = await createPhoneAccount(request);
  await page.goto("/auth?mode=login");
  await page.locator('input[placeholder="90000 00001"]').fill(phoneDigits);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();

  await expect(page).toHaveURL(/\/discover$/);
});

test("password reset verifies the code and accepts the new password", async ({ page }) => {
  const phoneDigits = uniquePhone();
  const newPassword = "TaraReset@456";
  await completePhoneAuth(page, phoneDigits);
  await page.evaluate(() => localStorage.clear());

  await page.goto("/auth?mode=forgot");
  await expect(page.getByRole("progressbar", { name: "Password reset progress" })).toHaveAttribute("aria-valuenow", "1");
  await page.locator('input[placeholder="90000 00001"]').fill(phoneDigits);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("progressbar", { name: "Password reset progress" })).toHaveAttribute("aria-valuenow", "2");

  for (const [index, digit] of [..."123456"].entries()) {
    await page.getByLabel(`Digit ${index + 1}`).fill(digit);
  }
  const passwordInput = page.getByPlaceholder("At least 8 characters");
  await passwordInput.fill(newPassword);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(passwordInput).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByText("Password reset successful. Please login.")).toBeVisible();

  await page.getByPlaceholder(/Enter your password/i).fill(newPassword);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/(welcome|onboarding|discover)$/);
});

test("full authenticated app flow across core UI scenarios", async ({ page }) => {
  await page.route("**/api/astrology/location/search/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ display_name: "New Delhi, Delhi, India", latitude: 28.6139, longitude: 77.209 }]),
  }));
  const phoneDigits = uniquePhone();
  await completePhoneAuth(page, phoneDigits);

  await expect(page).toHaveURL(/\/(welcome|profile-setup|onboarding|discover)$/);
  await completeOnboarding(page);
  await page.reload();
  await expect(page).toHaveURL(/\/discover$/);

  await page.getByRole("link", { name: /Matches/i }).click();
  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByRole("heading", { name: /Matches/i })).toBeVisible();

  await page.getByRole("link", { name: /Stars Today/i }).click();
  await expect(page).toHaveURL(/\/stars-today$/);
  await expect(page.getByRole("heading", { name: /Top Matches Today/i })).toBeVisible();

  await page.getByRole("link", { name: /Chat/i }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { name: /Conversations/i })).toBeVisible();

  await page.getByRole("link", { name: /Kundali/i }).click();
  await expect(page).toHaveURL(/\/kundali$/);
  await expect(page.getByRole("heading", { name: /Your Kundali/i })).toBeVisible();

  await page.getByRole("link", { name: /Profile/i }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: /^Profile$/i })).toBeVisible();

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: /^Logout$/i }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: /Log in/i }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.locator('input[placeholder="90000 00001"]').fill(phoneDigits);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/discover$/);

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/discover$/);
});
