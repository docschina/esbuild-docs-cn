// This file is responsible for spawning and terminating child worker threads.
// The worker thread is recreated every time the current API version changes.

import { afterConfigChange } from './mode'
import { OutputFile, showLoadingFailure, showLoadingMessage } from './output'
import { setReloadWorkerCallback } from './versions'

export type IPCRequest = TransformRequest | BuildRequest
export type IPCResponse = TransformResponse & BuildResponse

export interface TransformRequest {
  command_: 'transform'
  input_: string
  options_: Record<string, any>
}

export interface TransformResponse {
  code_?: string
  map_?: string
  mangleCache_?: Record<string, string | boolean>
  legalComments_?: string
  stderr_?: string
}

export interface BuildRequest {
  command_: 'build'
  input_: Record<string, string>
  options_: Record<string, any>
}

export interface BuildResponse {
  outputFiles_?: OutputFile[]
  metafile_?: string
  mangleCache_?: Record<string, string | boolean>
  stderr_?: string
}

interface Task {
  message_: any
  resolve_: (value: any) => void
  abort_: () => void
}

const workerText = fetch('worker.js').then(r => r.text())
let activeTask: Task | null = null
let pendingTask: Task | null = null

let workerPromise = new Promise<Worker>((resolve, reject) => {
  setReloadWorkerCallback(version => {
    const reloadPromise = reloadWorker(version)
    reloadPromise.then(resolve, reject)
    setReloadWorkerCallback(version => {
      workerPromise.then(worker => worker.terminate())
      workerPromise = reloadWorker(version)
      return workerPromise
    })
    return reloadPromise
  })
})

async function packageFetch(subpath: string): Promise<Response> {
  const controller = new AbortController
  const timeout = setTimeout(() => controller.abort('Timeout'), 5000)

  // Try to fetch from one CDN, but fall back to another CDN if that fails
  try {
    const response = await fetch(`https://cdn.jsdelivr.net/npm/${subpath}`, { signal: controller.signal })
    if (response.ok) {
      clearTimeout(timeout)
      return response
    }
  } catch (err) {
    console.error(err)
  }
  return fetch(`https://unpkg.com/${subpath}`)
}

async function reloadWorker(version: string): Promise<Worker> {
  let loadingFailure: string | undefined
  showLoadingMessage(version)

  try {
    if (activeTask) activeTask.abort_()
    if (pendingTask) pendingTask.abort_()
    activeTask = null
    pendingTask = null

    // "browser.min.js" was added in version 0.8.33
    const [major, minor, patch] = version.split('.').map(x => +x)
    const min = major === 0 && (minor < 8 || (minor === 8 && patch < 33)) ? '' : '.min'

    const polywasm = /^\?polywasm=([01])$/.exec(location.search)?.[1]
    const [workerJS, esbuildJS, esbuildWASM] = await Promise.all([
      workerText,
      packageFetch(`esbuild-wasm@${version}/lib/browser${min}.js`).then(r => r.text()),
      packageFetch(`esbuild-wasm@${version}/esbuild.wasm`).then(r => r.arrayBuffer()),
    ])
    const parts = [esbuildJS, `\nvar polywasm=${polywasm};`, workerJS]
    const url = URL.createObjectURL(new Blob(parts, { type: 'application/javascript' }))

    return await new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(url)
      worker.onmessage = e => {
        if (e.data.status_ === 'slow') {
          const slowEl = document.getElementById('slowWarning')!
          slowEl.innerHTML = '<span>⚠️ Processing is slow because </span><span>WebAssembly is disabled ⚠️</span>'
          slowEl.style.display = 'flex'
          return
        }
        worker.onmessage = null
        if (e.data.status_ === 'success') {
          resolve(worker)
          afterConfigChange()
        } else {
          reject(new Error('Failed to create worker'))
          loadingFailure = e.data.error_
        }
        URL.revokeObjectURL(url)
      }
      worker.postMessage([version, esbuildWASM], [esbuildWASM])
    })
  }

  catch (err) {
    showLoadingFailure(loadingFailure || err + '')
    throw err
  }
}

export function sendIPC(message: IPCRequest): Promise<IPCResponse> {
  function activateTask(worker: Worker, task: Task): void {
    if (activeTask) {
      if (pendingTask) pendingTask.abort_()
      pendingTask = task
    }

    else {
      activeTask = task
      worker.onmessage = e => {
        worker.onmessage = null
        task.resolve_(e.data)
        activeTask = null
        if (pendingTask) {
          activateTask(worker, pendingTask)
          pendingTask = null
        }
      }
      worker.postMessage(task.message_)
    }
  }

  return new Promise((resolve, reject) => {
    workerPromise.then(worker => activateTask(worker, {
      message_: message,
      resolve_: resolve,
      abort_: () => reject(new Error('Task aborted')),
    }), reject)
  })
}
