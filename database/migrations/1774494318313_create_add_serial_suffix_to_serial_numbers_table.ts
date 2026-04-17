import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('serial_suffix', 7).nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('serial_suffix')
    })
  }
}
