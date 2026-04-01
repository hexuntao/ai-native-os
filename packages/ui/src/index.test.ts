import assert from 'node:assert/strict'
import test from 'node:test'

import { buttonVariants, cn, designTokens } from './index'

test('cn merges class names and keeps the later Tailwind utility', () => {
  assert.equal(cn('px-4 text-sm', undefined, 'px-6'), 'text-sm px-6')
})

test('buttonVariants exposes the default semantic classes', () => {
  assert.match(buttonVariants(), /bg-primary/)
  assert.match(buttonVariants({ variant: 'secondary' }), /bg-secondary/)
})

test('design tokens expose semantic color aliases', () => {
  assert.equal(designTokens.color.background, 'var(--background)')
})
