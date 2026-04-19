import { expect, test } from "@playwright/test";

function uniquePhone() {
  return `9${Date.now().toString().slice(-9)}`;
}

async function completePhoneAuth(page, phoneDigits) {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/auth$/);

  await page.locator('input[placeholder="98765 43210"]').fill(phoneDigits);
  await page.getByRole("button", { name: /Send code/i }).click();
  await expect(page.getByText("Step 2 of 2")).toBeVisible();

  const otp = "123456";
  for (let i = 0; i < otp.length; i += 1) {
    await page.getByLabel(`Digit ${i + 1}`).fill(otp[i]);
  }
}

async function completeOnboarding(page) {
  if (page.url().includes("/discover")) {
    return;
  }

  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: /Begin/i }).click();
  }

  await expect(page).toHaveURL(/\/profile-setup$/);

  await page.getByPlaceholder("Your name").fill("E2E Tara User");
  await page.getByRole("button", { name: /Continue/i }).click();

  await page.locator('input[type="date"]').fill("1996-05-21");
  await page.getByRole("button", { name: /Continue/i }).click();

  await page.getByRole("button", { name: "Woman" }).click();
  await page.getByRole("button", { name: /Continue/i }).click();

  await page.getByRole("button", { name: "Everyone" }).click();
  await page.getByRole("button", { name: /Continue/i }).click();

  await page.getByRole("button", { name: /Use my current location/i }).click();
  await page.getByRole("button", { name: /Continue/i }).click();

  await page.locator('input[type="time"]').fill("09:30");
  await page.getByRole("button", { name: /Continue/i }).click();

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

    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  }

  await page.getByRole("button", { name: /Find my matches/i }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("unauthenticated users are redirected from protected routes", async ({ page }) => {
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/auth$/);
});

test("full authenticated app flow across core UI scenarios", async ({ page }) => {
  await completePhoneAuth(page, uniquePhone());

  await expect(page).toHaveURL(/\/(welcome|profile-setup|discover)$/);
  await completeOnboarding(page);

  await page.getByRole("link", { name: /Matches/i }).click();
  await expect(page).toHaveURL(/\/matches$/);

  await page.goto("/matches/1");
  await expect(page.getByRole("link", { name: /Start chatting/i })).toBeVisible();
  await page.getByRole("link", { name: /Start chatting/i }).click();
  await expect(page).toHaveURL(/\/chat\/1$/);
  await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

  await page.getByRole("link", { name: /Kundali/i }).click();
  await expect(page).toHaveURL(/\/kundali$/);

  await page.getByRole("link", { name: /Profile/i }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole("button", { name: /Tara Celestial/i }).click();
  await expect(page).toHaveURL(/\/stars-today$/);

  await page.getByRole("link", { name: /Profile/i }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("link", { name: /Settings/i }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: /^Logout$/i }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/auth$/);
});
