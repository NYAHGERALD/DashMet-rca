import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helper: format date as MM-DD-YYYY ──────────────────────────────────────
function fmtDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const y = d.getFullYear();
  return `${m}-${day}-${y}`;
}

// ─── Helper: get Monday of the week containing the given date ───────────────
function getMonday(d: Date): Date {
  const date = new Date(d);
  const dow = date.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // if Sunday, go back 6
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ─── Helper: get Friday of the week containing the given date ───────────────
function getFriday(d: Date): Date {
  const monday = getMonday(d);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(0, 0, 0, 0);
  return friday;
}

// ─── Auto-generate the current week (Mon–Fri) ──────────────────────────────
async function autoGenerateWeek(): Promise<void> {
  try {
    // Check if auto-week is enabled
    const setting = await prisma.bakeryAutoWeekSetting.findUnique({ where: { id: 1 } });
    if (!setting?.enabled) {
      console.log('⏭️  [AutoWeek] Auto-week generation is disabled, skipping');
      return;
    }

    const now = new Date();
    const monday = getMonday(now);
    const friday = getFriday(now);

    const weekName = `${fmtDate(monday)}_${fmtDate(friday)}`;

    // Check if this week already exists (active)
    const existing = await prisma.bakeryWeeklySheet.findFirst({
      where: { sheetName: weekName, isActive: true },
    });
    if (existing) {
      console.log(`⏭️  [AutoWeek] Week "${weekName}" already exists, skipping`);
      return;
    }

    // Check for date overlap with any existing active week
    const mondayUtc = new Date(`${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}T00:00:00.000Z`);
    const fridayUtc = new Date(`${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, '0')}-${String(friday.getDate()).padStart(2, '0')}T00:00:00.000Z`);

    const overlapping = await prisma.bakeryWeeklySheet.findMany({
      where: { isActive: true },
    });
    for (const w of overlapping) {
      const wStart = new Date(w.weekStart);
      const wEnd = new Date(w.weekEnd);
      if (mondayUtc <= wEnd && fridayUtc >= wStart) {
        console.log(`⏭️  [AutoWeek] Week "${weekName}" overlaps with "${w.sheetName}", skipping`);
        return;
      }
    }

    // Create the week
    await prisma.bakeryWeeklySheet.create({
      data: {
        sheetName: weekName,
        weekStart: mondayUtc,
        weekEnd: fridayUtc,
        isActive: true,
      },
    });

    console.log(`✅ [AutoWeek] Auto-generated week: "${weekName}"`);
  } catch (error) {
    console.error('❌ [AutoWeek] Error during auto-week generation:', error);
  }
}

// ─── Schedule: Every Tuesday at 00:00 ───────────────────────────────────────
// Cron format: second minute hour dayOfMonth month dayOfWeek
// '0 0 * * 2' = At 00:00 on Tuesday
let cronTask: cron.ScheduledTask | null = null;

export function startAutoWeekCron(): void {
  if (cronTask) {
    console.log('⚠️  [AutoWeek] Cron already running');
    return;
  }
  cronTask = cron.schedule('0 0 * * 2', async () => {
    console.log(`🕛 [AutoWeek] Tuesday midnight cron triggered at ${new Date().toISOString()}`);
    await autoGenerateWeek();
  }, {
    timezone: 'America/New_York', // Adjust to your local timezone
  });

  console.log('⏰ [AutoWeek] Cron job scheduled — runs every Tuesday at 00:00 (America/New_York)');
}

export function stopAutoWeekCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('🛑 [AutoWeek] Cron job stopped');
  }
}

// ─── Expose manual trigger for testing ──────────────────────────────────────
export { autoGenerateWeek };
