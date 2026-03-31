import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'

export function renderIndexPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Native OS</title>
  </head>
  <body>
    <main>
      <h1>AI Native OS</h1>
      <p>Phase 1 web skeleton is running.</p>
    </main>
  </body>
</html>`
}

export function handleRequest(_request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=UTF-8',
  })
  response.end(renderIndexPage())
}

if (import.meta.main) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)

  createServer(handleRequest).listen(port, () => {
    console.log(`AI Native OS web skeleton listening on http://localhost:${port}`)
  })
}
