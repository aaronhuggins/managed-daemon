import * as cp from 'child_process'
import { ServiceOptions, ServiceEvent, ServiceState } from './Interfaces'
import { BIND_FUNCTIONS, SERVICE_STATE, SERVICE_EVENT } from './Constants'

const noop = () => {}

export const sleep = (milliseconds: number) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
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
    const { name, command, args, startWait } = options

    if (command === undefined || command === null) {
      this.state = SERVICE_STATE.UNDEFINED
      this.pid = null
    } else {
      this.pid = null
      this.events = new Map([
        [SERVICE_EVENT.onReady, noop],
        [SERVICE_EVENT.onStart, noop],
        [SERVICE_EVENT.onStop, noop],
        [SERVICE_EVENT.onRestart, noop]
      ])
      this.options = { ...options }
      this.name = name || command
      this.command = command
      this.args = args
      this.startWait = startWait || 0

      delete this.options.name
      delete this.options.command
      delete this.options.args

      for (const key of this.events.keys()) {
        if (typeof this.options[key] === 'function') {
          this.events.set(key, this.options[key])
          delete this.options[key]
        }
      }

      for (const func of BIND_FUNCTIONS) {
        this[func] = this[func].bind(this)

        Object.defineProperty(this[func], 'name', {
          value: `${this.name || this.command} ${func}`
        })
      }

      this.state = SERVICE_STATE.READY
      this.events.get(SERVICE_EVENT.onReady)()
    }
  }

  private state: ServiceState
  private pid: number
  private options: ServiceOptions
  name: string
  command: string
  args: string[]
  private startWait: number
  private events: Map<ServiceEvent, Function>

  /** Start the service.
   * @param {number} [wait] - Optional wait to pause after starting but before setting service state.
   */
  async start (): Promise<void>
  async start (wait: number): Promise<void>
  async start (wait: number = 0) {
    if (typeof wait !== 'number') wait = 0
    if (this.state === SERVICE_STATE.UNDEFINED) return
    this.events.get(SERVICE_EVENT.onStart)()
    const spawn = cp.spawn(this.command, this.args, {
      stdio: 'ignore',
      ...this.options
    })
    spawn.unref()
    this.pid = spawn.pid
    if (wait > 0 || this.startWait > 0) {
      await sleep(wait === 0 ? this.startWait : wait)
    }
    this.state = SERVICE_STATE.STARTED
  }

  /** Stop the service. */
  async stop () {
    if (this.state === SERVICE_STATE.UNDEFINED) return
    this.kill()
    this.state = SERVICE_STATE.STOPPED
    this.events.get(SERVICE_EVENT.onStop)()
  }

  /** Restart the service.
   * @param {number} [wait] - Optional wait to pause after starting but before setting service state.
   */
  async restart (): Promise<void>
  async restart (wait: number): Promise<void>
  async restart (wait: number = 0) {
    if (typeof wait !== 'number') wait = 0
    if (this.state === SERVICE_STATE.UNDEFINED) return
    this.state = SERVICE_STATE.RESTARTING
    this.kill()
    this.events.get(SERVICE_EVENT.onRestart)()
    await this.start(wait)
  }

  /** Kill the service.
   * @param {string} [signal='SIGINT'] - The signal to send the service; see node's docs on `process.kill`.
   */
  kill (): void
  kill (signal: string | number): void
  kill (signal: string | number = 'SIGINT') {
    if (this.state === SERVICE_STATE.UNDEFINED) return
    if (this.pid !== null) {
      process.kill(this.pid, signal)
      this.pid = null
    }
  }
}
