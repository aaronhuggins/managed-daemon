import type { SpawnOptions } from 'child_process'

export interface LogFile {
  /** The path to a log file to write stdout and stderr. */
  path: string
  /** Read the contents of the log file to stdout as it is written. */
  print?: boolean
  /**
   * If the log is no longer updating, this is the number of seconds to wait before closing the printer.
   * The default is 4 seconds; setting to Infinity will keep the printer open until the program is closed.
   * This is ignored if `print === false`; if `print === undefined` but this is a number, assumes `print === true`.
   */
  printTTL?: number
}

type OmitSpawnOptions = 'stdio' | 'argv0' | 'serialization' | 'cwd'

export interface ServiceOptions extends Omit<SpawnOptions, OmitSpawnOptions> {
  /** The name of an executable on the system PATH or an absolute path to one. */
  command: string
  /** An array of arguments to pass to the executable. */
  args?: string[]
  /** The name of this service; used in function naming for debugging purposes. */
  name?: string
  /** A number of milliseconds to pause after starting but before setting service state. */
  startWait?: number
  /** The path to set as current working directory, if not the process working dir. */
  cwd?: string
  /** Path to a log file; will be overwritten on each launch. */
  logFile?: string | LogFile
  /** A callback function which runs as soon as the service is ready. */
  onReady?: Function
  /** A callback function which runs immediately before starting the executable. */
  onStart?: Function
  /** A callback function which runs immediately after stopping the executable. */
  onStop?: Function
  /** A callback function which runs immediately after stopping the executable but before starting. */
  onRestart?: Function
}

export type ServiceState = 'READY' | 'STARTED' | 'STOPPED' | 'RESTARTING' | 'UNDEFINED'

export type ServiceEvent = 'onReady' | 'onStart' | 'onStop' | 'onRestart'
