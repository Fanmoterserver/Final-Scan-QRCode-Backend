import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('username').unique().notNullable()
      table.enum('role', ['admin', 'user']).notNullable().defaultTo('user')
      table.dropColumn('full_name')
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('username')
      table.dropColumn('role')
      table.string('full_name').nullable()
    })
  }
}
