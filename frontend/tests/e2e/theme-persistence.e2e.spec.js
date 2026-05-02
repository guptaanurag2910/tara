import { expect, test } from "@playwright/test";

const PHONE_AUTH_PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";
const EXISTING_USER_PHONE = "9000000001";

async function loginExistingUser(page) {
  await page.goto("/auth?mode=login");
  await page.locator('input[placeholder="90000 00001"]').fill(EXISTING_USER_PHONE);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("theme choice survives refresh and login/logout transitions", async ({ page }) => {
  await loginExistingUser(page);

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: /^Day$/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /^Logout$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("link", { name: /I already have an account/i }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.locator('input[placeholder="90000 00001"]').fill(EXISTING_USER_PHONE);
  await page.getByPlaceholder(/Enter your password/i).fill(PHONE_AUTH_PASSWORD);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
