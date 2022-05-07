import { describe, it } from 'https://deno.land/x/deno_mocha@0.3.0/mod.ts'
import { assert, assertStrictEquals } from 'https://deno.land/std@0.137.0/testing/asserts.ts'
import type { ServiceOptions, ServiceState } from "./Interfaces.ts";
import { Service } from './Service.ts'
import { sleep } from './sleep.ts'

describe('Service', () => {
  it('should create an instance', () => {
    const svc1 = new Service({} as ServiceOptions)
    const svc2 = new Service({ command: 'echo' })

    assert(svc1 instanceof Service)
    assert(svc2 instanceof Service)
  })

  it('should run a service', async () => {
    const logFile = './test.log'
    const svc = new Service({
      command: 'echo',
      args: ['How are you?'],
      logFile: {
        path: logFile,
        print: true
      },
      onStop () {
        Deno.removeSync(logFile, { recursive: true })
      }
    })

    await svc.start()

    assertStrictEquals<ServiceState>(svc.getState(), 'STARTED')

    // Echo is not a long-running command.
    await sleep.timeout(50)

    assertStrictEquals<ServiceState>(svc.getState(), 'STOPPED')

    svc.print(false)
    await svc.start()

    assertStrictEquals<ServiceState>(svc.getState(), 'STARTED')

    const restart = svc.restart()

    assertStrictEquals<ServiceState>(svc.getState(), 'RESTARTING')

    await restart

    assertStrictEquals<ServiceState>(svc.getState(), 'STARTED')

    await svc.stop()

    assertStrictEquals<ServiceState>(svc.getState(), 'STOPPED')
  })
})
