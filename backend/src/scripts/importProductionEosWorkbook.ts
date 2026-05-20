import path from 'path';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';

const DEFAULT_WORKBOOK_NAME = 'End of Shift Report 05-15-2026.xlsx';
const RATES_SHEET_NAME = 'Rates';
const TEMPORARY_LINE_SHEET_NAME = '75% Temporary Data L3 & L5';

const args = process.argv.slice(2);

function getArg(name: string) {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.split('=').slice(1).join('=').trim() : undefined;
}

function cellToValue(cell: ExcelJS.Cell) {
  const value = cell.value as any;
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value) return value.result ?? null;
    if ('text' in value) return value.text ?? null;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: any) => part.text || '').join('');
    }
    if ('formula' in value) {
      return value.result ?? null;
    }
  }
  return value;
}

function normalizeText(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function clampText(value: string | null, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function main() {
  const workbookPath = path.resolve(
    process.cwd(),
    getArg('workbook') || path.join('..', DEFAULT_WORKBOOK_NAME),
  );

  const organizationId =
    getArg('organizationId') ||
    (await prisma.organization.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }))?.id;

  if (!organizationId) {
    throw new Error('No organization found. Pass --organizationId=<id> or seed an organization first.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  let imported = 0;
  const rowsToCreate: Prisma.ProductionEosRateReferenceCreateManyInput[] = [];
  const replaceExisting = args.includes('--replace') || getArg('replace') === 'true';

  const sheet = workbook.getWorksheet(RATES_SHEET_NAME);
  if (!sheet) {
    throw new Error(`Workbook is missing required sheet: ${RATES_SHEET_NAME}`);
  }

  const temporaryHeadcountByItem = new Map<string, { temporaryAssemblyHeadcount: number | null; temporaryPackHeadcount: number | null }>();
  const temporarySheet = workbook.getWorksheet(TEMPORARY_LINE_SHEET_NAME);
  if (temporarySheet) {
    for (let rowNumber = 5; rowNumber <= temporarySheet.rowCount; rowNumber += 1) {
      const itemNo = clampText(normalizeText(cellToValue(temporarySheet.getCell(`B${rowNumber}`))), 80);
      if (!itemNo) continue;
      temporaryHeadcountByItem.set(itemNo, {
        temporaryAssemblyHeadcount: numberOrNull(cellToValue(temporarySheet.getCell(`C${rowNumber}`))),
        temporaryPackHeadcount: numberOrNull(cellToValue(temporarySheet.getCell(`D${rowNumber}`))),
      });
    }
  }

  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const itemNo = clampText(normalizeText(cellToValue(sheet.getCell(`A${rowNumber}`))), 80);
    const description = normalizeText(cellToValue(sheet.getCell(`B${rowNumber}`)));
    if (!itemNo || !description) continue;
    const temporaryHeadcount = temporaryHeadcountByItem.get(itemNo);

    rowsToCreate.push({
      id: uuidv4(),
      organizationId,
      sourceRowNumber: rowNumber,
      itemNo,
      description,
      totalAssemblyHeadcount: numberOrNull(cellToValue(sheet.getCell(`W${rowNumber}`))) as any,
      totalPackHeadcount: numberOrNull(cellToValue(sheet.getCell(`AY${rowNumber}`))) as any,
      temporaryAssemblyHeadcount: temporaryHeadcount?.temporaryAssemblyHeadcount as any,
      temporaryPackHeadcount: temporaryHeadcount?.temporaryPackHeadcount as any,
      weightPerCaseLb: numberOrNull(cellToValue(sheet.getCell(`BR${rowNumber}`))) as any,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    imported += 1;
  }

  if (replaceExisting) {
    await prisma.productionEosRateReference.deleteMany({ where: { organizationId } });
  }

  const batchSize = 500;
  for (let index = 0; index < rowsToCreate.length; index += batchSize) {
    const batch = rowsToCreate.slice(index, index + batchSize);
    await prisma.productionEosRateReference.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  console.log('Production EOS Rates reference import complete.');
  console.log(JSON.stringify({
    organizationId,
    workbookPath,
    imported,
    temporaryHeadcountRows: temporaryHeadcountByItem.size,
    replaceExisting,
    sourceSheets: [RATES_SHEET_NAME, TEMPORARY_LINE_SHEET_NAME],
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Production EOS reference import failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
