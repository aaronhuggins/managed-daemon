// deno-lint-ignore-file no-explicit-any no-inferrable-types
import { readableStreamFromReader } from 'https://deno.land/std@0.137.0/streams/conversion.ts'
import { BIND_FUNCTIONS, SERVICE_STATE, SERVICE_EVENT } from './Constants.ts'
import { sleep } from './sleep.ts'
import type { ServiceOptions, ServiceEvent, ServiceState, LogFile } from './Interfaces.ts'

type ServicLogFile = Omit<LogFile, 'path'> & {
  path?: string
  streamed: number
  tail: number
  retryCount: number
}

const noop = () => {}

function logFileHandler (logFile?: string | LogFile): ServicLogFile {
  const isLogFile = (val: any): val is LogFile => typeof val === 'object' && val !== null
  const result: ServicLogFile = {
    path: isLogFile(logFile) ? logFile.path : logFile,
    print: isLogFile(logFile) ? (logFile.print ?? false) : false,
    printTTL: isLogFile(logFile) ? (logFile.printTTL ?? 4) : 4,
    streamed: 0,
    tail: -1,
    retryCount: 0
  }

  if (isLogFile(logFile) && typeof logFile.printTTL === 'number') result.print = true

  return result
}

/** Options for a service instance.
 * @typedef {object} ServiceOptions
 * @property {string} command - The name of an executable on the system PATH or an absolute path to one.
 * @property {string[]} [args] - An array of arguments to pass to the executable.
 * @property {string} [name] - The name of this service; used in function naming for debugging purposes.
 * @property {number} [startWait] - A number of milliseconds to pause after starting but before setting service state.
 * @property {Function} [onReady] - A callback function which runs as soon as the service is ready.
 * @property {Function} [onStart] - A callback function which runs immediately before starting the executable.
 * @property {Function} [onStop] - A callback function which runs immediately after stopping the executable.
 * @property {Function} [onRestart] - A callback function which runs immediately after stopping the executable but before starting.
 */

/** Wrapper for spawning child processes as managed services. */
export class Service {
  /** @param {ServiceOptions} options - The options for this service. */
  constructor (options: ServiceOptions) {
    const { name, command, args, startWait, logFile } = options
    this.events = new Map([
      [SERVICE_EVENT.onReady, noop],
      [SERVICE_EVENT.onStart, noop],
      [SERVICE_EVENT.onStop, noop],
      [SERVICE_EVENT.onRestart, noop]
    ])
    this.options = { ...options }
    this.name = name || command
    this.command = command
    this.args = args ?? []
    this.startWait = startWait || 0
    this.logFile = logFileHandler(logFile)
    this.tid = null
    this.rid = null

    if (command === undefined || command === null) {
      this.state = SERVICE_STATE.UNDEFINED
      this.pid = null
    } else {
      this.pid = null

      delete this.options.name
      // @ts-ignore: Delete the non-optional member so that options can be passed anyway.
      delete this.options.command
      delete this.options.args
      delete this.options.startWait
      delete this.options.logFile

      for (const key of this.events.keys()) {
        const func = this.options[key]
        if (typeof func === 'function') {
          this.events.set(key, func)
          delete this.options[key]
        }
      }

      for (const func of BIND_FUNCTIONS) {
        // @ts-ignore: This is actually explicit; there is no ambiguity here.
        this[func] = this[func].bind(this)

        Object.defineProperty(this[func], 'name', {
          value: `${this.name || this.command} ${func}`
        })
      }

      this.state = SERVICE_STATE.READY
      this.events.get(SERVICE_EVENT.onReady)?.()
    }
  }

  private state: ServiceState
  private pid: number | null
  private tid: number | null
  private rid: number | null
  private proc?: Deno.Process
  private options: ServiceOptions
  private logFile: ServicLogFile
  name: string
  command: string
  args: string[]
  private startWait: number
  private events: Map<ServiceEvent, () => void | Promise<void>>

  /** Get the current state of the service. */
  getState (): ServiceState {
    return this.state
  }

  /** Get the current process ID of the service. */
  getPID (): number {
    return this.pid ?? NaN
  }

  /** Start the service.
   * @param {number} [wait] - Optional wait to pause after starting but before setting service state.
   */
  async start (): Promise<void>
  async start (wait: number): Promise<void>
  async start (wait: number = 0) {
    if (typeof wait !== 'number') wait = 0
    if (this.state === SERVICE_STATE.UNDEFINED) return
    this.resetLogFileStats()
    this.events.get(SERVICE_EVENT.onStart)?.()
    const writable = typeof this.logFile.path === 'string' ? Deno.openSync(this.logFile.path, { create: true, write: true }).rid : -1
    const spawn = this.proc = Deno.run({
      cmd: [this.command, ...this.args],
      ...this.options,
      stderr: writable < 0 ? 'null' : writable,
      stdin: 'null',
      stdout: writable < 0 ? 'null' : writable,
    })

    if (writable > 0) this.rid = writable

    spawn.status().then(() => {
      /** Avoid setting if service alrady killed itself. */
      if (this.state !== SERVICE_STATE.STOPPED) {
        this.kill()
        this.state = SERVICE_STATE.STOPPED
        this.events.get(SERVICE_EVENT.onStop)?.()
      }
    })
    this.printer()
    this.pid = spawn.pid
    if (wait > 0 || this.startWait > 0) {
      await sleep(wait === 0 ? this.startWait : wait)
    }
    this.state = SERVICE_STATE.STARTED
  }

  /** Stop the service. */
  stop () {
    return new Promise<void>((resolve, reject) => {
      try {
        if (this.state === SERVICE_STATE.UNDEFINED) return
        this.kill()
        this.state = SERVICE_STATE.STOPPED
        this.events.get(SERVICE_EVENT.onStop)?.()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  /** Restart the service.
   * @param {number} [wait] - Optional wait to pause after starting but before setting service state.
   */
  async restart (): Promise<void>
  async restart (wait: number): Promise<void>
  restart (wait: number = 1) {
    return new Promise<void>((resolve, reject) => {
      try {
        if (typeof wait !== 'number') wait = 1
        if (this.state === SERVICE_STATE.UNDEFINED) return
        this.state = SERVICE_STATE.RESTARTING
        this.kill()
        this.events.get(SERVICE_EVENT.onRestart)?.()
        resolve(this.start(wait))
      } catch (error) {
        reject(error)
      }
    })
  }

  /** Kill the service.
   * @param {string} [signal='SIGINT'] - The signal to send the service; see node's docs on `process.kill`.
   */
  kill (): void
  kill (signal: Deno.Signal): void
  kill (signal: Deno.Signal = 'SIGINT') {
    if (this.state === SERVICE_STATE.UNDEFINED) return
    if (this.pid !== null) {
      try {
        Deno.kill(this.pid, signal)
      } catch (_error) { /* Gracefully ignore a not found or access issue. */ }
      this.pid = null
    }
    this.proc?.close()
    if (this.tid !== null) {
      clearTimeout(this.tid)
      this.tid = null
    }
    if (this.rid !== null) {
      Deno.close(this.rid)
      this.rid = null
    }
  }

  /** Start or stop the printer on demand. If no logfile was provided in constructor, then this is a no-op. */
  print (start: boolean = true) {
    if (typeof this.logFile.path !== 'string') return

    this.logFile.print = start
    if (this.logFile.print) this.printer()
  }

  private resetLogFileStats () {
    this.logFile.retryCount = 0
    this.logFile.streamed = 0
    this.logFile.tail = -1
  }

  private printer () {
    if (typeof this.logFile.path !== 'string') return

    const printLog = () => {
      if (this.logFile.print) {
        this.logFile.tail = this.logFile.streamed
        const readable = Deno.openSync(this.logFile.path as string, { read: true })

        readable.seekSync(this.logFile.streamed, Deno.SeekMode.Start)

        const stream = readableStreamFromReader(readable)
        const reader = stream.getReader()
        const callback = ({ done, value }: ReadableStreamReadResult<Uint8Array>) => {
          this.logFile.streamed += (value?.byteLength ?? 0)
          if (value) Deno.stdout.write(value)
          if (!done) reader.read().then(callback)
        }

        reader.read().then(callback)

        if (this.logFile.retryCount >= (this.logFile.printTTL ?? 4)) return
        if (this.logFile.streamed > this.logFile.tail) this.logFile.retryCount = 0
        if (this.logFile.streamed === this.logFile.tail) this.logFile.retryCount += 1
        if ([SERVICE_STATE.STARTED, SERVICE_STATE.READY].includes(this.state)) this.tid = setTimeout(() => printLog(), 1000)
      }
    }

    printLog()
  }
}
