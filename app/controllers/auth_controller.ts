// app/controllers/session_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class AuthController {
  async login({ request, auth, response }: HttpContext) {
    const { username, password } = request.body()

    try {
      // 1. Manually find the user
      const user = await User.findByOrFail('username', username)
      if (!user) {
        console.log('Invalid username')
        return response.abort('Invalid credentials')
      }

      // 2. Compare the password
      const isValid = await hash.use('scrypt').verify(user.password, password)

      if (!isValid) {
        console.log('Invalid password')
        throw new Error('Invalid credentials')
      }

      // 3. Login user manually
      await auth.use('web').login(user)

      return response.ok({
        success: true,
        message: 'Login successful',
        data: user,
      })
    } catch {
      return response.unauthorized({
        success: false,
        message: 'Invalid credentials',
        data: null,
      })
    }
  }

  async logout({ auth, response }: HttpContext) {
    try {
      await auth.use('web').logout()
      return response.ok({
        success: true,
        message: 'Logged out successfully',
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Logout failed',
        error: error.message,
      })
    }
  }
}
