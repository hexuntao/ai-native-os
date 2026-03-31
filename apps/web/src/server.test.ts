import assert from 'node:assert/strict'
import test from 'node:test'

import { renderIndexPage } from './server'

test('renderIndexPage returns accessible html content', () => {
  const html = renderIndexPage()

  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /AI Native OS/)
  assert.match(html, /Phase 1 web skeleton is running/)
})
