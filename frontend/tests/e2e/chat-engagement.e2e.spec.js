import { expect, test } from "@playwright/test";

test("chat keeps the shared moment and makes replies, reactions, and games easy to use", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("tara_access_token", "test-token");
    localStorage.setItem("tara_user", JSON.stringify({ id: 1, name: "Member" }));
    localStorage.setItem("tara_onboarding_profile_v2", JSON.stringify({
      completed: true, basicSaved: true, birthSaved: true, __ownerUserId: "1",
    }));
  });

  const history = [
    { id: 10, sender_id: 2, content: "Your Game Night moment", message_type: "game_event",
      game_payload: { event_type: "game_night_memory", game_name: "Split Clue", detail: "You solved the mystery together.", prompt: "What mystery should you solve next?" },
      timestamp: "2026-10-29T12:00:00Z", status: "delivered", reactions: {} },
    { id: 11, sender_id: 2, content: "That was fun!", message_type: "text", game_payload: {},
      timestamp: "2026-10-29T12:01:00Z", status: "delivered", reactions: {} },
  ];
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/matches/41/")) return route.fulfill({ json: { match_id: 41, user: { id: 2, name: "Your match" }, insight: "A good connection." } });
    if (url.endsWith("/matches/41/icebreakers/")) return route.fulfill({ json: { suggestions: ["What mystery should we solve next?"] } });
    if (url.endsWith("/chat/41/messages/") && route.request().method() === "GET") return route.fulfill({ json: history });
    if (url.endsWith("/chat/41/message/") && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const created = { id: 12, sender_id: 1, content: body.content, message_type: "text", game_payload: {},
        reply_to: { id: 11, sender_id: 2, content: "That was fun!" }, reactions: {},
        timestamp: "2026-10-29T12:02:00Z", status: "delivered", client_message_id: body.client_message_id };
      history.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (url.endsWith("/chat/41/messages/11/reaction/") && route.request().method() === "POST") {
      history[1].reactions = { "❤️": [1] };
      return route.fulfill({ json: { message_id: 11, reactions: history[1].reactions } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/chat/41");
  await expect(page.getByRole("heading", { name: "Split Clue" })).toBeVisible();
  await page.getByRole("button", { name: /What mystery should you solve next/ }).click();
  await expect(page.getByPlaceholder("Type a message...")).toHaveValue("What mystery should you solve next?");

  await page.getByRole("button", { name: "Open games" }).click();
  await expect(page.getByRole("button", { name: "Surprise us" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tic Tac Toe" })).toHaveCount(0);
  await page.getByRole("button", { name: "See all games" }).click();
  for (const gameName of [
    "This or That", "Guess Their Pick", "Build a Story", "Two Truths & a Lie",
    "Choose Your Adventure", "Rank These", "Would You Rather?", "Caption This",
    "Tic Tac Toe", "Dots and Boxes", "Pictionary", "Word Search", "Unscramble",
    "Emoji Decode", "Cipher Breaker", "Photo Scavenger Hunt", "Word Association",
    "Secret Song Pick", "Collaborative Playlist", "Mystery Playlist Mood",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(gameName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })).toBeVisible();
  }
  await page.getByRole("button", { name: "Close games" }).click();

  await page.getByRole("button", { name: "Reply to message" }).click();
  await expect(page.getByText("Replying to Your match")).toBeVisible();
  await page.getByPlaceholder("Type a message...").fill("It was!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("It was!", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "React to message" }).first().click();
  await page.getByRole("button", { name: "React ❤️" }).click();
  await expect(page.getByRole("button", { name: "❤️ reaction, 1" })).toBeVisible();
});

test("chat keeps a stable retry key when message delivery fails", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("tara_access_token", "test-token");
    localStorage.setItem("tara_user", JSON.stringify({ id: 1, name: "Member" }));
    localStorage.setItem("tara_onboarding_profile_v2", JSON.stringify({
      completed: true, basicSaved: true, birthSaved: true, __ownerUserId: "1",
    }));
    class ClosedSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      constructor() {
        this.readyState = ClosedSocket.CONNECTING;
        setTimeout(() => {
          this.readyState = ClosedSocket.CLOSED;
          this.onclose?.({ code: 1006 });
        }, 10);
      }
      send() {}
      close() { this.readyState = ClosedSocket.CLOSED; }
    }
    window.WebSocket = ClosedSocket;
  });

  const clientMessageIds = [];
  let attempts = 0;
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/matches/41/")) return route.fulfill({ json: { match_id: 41, user: { id: 2, name: "Your match" } } });
    if (url.endsWith("/matches/41/icebreakers/")) return route.fulfill({ json: { suggestions: [] } });
    if (url.endsWith("/chat/41/messages/")) return route.fulfill({ json: [] });
    if (url.endsWith("/chat/41/message/") && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      clientMessageIds.push(body.client_message_id);
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 503, json: { detail: "Temporary chat outage" } });
      return route.fulfill({ status: 201, json: {
        id: 13, sender_id: 1, content: body.content, client_message_id: body.client_message_id,
        message_type: "text", game_payload: {}, reactions: {}, status: "delivered", is_read: false,
      } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("/chat/41");
  await page.getByPlaceholder("Type a message...").fill("Retry this message");
  await page.getByRole("button", { name: /^Send$/i }).click();
  await expect(page.getByPlaceholder("Type a message...")).toHaveValue("Retry this message");
  await expect(page.getByText("Could not send your message right now. Please try again.")).toBeVisible();

  await page.getByRole("button", { name: /^Send$/i }).click();
  await expect(page.getByText("Retry this message", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(clientMessageIds[0]).toBeTruthy();
  expect(clientMessageIds[1]).toBe(clientMessageIds[0]);
  await expect(page.getByText("Retry this message", { exact: true })).toHaveCount(1);
});
