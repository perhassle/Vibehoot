import { test, expect } from '@playwright/test';

test.describe('Vibehoot App', () => {

  test.describe('Landing Page', () => {
    test('should display title and navigation buttons', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('h1')).toContainText('VIBEHOOT');
      await expect(page.locator('text=Real-time quizzes')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Host a Game' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Join Game' })).toBeVisible();
    });

    test('should navigate to host dashboard', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Host a Game' }).click();
      await expect(page).toHaveURL('/host/dashboard');
    });

    test('should navigate to play page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Join Game' }).click();
      await expect(page).toHaveURL('/play');
    });
  });

  test.describe('Play Page (Join Game)', () => {
    test('should display join form', async ({ page }) => {
      await page.goto('/play');

      await expect(page.locator('h1')).toContainText('VIBEHOOT');
      await expect(page.getByPlaceholder('Game PIN')).toBeVisible();
      await expect(page.getByPlaceholder('Nickname')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    });

    test('should allow entering join code and nickname', async ({ page }) => {
      await page.goto('/play');

      await page.getByPlaceholder('Game PIN').fill('123456');
      await page.getByPlaceholder('Nickname').fill('TestPlayer');

      await expect(page.getByPlaceholder('Game PIN')).toHaveValue('123456');
      await expect(page.getByPlaceholder('Nickname')).toHaveValue('TestPlayer');
    });
  });

  test.describe('Host Dashboard', () => {
    test('should display dashboard with header and create button', async ({ page }) => {
      await page.goto('/host/dashboard');

      await expect(page.locator('h1')).toContainText('VIBEHOOT');
      await expect(page.getByText('HOST', { exact: true })).toBeVisible();
      await expect(page.locator('text=My Library')).toBeVisible();
      await expect(page.getByRole('link', { name: '+ Create New Quiz' })).toBeVisible();
    });

    test('should navigate to create quiz page', async ({ page }) => {
      await page.goto('/host/dashboard');
      await page.getByRole('link', { name: '+ Create New Quiz' }).click();
      await expect(page).toHaveURL('/host/create');
    });

    test('should show edit button for existing quizzes', async ({ page }) => {
      await page.goto('/host/dashboard');
      // If there are quizzes, the edit button should be visible
      const editButton = page.getByRole('link', { name: 'Edit' }).first();
      const quizCards = page.locator('h3');
      const count = await quizCards.count();
      if (count > 0) {
        await expect(editButton).toBeVisible();
      }
    });
  });

  test.describe('Create Quiz Page', () => {
    test('should display quiz creation form', async ({ page }) => {
      await page.goto('/host/create');

      await expect(page.getByPlaceholder('Quiz Title')).toBeVisible();
      await expect(page.getByText('Question 1')).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Add Question' })).toBeVisible();
    });

    test('should have Import JSON button', async ({ page }) => {
      await page.goto('/host/create');
      await expect(page.getByRole('button', { name: 'Import JSON' })).toBeVisible();
    });

    test('should open import modal when clicking Import JSON', async ({ page }) => {
      await page.goto('/host/create');
      await page.getByRole('button', { name: 'Import JSON' }).click();

      await expect(page.getByText('Import Questions from JSON')).toBeVisible();
      await expect(page.getByPlaceholder('Quiz Title (required)')).toBeVisible();
      await expect(page.locator('textarea')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Import Questions' })).toBeVisible();
    });

    test('should import questions from valid JSON with title', async ({ page }) => {
      await page.goto('/host/create');
      await page.getByRole('button', { name: 'Import JSON' }).click();

      const testJson = JSON.stringify([
        {
          question: "What is SEO?",
          options: ["Search Engine Optimization", "Social Email Outreach", "Simple Easy Output", "Search Every Option"],
          correct_index: 0
        },
        {
          question: "What is a backlink?",
          options: ["A link from your site", "A link from another site to yours", "A broken link", "A navigation link"],
          correct_index: 1
        }
      ]);

      await page.getByPlaceholder('Quiz Title (required)').fill('SEO Quiz');
      await page.locator('textarea').fill(testJson);
      await page.getByRole('button', { name: 'Import Questions' }).click();

      // Modal should close
      await expect(page.getByText('Import Questions from JSON')).not.toBeVisible();

      // Title should be set
      await expect(page.getByPlaceholder('Enter Quiz Title...')).toHaveValue('SEO Quiz');

      // Questions should be imported
      await expect(page.getByText('Question 1')).toBeVisible();
      await expect(page.getByText('Question 2')).toBeVisible();
      await expect(page.locator('input[value="What is SEO?"]')).toBeVisible();
      await expect(page.locator('input[value="What is a backlink?"]')).toBeVisible();
    });

    test('should show error when title is missing', async ({ page }) => {
      await page.goto('/host/create');
      await page.getByRole('button', { name: 'Import JSON' }).click();

      const testJson = JSON.stringify([{ question: "Test?", options: ["A", "B", "C", "D"], correct_index: 0 }]);
      await page.locator('textarea').fill(testJson);
      await page.getByRole('button', { name: 'Import Questions' }).click();

      // Should show error about missing title
      await expect(page.locator('text=Quiz title is required')).toBeVisible();
      await expect(page.getByText('Import Questions from JSON')).toBeVisible();
    });

    test('should show error for invalid JSON', async ({ page }) => {
      await page.goto('/host/create');
      await page.getByRole('button', { name: 'Import JSON' }).click();

      await page.getByPlaceholder('Quiz Title (required)').fill('Test Quiz');
      await page.locator('textarea').fill('not valid json');

      // Should show invalid status
      await expect(page.locator('text=Invalid JSON format')).toBeVisible();
    });

    test('should close modal when clicking Cancel', async ({ page }) => {
      await page.goto('/host/create');
      await page.getByRole('button', { name: 'Import JSON' }).click();
      await expect(page.getByText('Import Questions from JSON')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Import Questions from JSON')).not.toBeVisible();
    });
  });

  test.describe('Full Game Flow E2E', () => {
    test('should create quiz, host game, and have 2 players join simultaneously', async ({ browser }) => {
      test.setTimeout(120000); // 2 minutes for this long E2E test

      // Use unique quiz name to avoid conflicts
      const quizName = `E2E Test Quiz ${Date.now()}`;

      // Step 1: Create a quiz with questions using host browser
      const hostContext = await browser.newContext();
      const hostPage = await hostContext.newPage();

      await hostPage.goto('/host/create');

      // Import questions via JSON
      await hostPage.getByRole('button', { name: 'Import JSON' }).click();

      const testQuestions = JSON.stringify([
        {
          question: "What is 2 + 2?",
          options: ["3", "4", "5", "6"],
          correct_index: 1
        },
        {
          question: "What color is the sky?",
          options: ["Green", "Red", "Blue", "Yellow"],
          correct_index: 2
        }
      ]);

      await hostPage.getByPlaceholder('Quiz Title (required)').fill(quizName);
      await hostPage.locator('textarea').fill(testQuestions);
      await hostPage.getByRole('button', { name: 'Import Questions' }).click();

      // Save the quiz
      await hostPage.getByRole('button', { name: 'Save Quiz' }).click();

      // Wait for redirect to dashboard
      await expect(hostPage).toHaveURL('/host/dashboard', { timeout: 10000 });

      // Assert that the quiz was saved successfully and appears in the dashboard
      await expect(hostPage.getByText(quizName)).toBeVisible();

      // Step 2: Find the created quiz and start hosting
      await expect(hostPage.getByText(quizName)).toBeVisible();

      // Step 2: Find the created quiz and start hosting
      // Find the quiz card containing our quiz and click its Host Game link
      const quizCard = hostPage.locator('[class*="quizCard"]').filter({ hasText: quizName });
      await quizCard.getByRole('link', { name: 'Host Game' }).click();

      // Wait for game page to load and get the join code
      await hostPage.waitForURL(/\/host\/game\//, { timeout: 10000 });

      // Extract quiz ID from URL for cleanup later
      const gameUrl = hostPage.url();
      const quizId = gameUrl.match(/\/host\/game\/([^/]+)/)?.[1] || '';

      await expect(hostPage.locator('text=JOIN AT')).toBeVisible({ timeout: 10000 });

      // Wait for the join code to appear (6 digits, not "...")
      const joinCodeLocator = hostPage.locator('[class*="joinCode"]');
      await expect(joinCodeLocator).not.toHaveText('...', { timeout: 10000 });

      // Get the join code from the page
      const joinCodeElement = await joinCodeLocator.textContent();
      const joinCode = joinCodeElement?.replace(/\s/g, '') || '';
      expect(joinCode).toMatch(/^\d{6}$/);

      // Step 3: Create two player browsers and join simultaneously
      const player1Context = await browser.newContext();
      const player1Page = await player1Context.newPage();

      const player2Context = await browser.newContext();
      const player2Page = await player2Context.newPage();

      // Both players navigate to play page
      await Promise.all([
        player1Page.goto('/play'),
        player2Page.goto('/play')
      ]);

      // Both players fill in join code and nickname
      await Promise.all([
        (async () => {
          await player1Page.getByPlaceholder('Game PIN').fill(joinCode);
          await player1Page.getByPlaceholder('Nickname').fill('Player1');
          await player1Page.getByRole('button', { name: 'Join Game' }).click();
        })(),
        (async () => {
          await player2Page.getByPlaceholder('Game PIN').fill(joinCode);
          await player2Page.getByPlaceholder('Nickname').fill('Player2');
          await player2Page.getByRole('button', { name: 'Join Game' }).click();
        })()
      ]);

      // Verify both players see waiting screen
      await expect(player1Page.getByText("You're in!")).toBeVisible({ timeout: 10000 });
      await expect(player2Page.getByText("You're in!")).toBeVisible({ timeout: 10000 });

      // Verify host sees both players in lobby
      await expect(hostPage.getByText('Player1')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByText('Player2')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByText('2 Players')).toBeVisible();

      // Step 4: Host starts the game
      await hostPage.getByRole('button', { name: 'Start Game' }).click();

      // Verify host sees first question
      await expect(hostPage.getByText('Question 1 of 2')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByText('What is 2 + 2?')).toBeVisible();

      // Verify players see answer buttons
      await expect(player1Page.locator('[class*="answerBtn"]').first()).toBeVisible({ timeout: 10000 });
      await expect(player2Page.locator('[class*="answerBtn"]').first()).toBeVisible({ timeout: 10000 });

      // Step 5: Both players submit answers (Player1 correct, Player2 wrong)
      // Answer buttons are in order: 0=red, 1=blue, 2=yellow, 3=green
      // Correct answer is index 1 (4), so click second button
      await player1Page.locator('[class*="answerBtn"]').nth(1).click(); // Correct (4)
      await player2Page.locator('[class*="answerBtn"]').nth(0).click(); // Wrong (3)

      // Verify players see their results
      await expect(player1Page.getByText('Correct!')).toBeVisible({ timeout: 10000 });
      await expect(player2Page.getByText('Wrong!')).toBeVisible({ timeout: 10000 });

      // Host should see answer count
      await expect(hostPage.getByText('2 / 2 answered')).toBeVisible({ timeout: 10000 });

      // Step 6: Host skips timer and shows results
      await hostPage.getByRole('button', { name: 'Skip Timer' }).click();

      // Verify results view
      await expect(hostPage.getByText('Results')).toBeVisible({ timeout: 10000 });

      // Step 7: Host shows leaderboard
      await hostPage.getByRole('button', { name: 'Show Leaderboard' }).click();

      // Verify leaderboard is shown
      await expect(hostPage.getByText('Leaderboard')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByText('#1')).toBeVisible();

      // Step 8: Continue to next question
      await hostPage.getByRole('button', { name: 'Next Question' }).click();

      // Verify second question
      await expect(hostPage.getByText('Question 2 of 2')).toBeVisible({ timeout: 10000 });
      await expect(hostPage.getByText('What color is the sky?')).toBeVisible();

      // Both players answer (both correct this time)
      await player1Page.locator('[class*="answerBtn"]').nth(2).click(); // Blue (correct)
      await player2Page.locator('[class*="answerBtn"]').nth(2).click(); // Blue (correct)

      // Verify both correct
      await expect(player1Page.getByText('Correct!')).toBeVisible({ timeout: 10000 });
      await expect(player2Page.getByText('Correct!')).toBeVisible({ timeout: 10000 });

      // Host ends the game
      await hostPage.getByRole('button', { name: 'Skip Timer' }).click();
      await expect(hostPage.getByText('Results')).toBeVisible({ timeout: 10000 });

      await hostPage.getByRole('button', { name: 'Show Leaderboard' }).click();
      await expect(hostPage.getByText('Leaderboard')).toBeVisible({ timeout: 10000 });

      // Next question should end the game
      await hostPage.getByRole('button', { name: 'Next Question' }).click();

      // Verify game over screen
      await expect(hostPage.getByText('Game Over!')).toBeVisible({ timeout: 10000 });

      // Players should also see game ended
      await expect(player1Page.getByText('Game Over!')).toBeVisible({ timeout: 10000 });
      await expect(player2Page.getByText('Game Over!')).toBeVisible({ timeout: 10000 });

      // Close player contexts
      await player1Context.close();
      await player2Context.close();

      // Cleanup: Delete the test quiz via API (more reliable than UI)
      try {
        if (quizId) {
          await hostPage.request.delete(`/api/quizzes/${quizId}`);
        }
      } finally {
        await hostContext.close();
      }
    });
  });
});
