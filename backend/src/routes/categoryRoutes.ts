import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ValidationError } from '../middleware/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/categories - List categories (optionally filtered by organization and type)
// Accessible to all authenticated users (needed for incident creation)
router.get('/', async (req, res) => {
  const { organizationId, type, parentId } = req.query;

  const categories = await prisma.category.findMany({
    where: {
      ...(organizationId && { organizationId: String(organizationId) }),
      ...(type && { type: type as any }),
      ...(parentId === 'null' ? { parentId: null } : parentId ? { parentId: String(parentId) } : {}),
    },
    include: {
      Organization: {
        select: { id: true, name: true },
      },
      Category: {
        select: { id: true, name: true },
      },
      other_Category: {
        select: { id: true, name: true, allowCustomTitle: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({
    success: true,
    data: categories,
  });
});

// GET /api/categories/:id - Get single category with full hierarchy
// Accessible to all authenticated users
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      Organization: true,
      Category: {
        include: {
          Category: true, // Grandparent if exists
        },
      },
      other_Category: true,
    },
  });

  if (!category) {
    throw new ValidationError('Category not found');
  }

  res.json({
    success: true,
    data: category,
  });
});

// POST /api/categories - Create category
// Requires ADMIN role
router.post('/', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { name, organizationId, type, parentId, allowCustomTitle } = req.body;

  if (!name || !organizationId || !type) {
    throw new ValidationError('Name, organization ID, and type are required');
  }

  // Validate type
  const validTypes = ['FOOD_SAFETY', 'MACHINE_EQUIPMENT', 'WORKPLACE_SAFETY', 'OPERATIONS'];
  if (!validTypes.includes(type)) {
    throw new ValidationError('Invalid type. Must be FOOD_SAFETY, MACHINE_EQUIPMENT, WORKPLACE_SAFETY, or OPERATIONS');
  }

  const category = await prisma.category.create({
    data: {
      name,
      organizationId,
      type: type as any,
      parentId: parentId || null,
      allowCustomTitle: allowCustomTitle || false,
    },
    include: {
      Organization: {
        select: { id: true, name: true },
      },
      Category: {
        select: { id: true, name: true },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// PATCH /api/categories/:id - Update category
// Requires ADMIN role
router.patch('/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { name, allowCustomTitle } = req.body;

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(allowCustomTitle !== undefined && { allowCustomTitle }),
    },
  });

  res.json({
    success: true,
    data: category,
  });
});

// DELETE /api/categories/:id - Delete category
// Requires ADMIN role
// Supports cascade delete with ?cascade=true query parameter
router.delete('/:id', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { cascade } = req.query;

  // Check if category has children
  const childCount = await prisma.category.count({
    where: { parentId: id },
  });

  if (childCount > 0 && cascade !== 'true') {
    return res.status(400).json({
      success: false,
      error: `Cannot delete category with ${childCount} subcategories. Delete subcategories first.`,
      canCascade: true,
      childCount,
    });
  }

  // Check if category is used in any incidents (including children if cascade)
  const categoryIds = cascade === 'true' 
    ? [id, ...(await prisma.category.findMany({ where: { parentId: id }, select: { id: true } })).map((c: any) => c.id)]
    : [id];

  const incidentCount = await prisma.incident.count({
    where: { categoryId: { in: categoryIds } },
  });

  if (incidentCount > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete category that has ${incidentCount} incident(s) associated with it.`,
      canCascade: false,
    });
  }

  // If cascade delete, delete all children first
  if (cascade === 'true' && childCount > 0) {
    await prisma.category.deleteMany({
      where: { parentId: id },
    });
  }

  // Delete the category
  await prisma.category.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: cascade === 'true' && childCount > 0
      ? `Category and ${childCount} subcategories deleted successfully`
      : 'Category deleted successfully',
  });
});

// POST /api/categories/populate - Populate categories with Food Safety, Machine & Equipment, and Workplace Safety data
// Accessible to ADMIN users - allows adding categories even if some exist
router.post('/populate', requireMinimumRole(UserRole.ADMIN), async (req, res) => {
  const { organizationId } = req.body;

  if (!organizationId) {
    throw new ValidationError('Organization ID is required');
  }

  // Check if organization already has categories populated
  const existingCategoryCount = await prisma.category.count({
    where: { organizationId },
  });

  if (existingCategoryCount > 0) {
    return res.status(409).json({
      success: false,
      error: 'Categories already exist for this organization',
      message: `This organization already has ${existingCategoryCount} categories. Data population is only allowed for organizations without existing categories.`,
      existingCount: existingCategoryCount,
    });
  }

  let foodSafetyAdded = 0;
  let machineEquipmentAdded = 0;
  let workplaceSafetyAdded = 0;
  let skippedCategories: string[] = [];

  // Food Safety Main Categories with comprehensive subcategories
  const foodSafetyCategories = [
    { 
      name: 'Foreign Material', 
      subcategories: ['Metal', 'Plastic', 'Glass', 'Wood', 'Stone/Rocks', 'Rubber', 'Paper/Cardboard', 'Insects/Pests', 'Hair/Personal Items', 'Other Foreign Material'] 
    },
    { 
      name: 'Microbiological', 
      subcategories: ['Salmonella', 'Listeria', 'E. coli', 'Staphylococcus', 'Campylobacter', 'Yeast & Mold', 'Coliforms', 'Total Plate Count (TPC)', 'Enterobacteriaceae', 'Other Microbiological'] 
    },
    { 
      name: 'Allergen', 
      subcategories: ['Milk/Dairy', 'Eggs', 'Fish', 'Shellfish/Crustaceans', 'Tree Nuts', 'Peanuts', 'Wheat/Gluten', 'Soy', 'Sesame', 'Cross-Contact', 'Undeclared Allergen', 'Other Allergen'] 
    },
    { 
      name: 'Labeling', 
      subcategories: ['Missing Label', 'Incorrect Information', 'Wrong Product Label', 'Missing Allergen Declaration', 'Incorrect Date Code', 'Barcode Error', 'Missing Nutritional Info', 'Language/Translation Error', 'Other Labeling'] 
    },
    { 
      name: 'Temperature', 
      subcategories: ['Cold Chain Break', 'Cooking Temperature', 'Cooling Rate Issue', 'Hot Holding Issue', 'Cold Storage Issue', 'Freezer Malfunction', 'Temperature Abuse', 'Refrigeration Failure', 'Other Temperature'] 
    },
    { 
      name: 'Sanitation', 
      subcategories: ['Equipment Cleanliness', 'Personnel Hygiene', 'Cross-Contamination', 'Pest Activity', 'Floor/Drain Issues', 'Chemical Residue', 'Handwashing Compliance', 'Sanitation Schedule', 'Other Sanitation'] 
    },
    { 
      name: 'Supplier', 
      subcategories: ['Quality Issue', 'Wrong Product Received', 'Damaged Goods', 'Missing Documentation', 'Expired Product', 'Incorrect Quantity', 'Contaminated Raw Material', 'Temperature Violation', 'Other Supplier'] 
    },
    { 
      name: 'Packaging', 
      subcategories: ['Damaged Package', 'Seal Failure', 'Leaking Container', 'Torn Wrapper', 'Missing Component', 'Incorrect Packaging', 'Defective Material', 'Vacuum/MAP Failure', 'Other Packaging'] 
    },
  ];

  // Process Food Safety categories
  for (const cat of foodSafetyCategories) {
    // Check if main category already exists
    const existingMain = await prisma.category.findFirst({
      where: {
        organizationId,
        type: 'FOOD_SAFETY',
        name: cat.name,
        parentId: null,
      },
    });

    if (existingMain) {
      skippedCategories.push(`Food Safety > ${cat.name}`);
      continue;
    }

    // Create main category
    const mainCategory = await prisma.category.create({
      data: {
        name: cat.name,
        organizationId,
        type: 'FOOD_SAFETY' as any,
        parentId: null,
        allowCustomTitle: false,
      },
    });

    // Create subcategories
    if (cat.subcategories.length > 0) {
      await prisma.category.createMany({
        data: cat.subcategories.map((sub, index) => ({
          name: sub,
          organizationId,
          type: 'FOOD_SAFETY' as any,
          parentId: mainCategory.id,
          allowCustomTitle: sub.toLowerCase().includes('other'),
          sortOrder: index,
        })),
      });
    }

    foodSafetyAdded++;
  }

  // Machine & Equipment Main Categories with comprehensive subcategories
  const machineCategories = [
    { 
      name: 'Mechanical', 
      subcategories: ['Bearing Failure', 'Belt/Chain Issues', 'Gear Problems', 'Shaft Misalignment', 'Coupling Failure', 'Vibration', 'Wear & Tear', 'Jam/Blockage', 'Other Mechanical'] 
    },
    { 
      name: 'Electrical', 
      subcategories: ['Motor Failure', 'Wiring Issue', 'Circuit Breaker Trip', 'Overheating', 'Short Circuit', 'Power Supply', 'Ground Fault', 'Connector Issues', 'Other Electrical'] 
    },
    { 
      name: 'Controls', 
      subcategories: ['PLC Error', 'HMI Malfunction', 'Software Issue', 'Programming Error', 'Network/Communication', 'Touchscreen Failure', 'Controller Fault', 'Emergency Stop', 'Other Controls'] 
    },
    { 
      name: 'Pneumatics', 
      subcategories: ['Air Leak', 'Cylinder Failure', 'Valve Malfunction', 'Low Air Pressure', 'Hose Damage', 'Fitting Issues', 'Compressor Issue', 'Filter/Regulator', 'Other Pneumatics'] 
    },
    { 
      name: 'Sensors', 
      subcategories: ['Proximity Sensor', 'Photo Eye', 'Temperature Sensor', 'Pressure Sensor', 'Flow Sensor', 'Level Sensor', 'Encoder Failure', 'Vision System', 'Other Sensors'] 
    },
    { 
      name: 'Lubrication', 
      subcategories: ['Insufficient Lubrication', 'Contaminated Lubricant', 'Wrong Lubricant Type', 'Lubrication System Failure', 'Seal Leak', 'Grease Fitting Issue', 'Oil Level Low', 'Lubrication Schedule', 'Other Lubrication'] 
    },
    { 
      name: 'Calibration', 
      subcategories: ['Weight/Scale Calibration', 'Temperature Calibration', 'Pressure Calibration', 'Flow Calibration', 'Dimensional Calibration', 'Sensor Calibration', 'Timing Calibration', 'Speed Calibration', 'Other Calibration'] 
    },
    { 
      name: 'Changeover', 
      subcategories: ['Setup Error', 'Missing Parts', 'Incorrect Settings', 'Tooling Issue', 'Recipe/Program Error', 'Size Change Issue', 'Format Change Issue', 'Delay/Extended Time', 'Other Changeover'] 
    },
  ];

  // Process Machine & Equipment categories
  for (const cat of machineCategories) {
    // Check if main category already exists
    const existingMain = await prisma.category.findFirst({
      where: {
        organizationId,
        type: 'MACHINE_EQUIPMENT',
        name: cat.name,
        parentId: null,
      },
    });

    if (existingMain) {
      skippedCategories.push(`Machine & Equipment > ${cat.name}`);
      continue;
    }

    // Create main category
    const mainCategory = await prisma.category.create({
      data: {
        name: cat.name,
        organizationId,
        type: 'MACHINE_EQUIPMENT' as any,
        parentId: null,
        allowCustomTitle: false,
      },
    });

    // Create subcategories
    if (cat.subcategories.length > 0) {
      await prisma.category.createMany({
        data: cat.subcategories.map((sub, index) => ({
          name: sub,
          organizationId,
          type: 'MACHINE_EQUIPMENT' as any,
          parentId: mainCategory.id,
          allowCustomTitle: sub.toLowerCase().includes('other'),
          sortOrder: index,
        })),
      });
    }

    machineEquipmentAdded++;
  }

  // Workplace Safety Main Categories with comprehensive subcategories
  const workplaceSafetyCategories = [
    { 
      name: 'Physical Injury Hazards', 
      subcategories: ['Slips, Trips & Falls', 'Cuts, Lacerations & Abrasions', 'Punctures', 'Bruises / Contusions', 'Struck-By Objects', 'Caught-In / Caught-Between', 'Pinch Points', 'Falling Objects', 'Head Injuries', 'Eye Injuries', 'Hand & Finger Injuries', 'Foot & Ankle Injuries'] 
    },
    { 
      name: 'Ergonomic & Musculoskeletal Safety', 
      subcategories: ['Manual Material Handling', 'Overexertion', 'Repetitive Motion', 'Awkward Postures', 'Forceful Exertions', 'Push / Pull Hazards', 'Lifting & Carrying', 'Cumulative Trauma Disorders (CTD)'] 
    },
    { 
      name: 'Machine & Equipment Safety', 
      subcategories: ['Machine Guarding', 'Lockout / Tagout (LOTO)', 'Mechanical Hazards', 'Electrical Hazards', 'Pneumatic / Hydraulic Hazards', 'Sensors & Interlocks', 'Emergency Stops', 'Unexpected Startup', 'Unsafe Changeovers', 'Maintenance Safety'] 
    },
    { 
      name: 'Chemical & Hazardous Materials Safety', 
      subcategories: ['Chemical Exposure', 'Ammonia Exposure', 'Cleaning & Sanitation Chemicals', 'SDS / GHS Labeling', 'Chemical Storage', 'Chemical Spills', 'Incompatible Chemical Mixing', 'Compressed Gases', 'Chemical PPE'] 
    },
    { 
      name: 'Environmental & Exposure Hazards', 
      subcategories: ['Heat Stress', 'Cold Stress', 'Noise Exposure (Hearing Conservation)', 'Air Quality / Ventilation', 'Dust Exposure', 'Fumes & Vapors', 'Lighting Deficiencies', 'Radiation (where applicable)'] 
    },
    { 
      name: 'Fire & Emergency Safety', 
      subcategories: ['Fire Hazards', 'Flammable Materials', 'Emergency Evacuation', 'Alarm Systems', 'Emergency Exits & Egress', 'Fire Suppression Systems', 'Emergency Drills', 'First Aid & AED', 'Emergency Response Procedures'] 
    },
    { 
      name: 'Material Handling & Traffic Safety', 
      subcategories: ['Forklift Safety', 'Pallet Jack Safety', 'Dock Safety', 'Trailer Safety', 'Load Securing', 'Pedestrian vs Vehicle Traffic', 'Racking & Storage Safety'] 
    },
    { 
      name: 'Personal Protective Equipment (PPE)', 
      subcategories: ['Head Protection', 'Eye & Face Protection', 'Hand Protection', 'Foot Protection', 'Hearing Protection', 'Respiratory Protection', 'Chemical-Resistant PPE', 'High-Visibility PPE'] 
    },
    { 
      name: 'Facility & Infrastructure Safety', 
      subcategories: ['Floors & Walkways', 'Stairs & Handrails', 'Platforms & Mezzanines', 'Doors & Dock Plates', 'Roof Leaks / Condensation (Slip Risk)', 'Housekeeping', 'Structural Integrity'] 
    },
    { 
      name: 'Behavioral, Training & Compliance Safety', 
      subcategories: ['Unsafe Acts', 'SOP Non-Compliance', 'Lack of Training', 'Failure to Use PPE', 'Near Misses', 'Incident Reporting', 'Contractor Safety', 'Visitor Safety', 'Work Rule Violations'] 
    },
    { 
      name: 'Health & Medical Management', 
      subcategories: ['First Aid', 'OSHA Recordable Injuries', 'Restricted Duty', 'Lost Time Injuries', 'Occupational Illness', 'Return-to-Work', 'Fatigue Management'] 
    },
  ];

  // Process Workplace Safety categories
  for (const cat of workplaceSafetyCategories) {
    // Check if main category already exists
    const existingMain = await prisma.category.findFirst({
      where: {
        organizationId,
        type: 'WORKPLACE_SAFETY',
        name: cat.name,
        parentId: null,
      },
    });

    if (existingMain) {
      skippedCategories.push(`Workplace Safety > ${cat.name}`);
      continue;
    }

    // Create main category
    const mainCategory = await prisma.category.create({
      data: {
        name: cat.name,
        organizationId,
        type: 'WORKPLACE_SAFETY' as any,
        parentId: null,
        allowCustomTitle: false,
      },
    });

    // Create subcategories
    if (cat.subcategories.length > 0) {
      await prisma.category.createMany({
        data: cat.subcategories.map((sub, index) => ({
          name: sub,
          organizationId,
          type: 'WORKPLACE_SAFETY' as any,
          parentId: mainCategory.id,
          allowCustomTitle: sub.toLowerCase().includes('other'),
          sortOrder: index,
        })),
      });
    }

    workplaceSafetyAdded++;
  }

  const message = skippedCategories.length > 0
    ? `Populated ${foodSafetyAdded} Food Safety, ${machineEquipmentAdded} Machine & Equipment, and ${workplaceSafetyAdded} Workplace Safety categories. Skipped existing: ${skippedCategories.join(', ')}`
    : `Successfully populated ${foodSafetyAdded} Food Safety, ${machineEquipmentAdded} Machine & Equipment, and ${workplaceSafetyAdded} Workplace Safety categories with all subcategories`;

  res.status(201).json({
    success: true,
    message,
    data: {
      foodSafetyAdded,
      machineEquipmentAdded,
      workplaceSafetyAdded,
      skippedCategories,
    },
  });
});

// POST /api/categories/seed - Seed default categories for an organization
router.post('/seed', requireMinimumRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
  const { organizationId } = req.body;

  if (!organizationId) {
    throw new ValidationError('Organization ID is required');
  }

  // Check if org already has categories
  const existingCount = await prisma.category.count({
    where: { organizationId },
  });

  if (existingCount > 0) {
    throw new ValidationError('Organization already has categories');
  }

  // Food Safety Main Categories with comprehensive subcategories
  const foodSafetyCategories = [
    { 
      name: 'Foreign Material', 
      subcategories: ['Metal', 'Plastic', 'Glass', 'Wood', 'Stone', 'Rubber', 'Paper/Cardboard', 'Insect/Pest', 'Bone Fragment', 'Other'] 
    },
    { 
      name: 'Micro', 
      subcategories: ['Salmonella', 'Listeria', 'E. Coli', 'Campylobacter', 'Yeast/Mold', 'Pathogen Detection', 'High Aerobic Plate Count', 'Other'] 
    },
    { 
      name: 'Allergen', 
      subcategories: ['Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts', 'Wheat', 'Soy', 'Sesame', 'Cross-Contact', 'Undeclared Allergen', 'Other'] 
    },
    { 
      name: 'Labeling', 
      subcategories: ['Missing Label', 'Incorrect Information', 'Wrong Product Label', 'Missing Allergen Declaration', 'Expiration Date Error', 'Barcode Issue', 'Missing Net Weight', 'Language Error', 'Other'] 
    },
    { 
      name: 'Temperature', 
      subcategories: ['Cold Chain Break', 'Cooking Temperature', 'Cooling Rate', 'Hot Holding', 'Cold Storage', 'Freezer Malfunction', 'Temperature Abuse', 'Other'] 
    },
    { 
      name: 'Sanitation', 
      subcategories: ['Equipment Cleanliness', 'Personnel Hygiene', 'Cross-Contamination', 'Pest Activity', 'Floor Drains', 'Wall/Ceiling Issues', 'Chemical Residue', 'Handwashing', 'Other'] 
    },
    { 
      name: 'Supplier', 
      subcategories: ['Quality Issue', 'Wrong Product Received', 'Damaged Goods', 'Missing Documentation', 'Expired Product', 'Incorrect Quantity', 'Contamination', 'Temperature Violation', 'Other'] 
    },
    { 
      name: 'Packaging', 
      subcategories: ['Damaged Package', 'Seal Failure', 'Leaking Container', 'Torn Wrapper', 'Missing Component', 'Incorrect Size', 'Defective Material', 'Vacuum Loss', 'Other'] 
    },
  ];

  for (const cat of foodSafetyCategories) {
    const mainCategory = await prisma.category.create({
      data: {
        name: cat.name,
        organizationId,
        type: 'FOOD_SAFETY' as any,
        parentId: null,
        allowCustomTitle: false,
      },
    });

    if (cat.subcategories.length > 0) {
      await prisma.category.createMany({
        data: cat.subcategories.map((sub, index) => ({
          name: sub,
          organizationId,
          type: 'FOOD_SAFETY' as any,
          parentId: mainCategory.id,
          allowCustomTitle: sub === 'Other',
          sortOrder: index,
        })),
      });
    }
  }

  // Machine & Equipment Main Categories with comprehensive subcategories
  const machineCategories = [
    { 
      name: 'Mechanical', 
      subcategories: ['Bearing Failure', 'Belt/Chain Issues', 'Gear Problems', 'Shaft Misalignment', 'Coupling Failure', 'Vibration', 'Wear/Tear', 'Jam/Blockage', 'Other'] 
    },
    { 
      name: 'Electrical', 
      subcategories: ['Motor Failure', 'Wiring Issue', 'Circuit Breaker Trip', 'Overheating', 'Short Circuit', 'Blown Fuse', 'Power Supply', 'Ground Fault', 'Other'] 
    },
    { 
      name: 'Controls', 
      subcategories: ['PLC Error', 'HMI Malfunction', 'Software Glitch', 'Programming Issue', 'Network Communication', 'Touchscreen Failure', 'Controller Fault', 'Emergency Stop', 'Other'] 
    },
    { 
      name: 'Pneumatics', 
      subcategories: ['Air Leak', 'Cylinder Failure', 'Valve Malfunction', 'Low Air Pressure', 'Hose Damage', 'Fitting Loose', 'Compressor Issue', 'Moisture Problem', 'Other'] 
    },
    { 
      name: 'Hydraulics', 
      subcategories: ['Fluid Leak', 'Pump Failure', 'Cylinder Issue', 'Pressure Loss', 'Contaminated Fluid', 'Valve Problem', 'Hose Rupture', 'Filter Clog', 'Other'] 
    },
    { 
      name: 'Sensors', 
      subcategories: ['Proximity Sensor', 'Photo Eye', 'Temperature Sensor', 'Pressure Sensor', 'Flow Sensor', 'Load Cell', 'Encoder Failure', 'Calibration Error', 'Other'] 
    },
    { 
      name: 'Conveyor', 
      subcategories: ['Belt Tracking', 'Roller Issue', 'Drive Failure', 'Tensioning Problem', 'Guide Rail', 'Splicing', 'Speed Control', 'Accumulation', 'Other'] 
    },
    { 
      name: 'Safety Systems', 
      subcategories: ['Guard Interlock', 'Light Curtain', 'Safety Gate', 'Emergency Stop', 'Lockout/Tagout', 'Safety Relay', 'Guard Damage', 'Bypass Issue', 'Other'] 
    },
  ];

  for (const cat of machineCategories) {
    const mainCategory = await prisma.category.create({
      data: {
        name: cat.name,
        organizationId,
        type: 'MACHINE_EQUIPMENT' as any,
        parentId: null,
        allowCustomTitle: false,
      },
    });

    if (cat.subcategories.length > 0) {
      await prisma.category.createMany({
        data: cat.subcategories.map((sub, index) => ({
          name: sub,
          organizationId,
          type: 'MACHINE_EQUIPMENT' as any,
          parentId: mainCategory.id,
          allowCustomTitle: sub === 'Other',
          sortOrder: index,
        })),
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Default categories seeded successfully',
  });
});

export default router;
