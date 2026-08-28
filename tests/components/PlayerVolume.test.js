import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlayerVolume from '../../src/ui/PlayerVolume.vue'

describe('PlayerVolume', () => {
  it('uses custom slider semantics without a native input', () => {
    const wrapper = mount(PlayerVolume, { props: { value: 0.4 } })

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.attributes('role')).toBe('slider')
    expect(wrapper.attributes('aria-valuemin')).toBe('0')
    expect(wrapper.attributes('aria-valuenow')).toBe('40')
    expect(wrapper.attributes('aria-valuemax')).toBe('100')
  })

  it('changes volume continuously with pointer input', async () => {
    const wrapper = mount(PlayerVolume, { props: { value: 0.2 } })
    wrapper.element.getBoundingClientRect = () => ({
      left: 10,
      width: 100,
      right: 110,
      top: 0,
      bottom: 44,
      height: 44,
      x: 10,
      y: 0,
      toJSON: () => ({})
    })

    await wrapper.trigger('pointerdown', { clientX: 35, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 85, pointerId: 1 })
    await wrapper.trigger('pointerup', { clientX: 110, pointerId: 1 })

    expect(wrapper.emitted('change')).toEqual([[0.25], [0.75], [1]])
  })

  it('supports arrow, Home and End keyboard controls', async () => {
    const wrapper = mount(PlayerVolume, { props: { value: 0.5 } })

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    await wrapper.trigger('keydown', { key: 'Home' })
    await wrapper.trigger('keydown', { key: 'End' })

    expect(wrapper.emitted('change')).toEqual([[0.55], [0.45], [0], [1]])
  })
})
