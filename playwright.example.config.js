import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/example-browser',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4180',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run example:dev -- --host 127.0.0.1 --port 4180',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
    timeout: 30_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})
