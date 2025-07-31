import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Model from './model.js'

export default class SerialNumber extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare modelId: number

  @column()
  declare shift: 'A' | 'B'

  @column()
  declare lineNo: string

  @column()
  declare lotNo: string

  @column()
  declare serialNumber: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Model)
  declare model: BelongsTo<typeof Model>
}
