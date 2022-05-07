import type { ServiceState, ServiceEvent } from './Interfaces.ts'

export const BIND_FUNCTIONS: ['start', 'stop', 'restart', 'kill'] = ['start', 'stop', 'restart', 'kill']

export const SERVICE_STATE: Record<ServiceState, ServiceState> = {
  READY: 'READY',
  STARTED: 'STARTED',
  STOPPED: 'STOPPED',
  RESTARTING: 'RESTARTING',
  UNDEFINED: 'UNDEFINED'
}

export const SERVICE_EVENT: Record<ServiceEvent, ServiceEvent> = {
  onReady: 'onReady',
  onStart: 'onStart',
  onStop: 'onStop',
  onRestart: 'onRestart'
}

Object.freeze(BIND_FUNCTIONS)
Object.freeze(SERVICE_STATE)
Object.freeze(SERVICE_EVENT)
