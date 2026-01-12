import { body, param, ValidationChain } from 'express-validator';

// Phase 0.4: Input Sanitization & Validation

export const validateLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

export const validateRegister: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name is required'),
  body('organizationId')
    .isUUID()
    .withMessage('Valid organization ID is required'),
  body('role')
    .isIn([
      'OPERATOR',
      'SUPERVISOR',
      'QA_FOOD_SAFETY',
      'MAINTENANCE_ENGINEERING',
      'CI_MANAGER',
      'ADMIN',
      'SYSTEM_ADMIN',
    ])
    .withMessage('Valid role is required'),
];

export const validateIncidentCreation: ValidationChain[] = [
  body('type')
    .isIn(['FOOD_SAFETY', 'MACHINE_EQUIPMENT'])
    .withMessage('Valid incident type is required'),
  body('categoryId')
    .isUUID()
    .withMessage('Valid category ID is required'),
  body('facilityId')
    .isUUID()
    .withMessage('Valid facility ID is required'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('occurredAt')
    .isISO8601()
    .withMessage('Valid occurrence date is required'),
];

export const validateUUID = (field: string): ValidationChain =>
  param(field).isUUID().withMessage(`Valid ${field} is required`);
