import { expect, test } from '@playwright/test'

async function capturePageErrors(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.__libmediaUnhandledRejections = []
    window.addEventListener('unhandledrejection', (event) => {
      window.__libmediaUnhandledRejections.push(
        event.reason?.message ?? String(event.reason)
      )
    })
  })
  return errors
}

async function expectNoUnhandledErrors(page, pageErrors) {
  expect(pageErrors).toEqual([])
  expect(await page.evaluate(() => window.__libmediaUnhandledRejections)).toEqual([])
}

async function expectReady(page) {
  const state = page.locator('[data-player-state]')
  await expect(state).not.toHaveAttribute('data-player-state', 'loading', {
    timeout: 20_000
  })
  const errorLocator = page.locator('[data-error-code]')
  const errorCode = await errorLocator.count() > 0
    ? await errorLocator.textContent()
    : null
  await expect(page.locator('[data-player-state]')).toHaveAttribute(
    'data-player-state',
    'ready',
    { message: `player error: ${errorCode ?? 'none'}` }
  )
}

test('plays MP4 and supports keyboard seeking', async ({ page }) => {
  const errors = await capturePageErrors(page)
  await page.goto('/')
  await expectReady(page)
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(page.locator('[data-player-state]')).toHaveAttribute(
    'data-player-state',
    'playing'
  )
  await page.getByRole('slider', { name: '播放进度' }).press('ArrowRight')
  await expect(page.locator('[data-current-time]')).not.toHaveText('0.00')
  await expectNoUnhandledErrors(page, errors)
})

test('loads HLS, a local File and switches sources', async ({ page }) => {
  const errors = await capturePageErrors(page)
  await page.goto('/')
  await expectReady(page)

  await page.getByRole('button', { name: '加载 HLS' }).click()
  await expectReady(page)
  await page.getByLabel('选择本地视频').setInputFiles(
    'tests/fixtures/media/sample.mp4'
  )
  await expectReady(page)
  await page.getByRole('button', { name: '加载 MP4' }).click()
  await expectReady(page)

  await expectNoUnhandledErrors(page, errors)
})

test('unmounts cleanly without unhandled browser errors', async ({ page }) => {
  const errors = await capturePageErrors(page)
  await page.goto('/')
  await expectReady(page)
  await page.getByRole('button', { name: '卸载播放器' }).click()
  await expect(page.locator('[data-player-mounted]')).toHaveAttribute(
    'data-player-mounted',
    'false'
  )
  await expect(page.locator('.libmedia-player')).toHaveCount(0)
  await page.waitForTimeout(100)
  await expectNoUnhandledErrors(page, errors)
})
