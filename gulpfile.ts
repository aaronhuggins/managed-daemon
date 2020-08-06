import * as shell from 'gulp-shell'
import { rmdirSync } from 'fs'

export const tsc = shell.task(['tsc --sourceMap false'])
export const clean = async () => rmdirSync('./dist', { recursive: true })
