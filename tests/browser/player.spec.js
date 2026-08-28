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

test('keeps mobile settings and progress inside a short player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/')
  await expectReady(page)
  const player = page.locator('.libmedia-player')
  await player.evaluate((element) => {
    element.style.height = '219px'
    element.style.minHeight = '0'
    element.style.aspectRatio = 'auto'
  })
  await player.getByRole('button', { name: '播放设置' }).click()

  const geometry = await player.evaluate((element) => {
    const playerRect = element.getBoundingClientRect()
    const settings = element.querySelector('.libmedia-settings')
    const settingsRect = settings.getBoundingClientRect()
    const headerRect = settings.querySelector('.libmedia-settings__header')
      .getBoundingClientRect()
    const progressTrackRect = element.querySelector('.libmedia-progress__track')
      .getBoundingClientRect()
    const rowRect = element.querySelector('.libmedia-controls__row')
      .getBoundingClientRect()
    return {
      settingsTop: settingsRect.top,
      settingsBottom: settingsRect.bottom,
      settingsWidth: settingsRect.width,
      settingsHeight: settingsRect.height,
      playerTop: playerRect.top,
      playerBottom: playerRect.bottom,
      headerVisible: headerRect.top >= playerRect.top && headerRect.bottom <= playerRect.bottom,
      overflowY: getComputedStyle(settings).overflowY,
      progressGap: rowRect.top - progressTrackRect.bottom
    }
  })

  expect(geometry.settingsTop).toBeGreaterThanOrEqual(geometry.playerTop)
  expect(geometry.settingsBottom).toBeLessThanOrEqual(geometry.playerBottom)
  expect(geometry.headerVisible).toBe(true)
  expect(geometry.overflowY).toBe('auto')
  expect(geometry.settingsWidth).toBeLessThanOrEqual(280)
  expect(geometry.settingsHeight).toBeLessThanOrEqual(144)
  expect(geometry.progressGap).toBeGreaterThanOrEqual(0)
  expect(geometry.progressGap).toBeLessThanOrEqual(2)
})

test('keeps settings inside a short landscape mobile player', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')
  await expectReady(page)
  const player = page.locator('.libmedia-player')
  await player.evaluate((element) => {
    element.style.height = '219px'
    element.style.minHeight = '0'
    element.style.aspectRatio = 'auto'
  })
  await player.getByRole('button', { name: '播放设置' }).click()

  const geometry = await player.evaluate((element) => {
    const playerRect = element.getBoundingClientRect()
    const settings = element.querySelector('.libmedia-settings')
    const settingsRect = settings.getBoundingClientRect()
    return {
      playerTop: playerRect.top,
      playerBottom: playerRect.bottom,
      settingsTop: settingsRect.top,
      settingsBottom: settingsRect.bottom,
      overflowY: getComputedStyle(settings).overflowY
    }
  })

  expect(geometry.settingsTop).toBeGreaterThanOrEqual(geometry.playerTop + 8)
  expect(geometry.settingsBottom).toBeLessThanOrEqual(geometry.playerBottom - 64)
  expect(geometry.overflowY).toBe('auto')
})

test('keeps rendered video content proportional in wide fullscreen layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.goto('/')
  await expectReady(page)
  await page.getByRole('button', { name: '播放', exact: true }).click()
  await expect(page.locator('[data-player-state]')).toHaveAttribute(
    'data-player-state',
    'playing'
  )
  const renderElement = page.locator(
    '.libmedia-player-core__surface > canvas, .libmedia-player-core__surface > video'
  ).first()
  await expect(renderElement).toBeVisible()
  expect(await renderElement.evaluate((element) => getComputedStyle(element).objectFit))
    .toBe('contain')
})

test('toggles fullscreen on the complete player and keeps an exit control', async ({ page }) => {
  await page.goto('/')
  await expectReady(page)
  const player = page.locator('.libmedia-player')
  await player.getByRole('button', { name: '进入全屏' }).click()
  await expect(player.getByRole('button', { name: '退出全屏' })).toBeVisible()
  expect(await player.evaluate((element) => (
    document.fullscreenElement === element ||
    element.classList.contains('libmedia-player--pseudo-fullscreen')
  ))).toBe(true)

  await player.getByRole('button', { name: '退出全屏' }).click()
  await expect(player.getByRole('button', { name: '进入全屏' })).toBeVisible()
})
