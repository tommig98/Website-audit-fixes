module.exports = {
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...require('@playwright/test').devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...require('@playwright/test').devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...require('@playwright/test').devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...require('@playwright/test').devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...require('@playwright/test').devices['iPhone 12'] }
    }
  ],
  webServer: {
    command: 'npm run serve',
    port: 3000
  }
};
