// app/contracts/auth.ts
import authConfig from '#config/auth'
import type { InferAuthenticators } from '@adonisjs/auth/types'

export type Authenticators = InferAuthenticators<typeof authConfig>

// ⬇️ extend Adonis' internal types with your guards
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
