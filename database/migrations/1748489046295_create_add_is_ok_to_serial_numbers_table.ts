import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Modify `shift` to enum
      table.enu('shift', ['A', 'B']).notNullable().alter()

      // Add new column `is_ok`
      table.boolean('is_ok').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_ok')
    })
  }
}
