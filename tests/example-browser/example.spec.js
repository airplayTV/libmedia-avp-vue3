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

test('uses a light page hierarchy while keeping the video surface dark', async ({ page }) => {
  await page.goto('/')

  const colors = await page.evaluate(() => {
    const channels = (value) => value.match(/\d+/g).slice(0, 3).map(Number)
    return {
      page: channels(getComputedStyle(document.body).backgroundColor),
      heading: channels(getComputedStyle(document.querySelector('h1')).color),
      panel: channels(getComputedStyle(document.querySelector('.source-panel')).backgroundColor),
      player: channels(getComputedStyle(document.querySelector('.player-frame')).backgroundColor)
    }
  })

  expect(colors.page.every((channel) => channel >= 230)).toBe(true)
  expect(colors.panel.every((channel) => channel >= 245)).toBe(true)
  expect(colors.heading.every((channel) => channel <= 60)).toBe(true)
  expect(colors.player.every((channel) => channel <= 5)).toBe(true)
})

test('toggles playback from the video surface and exposes keyboard diagnostics', async ({ page }) => {
  await page.goto('/')
  const state = page.locator('[data-example-state]')
  await expect(state).toHaveText('ready')

  const player = page.locator('.libmedia-player')
  const surface = player.locator('.libmedia-player-core__surface')
  const primaryControl = player.locator('.libmedia-control-button--primary')
  const feedback = player.locator('.libmedia-playback-feedback')
  await surface.click({ position: { x: 200, y: 120 } })
  await expect(primaryControl).toHaveAttribute('aria-label', '暂停')
  await expect(feedback).toHaveAttribute('data-feedback', 'pause')
  await expect(state).toHaveText('playing')
  await surface.click({ position: { x: 200, y: 120 } })
  await expect(primaryControl).toHaveAttribute('aria-label', '播放')
  await expect(feedback).toHaveAttribute('data-feedback', 'play')
  await expect(state).toHaveText('paused')

  const playerBox = await player.boundingBox()
  const playerRight = playerBox.x + playerBox.width
  const playerBottom = playerBox.y + playerBox.height
  await page.mouse.click(playerRight - 10, playerBox.y + 30, { button: 'right' })

  const menu = player.locator('.libmedia-context-menu')
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(playerRight)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(playerBottom)

  await expect(menu.getByRole('menuitem', { name: '视频信息' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(player).toBeFocused()

  await page.mouse.click(playerRight - 10, playerBox.y + 30, { button: 'right' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '视频信息' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: '播放日志' })).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = player.getByRole('dialog', { name: '播放诊断' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('tab', { name: '播放日志' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(player).toBeFocused()
})

test('coalesces rapid surface clicks and exposes copyable Chinese diagnostics', async ({ page }) => {
  const ignoredPlayWarnings = []
  page.on('console', (message) => {
    if (message.text().includes('ignored call play because of player status is played')) {
      ignoredPlayWarnings.push(message.text())
    }
  })
  await page.goto('/')
  const state = page.locator('[data-example-state]')
  await expect(state).toHaveText('ready')
  const player = page.locator('.libmedia-player')
  const surface = player.locator('.libmedia-player-core__surface')

  await surface.evaluate((element) => {
    for (let index = 0; index < 3; index += 1) {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })
  await expect(state).toHaveText('playing')
  await page.waitForTimeout(200)
  expect(ignoredPlayWarnings).toEqual([])

  await surface.click({ position: { x: 200, y: 120 } })
  await expect(state).toHaveText('paused')
  await surface.click({ button: 'right', position: { x: 260, y: 150 } })
  await player.getByRole('menuitem', { name: '视频信息' }).click()

  const dialog = player.getByRole('dialog', { name: '播放诊断' })
  await expect(dialog).toContainText('/sample.mp4')
  await dialog.getByRole('button', { name: '复制当前文件或 URL' }).click()
  await expect(dialog).toContainText('已复制')
  await dialog.getByRole('tab', { name: '播放日志' }).click()
  await expect(dialog).toContainText('开始加载')
  await expect(dialog).toContainText('加载中 → 就绪')
  await expect(dialog).not.toContainText('statechange')
})

test('renders the aligned rounded progress treatment without a black thumb ring', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-example-state]')).toHaveText(/ready|playing|ended/)
  await page.locator('.libmedia-player').hover()

  const appearance = await page.locator('.libmedia-player').evaluate((player) => {
    const progress = player.querySelector('.libmedia-progress')
    const row = player.querySelector('.libmedia-controls__row')
    const played = player.querySelector('.libmedia-progress__played')
    const thumb = player.querySelector('.libmedia-progress__thumb')
    const progressRect = progress.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const playedStyle = getComputedStyle(played)
    const thumbStyle = getComputedStyle(thumb)

    return {
      leftDifference: Math.abs(progressRect.left - rowRect.left),
      rightDifference: Math.abs(progressRect.right - rowRect.right),
      playedColor: playedStyle.backgroundColor,
      playedRadius: playedStyle.borderRadius,
      thumbColor: thumbStyle.backgroundColor,
      thumbRadius: thumbStyle.borderRadius,
      thumbShadow: thumbStyle.boxShadow
    }
  })

  expect(appearance.leftDifference).toBeLessThan(1)
  expect(appearance.rightDifference).toBeLessThan(1)
  expect(appearance.playedColor).toBe('rgb(34, 197, 94)')
  expect(appearance.playedRadius).toBe('999px')
  expect(appearance.thumbColor).toBe('rgb(34, 197, 94)')
  expect(appearance.thumbRadius).toBe('50%')
  expect(appearance.thumbShadow).not.toContain('rgb(0, 0, 0)')
})

test('matches the approved G icon sizing, weight and control alignment', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-example-state]')).toHaveText(/ready|playing|ended/)

  const geometry = await page.locator('.libmedia-controls__row').evaluate((row) => {
    const buttons = [...row.querySelectorAll(':scope > .libmedia-control-button')]
    const icons = buttons.map((button) => button.querySelector('.libmedia-icon'))
    const primary = icons[0]
    const settings = icons[2]

    return {
      rowHeight: row.getBoundingClientRect().height,
      buttons: buttons.map((button, index) => {
        const buttonRect = button.getBoundingClientRect()
        const iconRect = icons[index].getBoundingClientRect()
        return {
          width: buttonRect.width,
          height: buttonRect.height,
          radius: getComputedStyle(button).borderRadius,
          iconWidth: iconRect.width,
          iconHeight: iconRect.height,
          centerDifferenceX: Math.abs(
            buttonRect.left + buttonRect.width / 2 - iconRect.left - iconRect.width / 2
          ),
          centerDifferenceY: Math.abs(
            buttonRect.top + buttonRect.height / 2 - iconRect.top - iconRect.height / 2
          )
        }
      }),
      primaryFill: primary.getAttribute('fill'),
      primaryStroke: primary.getAttribute('stroke'),
      outlineStrokeWidth: settings.getAttribute('stroke-width'),
      settingsHasCenterCircle: Boolean(settings.querySelector('circle'))
    }
  })

  expect(geometry.rowHeight).toBe(56)
  for (const button of geometry.buttons) {
    expect(button).toEqual(expect.objectContaining({
      width: 44,
      height: 44,
      radius: '7px',
      iconWidth: 20,
      iconHeight: 20
    }))
    expect(button.centerDifferenceX).toBeLessThan(0.5)
    expect(button.centerDifferenceY).toBeLessThan(0.5)
  }
  expect(geometry.primaryFill).toBe('currentColor')
  expect(geometry.primaryStroke).toBe('none')
  expect(geometry.outlineStrokeWidth).toBe('1.8')
  expect(geometry.settingsHasCenterCircle).toBe(true)
})

test('keeps long diagnostics content reachable inside a short player', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 420 })
  await page.goto('/')
  const player = page.locator('.libmedia-player')
  await expect(page.locator('[data-example-state]')).toHaveText(/ready|playing|ended/)

  await player.click({ button: 'right', position: { x: 120, y: 80 } })
  await player.getByRole('menuitem', { name: '视频信息' }).click()

  const dialog = player.getByRole('dialog', { name: '播放诊断' })
  const content = dialog.locator('.libmedia-diagnostics__content')
  const geometry = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY
  }))

  expect(geometry.overflowY).toBe('auto')
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(dialog.getByText('字幕轨道')).toBeVisible()
})

test('keeps every control icon visible while hovered', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-example-state]')).toHaveText(/ready|playing|ended/)

  const expectedIcons = [
    { label: '播放', color: 'rgb(34, 197, 94)', fill: 'rgb(34, 197, 94)', stroke: 'none' },
    { label: '静音', color: 'rgb(255, 255, 255)', fill: 'none', stroke: 'rgb(255, 255, 255)' },
    { label: '播放设置', color: 'rgb(255, 255, 255)', fill: 'none', stroke: 'rgb(255, 255, 255)' },
    { label: '进入全屏', color: 'rgb(255, 255, 255)', fill: 'none', stroke: 'rgb(255, 255, 255)' }
  ]

  for (const expected of expectedIcons) {
    const button = page.getByRole('button', { name: expected.label, exact: true })
    await button.hover()

    const appearance = await button.locator('.libmedia-icon').evaluate((icon) => {
      const style = getComputedStyle(icon)
      return {
        color: style.color,
        display: style.display,
        fill: style.fill,
        opacity: style.opacity,
        stroke: style.stroke,
        visibility: style.visibility
      }
    })

    expect(appearance).toEqual({
      color: expected.color,
      display: 'block',
      fill: expected.fill,
      opacity: '1',
      stroke: expected.stroke,
      visibility: 'visible'
    })
  }
})

test('moves a non-blocking cursor glow and tightens it over the primary action', async ({ page }) => {
  await page.goto('/')
  const aura = page.locator('.cursor-aura')

  await page.mouse.move(560, 120)
  await page.waitForTimeout(500)
  const resting = await aura.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      width: rect.width,
      opacity: Number(getComputedStyle(element).opacity),
      pointerEvents: getComputedStyle(element).pointerEvents
    }
  })

  expect(Math.abs(resting.centerX - 560)).toBeLessThan(6)
  expect(Math.abs(resting.centerY - 120)).toBeLessThan(6)
  expect(resting.opacity).toBeGreaterThan(0.25)
  expect(resting.pointerEvents).toBe('none')

  await page.locator('.primary-action').hover()
  await page.waitForTimeout(350)
  const interactiveWidth = await aura.evaluate((element) => (
    element.getBoundingClientRect().width
  ))
  expect(interactiveWidth).toBeLessThan(resting.width * 0.85)
})

test('hides the cursor glow over player controls', async ({ page }) => {
  await page.goto('/')
  const aura = page.locator('.cursor-aura')

  await page.mouse.move(560, 120)
  await page.waitForTimeout(350)
  expect(Number(await aura.evaluate((element) => getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.25)

  await page.locator('.libmedia-control-button--primary').hover()
  await page.waitForTimeout(250)

  expect(Number(await aura.evaluate((element) => getComputedStyle(element).opacity)))
    .toBeLessThan(0.01)
})

test('disables the cursor glow when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.mouse.move(420, 180)
  await page.waitForTimeout(350)

  await expect(page.locator('.cursor-aura')).toHaveCSS('opacity', '0')
})

test.describe('mobile controls', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('keeps the complete time and every control inside the player', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.locator('[data-example-state]')).toHaveText(/ready|playing|ended/)

    const player = page.locator('.libmedia-player')
    await player.hover()
    await expect(player.locator('.libmedia-controls__time-total')).toBeVisible()
    await expect(player.locator('.libmedia-controls__time')).toHaveText(
      /^\d{2}:\d{2} \/ \d{2}:\d{2}$/
    )

    const layout = await player.evaluate((element) => {
      const playerRect = element.getBoundingClientRect()
      const frameRect = element.closest('.player-frame').getBoundingClientRect()
      const buttons = [...element.querySelectorAll(
        '.libmedia-controls__row > .libmedia-control-button'
      )]

      return {
        viewportWidth: window.innerWidth,
        buttonCount: buttons.length,
        playerInsideFrame: playerRect.left >= frameRect.left && playerRect.right <= frameRect.right,
        rowInsideFrame: rowIsInsideFrame(element, frameRect),
        buttonsInsidePlayer: buttons.every((button) => {
          const rect = button.getBoundingClientRect()
          return rect.left >= frameRect.left && rect.right <= frameRect.right
        })
      }

      function rowIsInsideFrame(player, frameRect) {
        const rect = player.querySelector('.libmedia-controls__row').getBoundingClientRect()
        return rect.left >= frameRect.left && rect.right <= frameRect.right
      }
    })

    expect(layout.viewportWidth).toBe(375)
    expect(layout.buttonCount).toBe(4)
    expect(layout.playerInsideFrame).toBe(true)
    expect(layout.rowInsideFrame).toBe(true)
    expect(layout.buttonsInsidePlayer).toBe(true)
  })
})
