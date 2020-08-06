export interface ServiceOptions {
  /** The name of an executable on the system PATH or an absolute path to one. */
  command: string
  /** An array of arguments to pass to the executable. */
  args: string[]
  /** The name of this service; used in function naming for debugging purposes. */
  name: string
  /** A number of milliseconds to pause after starting but before setting service state. */
  startWait: number
  /** A callback function which runs as soon as the service is ready. */
  onReady: Function
  /** A callback function which runs immediately before starting the executable. */
  onStart: Function
  /** A callback function which runs immediately after stopping the executable. */
  onStop: Function
  /** A callback function which runs immediately after stopping the executable but before starting. */
  onRestart: Function
}

export type ServiceState = 'READY' | 'STARTED' | 'STOPPED' | 'RESTARTING' | 'UNDEFINED'

export type ServiceEvent = 'onReady' | 'onStart' | 'onStop' | 'onRestart'