import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_ok')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_ok').notNullable().defaultTo(true)
    })
  }
}
