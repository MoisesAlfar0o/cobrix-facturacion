/**
 * Sirve el panel compilado y su API desde el mismo origen. Las rutas que no corresponden a un
 * archivo vuelven a `index.html`, para que React Router pueda resolverlas en el navegador.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import type { ApiHandler } from './api.ts'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

export function createPanelServer(publicDir: string, api: ApiHandler): Server {
  const indexPath = join(publicDir, 'index.html')

  const sendFile = (res: ServerResponse, path: string): boolean => {
    if (!existsSync(path) || !statSync(path).isFile()) return false
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
    res.end(readFileSync(path))
    return true
  }

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://panel.local')
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      void api.handle(req, res)
      return
    }

    let requested: string
    try {
      requested = decodeURIComponent(url.pathname)
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('La ruta solicitada no es válida.')
      return
    }

    const filePath = resolve(publicDir, `.${requested}`)
    const relativePath = relative(publicDir, filePath)
    const isInsidePublicDir = relativePath !== ''
      && relativePath !== '..'
      && !relativePath.startsWith(`..${sep}`)
      && !isAbsolute(relativePath)
    if (isInsidePublicDir && sendFile(res, filePath)) return

    if (existsSync(indexPath)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(readFileSync(indexPath))
      return
    }

    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<h1>Panel sin compilar</h1><p>Ejecuta <code>pnpm run build:web</code> para generar el panel en React.</p>')
  }

  return createServer(handle)
}
