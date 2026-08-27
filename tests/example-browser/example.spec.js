import { expect, test } from '@playwright/test'

test('loads the published package runtime and prepares the bundled MP4', async ({ page }) => {
  const manifestResponse = page.waitForResponse(
    (response) => response.url().endsWith('/assets/libmedia-avp/manifest.json')
  )

  await page.goto('/')

  await expect(page.getByRole('heading', { name: '发布包运行示例' })).toBeVisible()
  await expect(page.locator('[data-example-state]')).toHaveText(
    /ready|playing|ended/
  )
  const response = await manifestResponse
  expect(response.status()).toBe(200)
})
