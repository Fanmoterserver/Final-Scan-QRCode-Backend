import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import SerialNumber from './serial_number.js'

export default class Model extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare modelName: string

  @column()
  declare customerPn: string

  @column()
  declare digit: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => SerialNumber)
  declare serialNumbers: HasMany<typeof SerialNumber>
}
