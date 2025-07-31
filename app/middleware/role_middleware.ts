// app/middleware/role_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: string[]) {
    // Ensure user is authenticated
    await ctx.auth.authenticate()

    const user = ctx.auth.user!

    const allowedRoles = options
    if (!allowedRoles.includes(user.role)) {
      return ctx.response.unauthorized('Access denied')
    }

    return next()
  }
}
