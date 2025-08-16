/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ModelsController = () => import('#controllers/models_controller')
const SerialNumbersController = () => import('#controllers/serial_numbers_controller')
const SummaryController = () => import('#controllers/summary_controller')
const ActualRecordsController = () => import('#controllers/actual_records_controller')
const AuthController = () => import('#controllers/auth_controller')

router.post('/login', [AuthController, 'login'])

router.post('/logout', [AuthController, 'logout'])

// fillter serial numbers by model name and lot number
router.get('serial_numbers/filter', [SerialNumbersController, 'filter']).use(middleware.auth())

// Upload serial numbers from Excel file
router.post('upload_serials', [SerialNumbersController, 'uploadExcel'])

// Summary routes
// GET dataSummary with pagination and filters
router
  .get('summary', [SummaryController, 'dataSummary'])
  .use(middleware.auth())
  .use(middleware.role(['admin', 'inspector']))

// Define a resourceful route for the ModelsController
router.resource('models', ModelsController).use('*', middleware.auth())
router.resource('serial_numbers', SerialNumbersController).use('*', middleware.auth())
router
  .resource('actual_records', ActualRecordsController)
  .use('*', middleware.auth())
  .use('*', middleware.role(['admin', 'user']))
