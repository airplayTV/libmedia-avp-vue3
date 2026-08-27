import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlayerProgress from '../../src/ui/PlayerProgress.vue'

describe('PlayerProgress', () => {
  it('exposes slider semantics and keyboard seeking in seconds', async () => {
    const wrapper = mount(PlayerProgress, {
      props: { currentTime: 30, duration: 120, buffered: 60 }
    })

    expect(wrapper.attributes('role')).toBe('slider')
    expect(wrapper.attributes('aria-valuemin')).toBe('0')
    expect(wrapper.attributes('aria-valuenow')).toBe('30')
    expect(wrapper.attributes('aria-valuemax')).toBe('120')

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('seek')[0]).toEqual([35])
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('seek')[1]).toEqual([25])
  })

  it('clamps keyboard seeks to the media duration', async () => {
    const wrapper = mount(PlayerProgress, {
      props: { currentTime: 119, duration: 120 }
    })

    await wrapper.trigger('keydown', { key: 'End' })
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.setProps({ currentTime: 1 })
    await wrapper.trigger('keydown', { key: 'Home' })
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })

    expect(wrapper.emitted('seek')).toEqual([[120], [120], [0], [0]])
  })

  it('emits previews while dragging and one committed seek on release', async () => {
    const wrapper = mount(PlayerProgress, {
      props: { currentTime: 0, duration: 100 }
    })
    wrapper.element.getBoundingClientRect = () => ({
      left: 10,
      width: 200,
      right: 210,
      top: 0,
      bottom: 20,
      height: 20,
      x: 10,
      y: 0,
      toJSON: () => ({})
    })

    await wrapper.trigger('pointerdown', { clientX: 60, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 110, pointerId: 1 })
    await wrapper.trigger('pointerup', { clientX: 160, pointerId: 1 })

    expect(wrapper.emitted('preview')).toEqual([[25], [50], [75]])
    expect(wrapper.emitted('seek')).toEqual([[75]])
  })
})
