import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const EXISTING_USER_PHONE = "9000000001";

function uniquePhone() {
  return `9${Date.now().toString().slice(-9)}`;
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
  await clickEnabledContinue(page);

  await expect(page.getByRole("heading", { name: /Time of birth/i })).toBeVisible();
  await clickEnabledContinue(page);

  await expect(page.getByRole("heading", { name: /Add your photos/i })).toBeVisible();
  const imagePath = path.resolve(__dirname, "../../src/assets/profile-1.png");
  await page.locator('input[type="file"]').first().setInputFiles(imagePath);
  await clickEnabledContinue(page);

  for (let i = 0; i < 3; i += 1) {
    const continueButton = page.getByRole("button", { name: /Continue/i });
    const optionButtons = page.locator("button.tara-option-card:visible");
    await expect(optionButtons.first()).toBeVisible();

    const totalOptions = await optionButtons.count();
    for (let index = 0; index < totalOptions; index += 1) {
      await optionButtons.nth(index).click();
      if (await continueButton.isEnabled()) {
        break;
      }
    }

    await clickEnabledContinue(page);
  }

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

test("signup route detects an existing number and switches to login", async ({ page }) => {
  await page.goto("/auth?mode=signup");
  await page.locator('input[placeholder="98765 43210"]').fill(EXISTING_USER_PHONE);
  await page.getByRole("button", { name: /Continue/i }).click();

  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByText(/already has an account/i)).toBeVisible();
  await expect(page.getByPlaceholder(/Enter your password/i)).toBeVisible();
});

test("existing user login skips onboarding and lands on discover", async ({ page }) => {
  await page.goto("/auth?mode=login");
  await page.locator('input[placeholder="90000 00001"]').fill(EXISTING_USER_PHONE);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();

  await expect(page).toHaveURL(/\/discover$/);
});

test("full authenticated app flow across core UI scenarios", async ({ page }) => {
  const phoneDigits = uniquePhone();
  await completePhoneAuth(page, phoneDigits);

  await expect(page).toHaveURL(/\/(welcome|profile-setup|onboarding|discover)$/);
  await completeOnboarding(page);
  await page.reload();
  await expect(page).toHaveURL(/\/discover$/);

  await page.getByRole("link", { name: /Matches/i }).click();
  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByRole("heading", { name: /Matches/i })).toBeVisible();

  await page.getByRole("link", { name: /Chat/i }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { name: /Conversations/i })).toBeVisible();

  await page.getByRole("link", { name: /Kundali/i }).click();
  await expect(page).toHaveURL(/\/kundali$/);
  await expect(page.getByRole("heading", { name: /Your Kundali/i })).toBeVisible();

  await page.getByRole("link", { name: /Profile/i }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: /^Profile$/i })).toBeVisible();

  await page.getByRole("button", { name: /Tara Celestial/i }).click();
  await expect(page).toHaveURL(/\/stars-today$/);
  await expect(page.getByRole("heading", { name: /Top Matches Today/i })).toBeVisible();

  await page.getByRole("link", { name: /Profile/i }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("link", { name: /Settings/i }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: /^Logout$/i }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: /I already have an account/i }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.locator('input[placeholder="90000 00001"]').fill(phoneDigits);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/discover$/);

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/discover$/);
});
