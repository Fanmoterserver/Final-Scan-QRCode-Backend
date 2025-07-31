import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ActualRecord extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare modelId: number

  @column()
  declare lotNo: string

  @column()
  declare actual: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
