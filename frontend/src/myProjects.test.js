import { beforeEach, describe, expect, it } from 'vitest'
import { canEdit, forgetProject, ownerToken, rememberProject } from './myProjects'

describe('owner tokens', () => {
  beforeEach(() => localStorage.clear())

  it('remembers the token with the project and forgets both', () => {
    rememberProject('a', 'tok-a')
    expect(ownerToken('a')).toBe('tok-a')
    forgetProject('a')
    expect(ownerToken('a')).toBeNull()
  })

  it('lets only the owner edit a locked map', () => {
    rememberProject('a', 'tok-a')
    expect(canEdit({ id: 'a', locked: true })).toBe(true)
    expect(canEdit({ id: 'b', locked: true })).toBe(false)
    expect(canEdit({ id: 'c', locked: false })).toBe(false)
    expect(canEdit({ id: 'a', locked: true, protected: true })).toBe(false)
  })
})
