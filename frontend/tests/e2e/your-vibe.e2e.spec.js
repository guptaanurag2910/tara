import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8000/api";
const PASSWORD = process.env.VITE_PHONE_AUTH_PASSWORD || "TaraDemo@123";

async function createMember(request) {
  const response = await request.post(`${API_BASE}/auth/signup/`, {
    data: {
      name: "Vibe Explorer", email: `vibe.explorer.${Date.now()}@tara.demo`, password: PASSWORD,
      date_of_birth: "1997-01-01", gender: "other", preference: "everyone",
      birth_place: "Bengaluru", latitude: "12.971600", longitude: "77.594600",
      is_birth_time_default: true,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function seedSession(page, auth, completed) {
  await page.goto("/");
  await page.evaluate(({ session, onboardingComplete }) => {
    localStorage.setItem("tara_access_token", session.access);
    localStorage.setItem("tara_refresh_token", session.refresh);
    localStorage.setItem("tara_user", JSON.stringify(session.user));
    localStorage.setItem("tara_onboarding_profile_v2", JSON.stringify({
      name: session.user.name, date_of_birth: session.user.date_of_birth,
      gender: session.user.gender, preference: session.user.preference,
      birth_place: "Bengaluru", latitude: "12.971600", longitude: "77.594600",
      birth_time: "09:30", basicSaved: true, birthSaved: true,
      currentStep: 6, photos: [{ id: "local-photo", src: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" }],
      responsesByQuestion: { 1: 5 }, personalityAnswers: { 1: 5 },
      personalityScores: { openness: 10 }, personalityTestStatus: "completed",
      completed: onboardingComplete, __ownerUserId: String(session.user.id),
    }));
  }, { session: auth, onboardingComplete: completed });
}

test("Photos completes onboarding without the personality questionnaire", async ({ page, request }) => {
  const auth = await createMember(request);
  await seedSession(page, auth, false);
  await page.goto("/onboarding");
  await expect(page.getByText("7 of 7")).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish setup" })).toBeEnabled();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByText("Get to know yourself a little better")).toHaveCount(0);
});

test("Photos to Discover to Your Vibe resumes and finishes for the same member", async ({ page, request }) => {
  test.setTimeout(180_000);
  const auth = await createMember(request);
  await seedSession(page, auth, false);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/onboarding");
  await expect(page.getByText("7 of 7")).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await page.goto("/profile");
  await page.getByRole("link", { name: "Explore Your Vibe" }).click();
  await expect(page.getByRole("button", { name: "Start personality test" })).toBeVisible();

  const headers = { Authorization: `Bearer ${auth.access}` };
  const questionResponse = await request.get(`${API_BASE}/personality/questions/`, { headers });
  expect(questionResponse.status()).toBe(200);
  const questions = await questionResponse.json();
  expect(questions).toHaveLength(60);

  await page.getByRole("button", { name: "Start personality test" }).click();
  await expect(page.locator(".vibe-question-row")).toHaveCount(1);
  const firstQuestion = page.locator(".vibe-question-row");
  await expect(firstQuestion.getByText(questions[0].question_text)).toBeVisible();
  await expect(firstQuestion.locator(".vibe-scale-option").first()).toHaveAttribute("aria-label", `Strongly disagree for ${questions[0].question_text}`);
  await expect(firstQuestion.locator(".vibe-scale-option").last()).toHaveAttribute("aria-label", `Strongly agree for ${questions[0].question_text}`);
  await expect(page.locator(".tara-fixed-nav")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Test progress" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next question" })).toBeDisabled();
  await expect(page.locator(".tara-vibe")).toHaveCSS("max-width", "460px");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  const firstAnswer = firstQuestion.getByRole("button", { name: `Strongly agree for ${questions[0].question_text}` });
  await firstAnswer.click();
  await expect(firstAnswer).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("progressbar", { name: "Test progress" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.locator(".vibe-question-row")).toContainText(questions[1].question_text);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(firstQuestion.getByText(questions[0].question_text)).toBeVisible();
  await expect(firstQuestion.getByRole("button", { name: `Strongly agree for ${questions[0].question_text}` })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.locator(".vibe-quiz-progress")).toBeInViewport();
  await page.getByRole("button", { name: "Save and leave" }).click();
  await expect(page).toHaveURL(/\/profile$/);

  const summaryResponse = await request.get(`${API_BASE}/profile/me/`, { headers });
  expect(summaryResponse.status()).toBe(200);
  expect((await summaryResponse.json()).personality_responses).toHaveLength(1);

  await page.goto("/your-vibe");
  await expect(page.getByRole("button", { name: "Continue test" })).toBeVisible();
  await page.getByRole("button", { name: "Continue test" }).click();
  await expect(page.locator(".vibe-question-row")).toContainText(questions[1].question_text);
  for (let index = 1; index < questions.length; index += 1) {
    const question = questions[index];
    const answer = page.locator(".vibe-question-row").getByRole("button", {
      name: `${question.options[0].option_text} for ${question.question_text}`,
      exact: true,
    });
    await expect(page.locator(".vibe-question-row")).toContainText(question.question_text);
    await answer.click();
    await expect(answer).toHaveAttribute("aria-pressed", "true");
    if (index < questions.length - 1) await page.getByRole("button", { name: "Next question" }).click();
  }
  await expect(page.getByRole("progressbar", { name: "Test progress" })).toHaveAttribute("aria-valuenow", "60");
  await page.getByRole("button", { name: "See results" }).click();
  await expect(page.getByRole("heading", { name: "A little more about you" })).toBeVisible();
  await expect(page.locator(".vibe-trait")).toHaveCount(5);
  const completedResponse = await request.get(`${API_BASE}/profile/me/`, { headers });
  expect(completedResponse.status()).toBe(200);
  expect((await completedResponse.json()).personality_responses).toHaveLength(60);
  await page.reload();
  await expect(page.getByRole("heading", { name: "A little more about you" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
