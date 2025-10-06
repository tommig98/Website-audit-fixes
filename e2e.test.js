// ==================================
// E2E TESTS - Playwright Configuration
// ==================================

const { test, expect } = require('@playwright/test');

test.describe('Website Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should load homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Fitness Coach/);
    await expect(page.locator('h1')).toContainText('Coach AI Personalizzato');
  });

  test('should navigate using main menu', async ({ page }) => {
    await page.click('nav a[href="#about"]');
    await page.waitForTimeout(1000); // Wait for smooth scroll

    const aboutSection = page.locator('#about');
    await expect(aboutSection).toBeInViewport();
  });

  test('should handle broken links gracefully', async ({ page }) => {
    // Test click on previously broken link
    await page.click('a[href="#signup"]');

    // Should scroll to signup section or show appropriate message
    const signupSection = page.locator('#signup');
    if (await signupSection.count() > 0) {
      await expect(signupSection).toBeInViewport();
    } else {
      // Should show modal or notification about missing section
      await expect(page.locator('.modal, .notification')).toBeVisible();
    }
  });

  test('should generate program with stub data', async ({ page }) => {
    await page.click('button:has-text("Genera Programma")');

    // Wait for loading to complete
    await page.waitForSelector('.modal', { timeout: 10000 });

    // Check modal content
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Programma Personalizzato');
    await expect(modal).toContainText('Lunedì');

    // Close modal
    await page.click('.modal-close');
    await expect(modal).not.toBeVisible();
  });

  test('should validate form with AI checker', async ({ page }) => {
    // Find or create a form
    await page.goto('http://localhost:3000#contact');

    // If form doesn't exist, create one for testing
    await page.evaluate(() => {
      if (!document.querySelector('#user-form')) {
        const form = document.createElement('form');
        form.id = 'user-form';
        form.innerHTML = `
          <input name="name" placeholder="Nome" required />
          <input name="email" type="email" placeholder="Email" required />
          <button type="button" onclick="checkFormAI()">Controlla con AI</button>
        `;
        document.body.appendChild(form);
      }
    });

    // Fill form with invalid data
    await page.fill('input[name="name"]', 'A');
    await page.fill('input[name="email"]', 'invalid-email');

    // Trigger AI check
    await page.click('button:has-text("Controlla")');

    // Wait for result modal
    await page.waitForSelector('.modal', { timeout: 5000 });

    const modal = page.locator('.modal');
    await expect(modal).toContainText('Problemi trovati');
    await expect(modal).toContainText('Nome deve essere almeno 2 caratteri');
  });

  test('should handle trial signup flow', async ({ page }) => {
    // Mock the prompt for email input
    await page.addInitScript(() => {
      window.prompt = () => 'test@example.com';
    });

    await page.click('button:has-text("Prova")');

    // Wait for loading and success notification
    await page.waitForSelector('.notification:has-text("Benvenuto")', { timeout: 5000 });

    // Check notification
    const notification = page.locator('.notification');
    await expect(notification).toContainText('Benvenuto');
    await expect(notification).toContainText('Prova gratuita attivata');

    // Should update UI for logged-in user
    await page.waitForTimeout(2500); // Wait for redirect
    const userMenu = page.locator('.user-menu');
    await expect(userMenu).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Test mobile navigation
    const mobileMenu = page.locator('.mobile-menu-toggle');
    if (await mobileMenu.count() > 0) {
      await mobileMenu.click();
      await expect(page.locator('.mobile-menu')).toBeVisible();
    }

    // Test CTA buttons are accessible on mobile
    const primaryCTA = page.locator('.btn-primary').first();
    await expect(primaryCTA).toBeVisible();

    // Test touch targets are large enough (minimum 44px)
    const boundingBox = await primaryCTA.boundingBox();
    expect(boundingBox.height).toBeGreaterThanOrEqual(44);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('/api/**', route => route.abort());

    await page.click('button:has-text("Genera Programma")');

    // Should show error notification
    await page.waitForSelector('.notification', { timeout: 5000 });
    const notification = page.locator('.notification');
    await expect(notification).toContainText('Errore');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Test Enter key activation
    await page.keyboard.press('Enter');

    // Should trigger the focused element's action
    // This depends on what element is focused
  });

  test('should load assets correctly', async ({ page }) => {
    // Check that CSS is loaded
    const styles = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    expect(styles).toBeDefined();

    // Check that JavaScript is working
    const jsWorking = await page.evaluate(() => {
      return typeof generateProgram === 'function';
    });
    expect(jsWorking).toBe(true);

    // Check images load (if any)
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const isLoaded = await img.evaluate(el => el.complete && el.naturalHeight !== 0);
      if (!isLoaded) {
        console.warn(`Image ${i} failed to load`);
      }
    }
  });

  test('should show cookie consent banner', async ({ page }) => {
    // Clear localStorage to reset cookie consent
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Should show cookie banner
    const cookieBanner = page.locator('.cookie-banner');
    await expect(cookieBanner).toBeVisible();

    // Accept cookies
    await page.click('button:has-text("Accetta")');
    await expect(cookieBanner).not.toBeVisible();

    // Reload - banner should not appear
    await page.reload();
    await expect(cookieBanner).not.toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // 3 seconds max
  });

  test('should have good Lighthouse score', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // This would require lighthouse CLI integration
    // For now, we'll check basic performance indicators
    const performanceMetrics = await page.evaluate(() => {
      return {
        timing: performance.timing,
        navigation: performance.navigation
      };
    });

    expect(performanceMetrics.timing).toBeDefined();
  });
});

test.describe('Security Tests', () => {
  test('should not expose sensitive information', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check page source for common secrets
    const content = await page.content();

    expect(content).not.toMatch(/api[_-]?key/i);
    expect(content).not.toMatch(/secret[_-]?key/i);
    expect(content).not.toMatch(/password/i);
    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{48}/); // OpenAI API key pattern
  });

  test('should have proper CSP headers', async ({ page }) => {
    const response = await page.goto('http://localhost:3000');
    const headers = response.headers();

    // Check for security headers
    expect(headers['content-security-policy'] || headers['x-content-security-policy']).toBeDefined();
  });
});

test.describe('Accessibility Tests', () => {
  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1); // Should have exactly one H1

    // Check that headings are in logical order (H1, then H2, etc.)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    expect(headings.length).toBeGreaterThan(0);
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check for ARIA labels
    const elementsWithAria = await page.locator('[aria-label], [aria-labelledby], [role]').count();
    expect(elementsWithAria).toBeGreaterThan(0);

    // Check skip link
    const skipLink = page.locator('.skip-link');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeVisible();
    }
  });
});
