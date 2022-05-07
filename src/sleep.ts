const SLEEP_BUF = new Int32Array(new SharedArrayBuffer(4));

function timeout (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function sync (milliseconds: number) {
  Atomics.wait(SLEEP_BUF, 0, 0, Math.max(1, milliseconds ?? 0))
}

/** Use JavaScript `Atomics.wait` to perform a real sleep. */
export interface sleep {
  (milliseconds: number): Promise<void>
  /** Uses older `setTimeout` promise-callback style. */
  timeout: typeof timeout
  /** Use JavaScript `Atomics.wait` to perform a real synchronous sleep. */
  sync: typeof sync
}

export async function sleep (milliseconds: number) {
  return await sync(milliseconds)
}

/** Uses older `setTimeout` promise-callback style. */
sleep.timeout = timeout
/** Use JavaScript `Atomics.wait` to perform a real synchronous sleep. */
sleep.sync = sync
