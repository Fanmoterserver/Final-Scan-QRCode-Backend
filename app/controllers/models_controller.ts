import Model from '#models/model'
import type { HttpContext } from '@adonisjs/core/http'
import { modelValidator } from '#validators/model'

export default class ModelsController {
  // GET /models
  async index({ response }: HttpContext) {
    const models = await Model.all()
    return response.ok({ message: 'Fetched all models', data: models })
  }

  // POST /models
  async store({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(modelValidator)

      const model = await Model.create(data)

      return response.status(201).send({ success: true, data: model, message: 'Model Created!' })
    } catch (error) {
      // 💡 Catch Vine validation errors
      if (error.status === 422) {
        return response.status(422).send({
          success: false,
          errors: error.messages.map((e: { field: any; message: any }) => ({
            field: e.field,
            message: e.message,
          })),
        })
      }

      // 💡 Catch duplicate entry errors
      if (error.code === 'ER_DUP_ENTRY' && error.message.includes('models_model_name_unique')) {
        return response.status(400).send({
          success: false,
          errors: [{ field: 'modelName', message: 'Model name already exists' }],
        })
      }

      // fallback for unknown errors
      return response.status(500).send({
        success: false,
        errors: [{ field: 'form', message: 'Something went wrong. Please try again.' }],
      })
    }
  }

  // GET /models/:id
  async show({ params, response }: HttpContext) {
    const model = await Model.find(params.id)
    if (!model) {
      return response.notFound({ message: 'Model not found' })
    }
    return response.ok({ message: 'Model fetched', data: model })
  }

  // PUT /models/:id
  async update({ params, request, response }: HttpContext) {
    try {
      const model = await Model.find(params.id)
      if (!model) {
        return response.notFound({
          success: false,
          errors: [{ field: 'form', message: 'Model not found' }],
        })
      }

      const payload = await request.validateUsing(modelValidator)

      model.merge(payload)
      await model.save()

      return response.ok({ success: true, message: 'Model updated successfully', data: model })
    } catch (error) {
      // Vine validation errors
      if (error.status === 422) {
        return response.status(422).send({
          success: false,
          errors: error.messages.map((e: { field: string; message: string }) => ({
            field: e.field,
            message: e.message,
          })),
        })
      }

      // Duplicate modelName error
      if (error.code === 'ER_DUP_ENTRY' && error.message.includes('models_model_name_unique')) {
        return response.status(400).send({
          success: false,
          errors: [{ field: 'modelName', message: 'Model name already exists' }],
        })
      }

      // Unknown error
      return response.status(500).send({
        success: false,
        errors: [{ field: 'form', message: 'Something went wrong. Please try again.' }],
      })
    }
  }

  // DELETE /models/:id
  async destroy({ params, response }: HttpContext) {
    const model = await Model.find(params.id)
    if (!model) {
      return response.notFound({ message: 'Model not found' })
    }
    await model.delete()
    return response.ok({ message: 'Model deleted successfully' })
  }
}
