import { test, expect } from '@playwright/test';

// The chatbot widget lives in the citizen portal layout.
// Uses citizen auth (chromium-citizen project).

const CHATBOT_CONTAINER = '.fixed.bottom-4.right-4';

test.describe('AI Chatbot Widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ro/portal/dashboard');
    await expect(page.locator('main')).toBeVisible();
  });

  test('chatbot toggle button is visible', async ({ page }) => {
    // The toggle is a round button with MessageCircle icon at bottom-right
    const toggle = page.locator(`${CHATBOT_CONTAINER} button`).last();
    await expect(toggle).toBeVisible();
  });

  test('chatbot opens and shows welcome message', async ({ page }) => {
    // Click the toggle button (it's the last button in the container when closed)
    await page.locator(`${CHATBOT_CONTAINER} button`).last().click();

    // Welcome message from t("welcome") should appear
    // The Card becomes visible (opacity-100)
    await expect(
      page.locator(`${CHATBOT_CONTAINER}`).getByText(/Bun[aă]|asistent/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('chatbot shows suggested questions', async ({ page }) => {
    await page.locator(`${CHATBOT_CONTAINER} button`).last().click();

    // Suggested questions are rendered as small rounded-full buttons
    const suggestions = page.locator(`${CHATBOT_CONTAINER} .rounded-full`);
    await expect(suggestions.first()).toBeVisible({ timeout: 10000 });
  });

  test('send a message and receive AI response', async ({ page }) => {
    test.setTimeout(60000);

    await page.locator(`${CHATBOT_CONTAINER} button`).last().click();

    // Wait for welcome message
    await expect(
      page.locator(`${CHATBOT_CONTAINER}`).getByText(/Bun[aă]|asistent/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Find the input field (Input component with placeholder from t("placeholder"))
    const chatInput = page.locator(`${CHATBOT_CONTAINER} input`);
    await expect(chatInput).toBeVisible();

    // Type a tax question
    const question = 'Care este termenul de plata?';
    await chatInput.fill(question);

    // Click the send button (the button next to the input, has Send icon)
    const sendButton = page.locator(`${CHATBOT_CONTAINER} .border-t button`);
    await sendButton.click();

    // Wait for loading spinner to appear then disappear (AI response via gateway)
    await expect(
      page.locator(`${CHATBOT_CONTAINER} .animate-spin`)
    ).toBeVisible({ timeout: 5000 }).catch(() => {});

    // Wait for AI response (bot message with relevant content)
    const botMessages = page.locator(`${CHATBOT_CONTAINER} .bg-white.border.rounded-2xl`);
    // Should have at least 2 bot messages (welcome + response)
    await expect(botMessages.nth(1)).toBeVisible({ timeout: 45000 });
  });

  test('chatbot can be closed', async ({ page }) => {
    // Open
    await page.locator(`${CHATBOT_CONTAINER} button`).last().click();

    // Wait for chat to be visible
    await expect(
      page.locator(`${CHATBOT_CONTAINER}`).getByText(/Bun[aă]|asistent/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Click the X close button (in the header bar, ghost variant button)
    const closeButton = page.locator(`${CHATBOT_CONTAINER} .border-b button`);
    await closeButton.click();

    // After closing, the toggle button should reappear
    await expect(
      page.locator(`${CHATBOT_CONTAINER} .rounded-full`).last()
    ).toBeVisible({ timeout: 5000 });
  });
});
