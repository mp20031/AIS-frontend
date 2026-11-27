import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage } from '@/services/authStorage'

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps a remembered value in localStorage', () => {
    authStorage.set('k', 'v', true)
    expect(localStorage.getItem('k')).toBe('v')
    expect(sessionStorage.getItem('k')).toBeNull()
  })

  it('keeps a value that is not remembered in sessionStorage', () => {
    authStorage.set('k', 'v', false)
    expect(sessionStorage.getItem('k')).toBe('v')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('reads from either store', () => {
    sessionStorage.setItem('a', '1')
    localStorage.setItem('b', '2')
    expect(authStorage.get('a')).toBe('1')
    expect(authStorage.get('b')).toBe('2')
    expect(authStorage.get('missing')).toBeNull()
  })

  it('does not leave a previous login with the other choice behind', () => {
    authStorage.set('k', 'old', true)
    authStorage.set('k', 'new', false)
    expect(localStorage.getItem('k')).toBeNull()
    expect(authStorage.get('k')).toBe('new')
  })

  it('replace keeps the store the value already lives in', () => {
    authStorage.set('k', 'old', true)
    authStorage.replace('k', 'new')
    expect(localStorage.getItem('k')).toBe('new')

    authStorage.set('j', 'old', false)
    authStorage.replace('j', 'new')
    expect(sessionStorage.getItem('j')).toBe('new')
  })

  it('replace with nothing stored yet uses sessionStorage', () => {
    authStorage.replace('k', 'v')
    expect(sessionStorage.getItem('k')).toBe('v')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('remove clears both stores', () => {
    localStorage.setItem('k', '1')
    sessionStorage.setItem('k', '2')
    authStorage.remove('k')
    expect(authStorage.get('k')).toBeNull()
  })
})
