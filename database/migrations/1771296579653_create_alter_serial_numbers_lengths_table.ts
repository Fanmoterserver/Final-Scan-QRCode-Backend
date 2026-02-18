import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'serial_numbers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('serial_number', 80).alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('serial_number', 45).alter()
    })
  }
}
