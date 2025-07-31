import vine from '@vinejs/vine'

export const modelValidator = vine.compile(
  vine.object({
    modelName: vine.string().trim().minLength(3).maxLength(255),
    customerPn: vine.string().trim().minLength(1),
    digit: vine.number().positive().min(1),
  })
)
