import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
// import hash from '@adonisjs/core/services/hash'

export default class UserSeeder extends BaseSeeder {
  public async run() {
    // 🧹 Delete all existing users
    await User.query().delete()

    // Admin account
    await User.create({
      username: 'admin',
      email: 'fanmotorserver@gmail.com',
      password: 'fanmotorserver168',
      role: 'admin',
    })

    // Regular user account
    await User.create({
      username: 'user1',
      email: 'samnang.ewos@gmail.com',
      password: 'user123',
      role: 'user',
    })
  }
}
