#!/usr/bin/env python3
"""
Backup data from old Flask bakery_metrics_db and seed it into new dashmet_rca_db.

Steps:
  1. Connect to OLD Flask DB (bakery_metrics_db on Render)
  2. Export all relevant data to JSON backup files
  3. Connect to NEW dashmet_rca_db on Render
  4. Insert data into the new Prisma-managed tables

IMPORTANT: This does NOT delete data from the old database.
"""

import psycopg2
import psycopg2.extras
import json
import os
from datetime import datetime, date
from decimal import Decimal

# ─── Connection URLs ────────────────────────────────────────────────────────────
OLD_DB_URL = "postgresql://bakery_users:IxGvEFj3amonfr9GeEnYWn89pFsFVky3@dpg-d2kgot15pdvs739jqlng-a.oregon-postgres.render.com/bakery_metrics_db"
NEW_DB_URL = "postgresql://dashmet_rca_db_user:hfBZmZ9jul9CgNndTVw4yYONgdqWbi8b@dpg-d5s3hcogjchc73f8kh30-a.oregon-postgres.render.com/dashmet_rca_db"

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'backups', 'bakery-metrics-migration')

# ─── JSON serializer for dates/decimals ─────────────────────────────────────────
class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def fetch_all(conn, table):
    """Fetch all rows from a table as list of dicts."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"SELECT * FROM {table} ORDER BY id")
    rows = cur.fetchall()
    return [dict(r) for r in rows]


def backup_to_json(data, filename):
    """Save data to a JSON file."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, cls=CustomEncoder, indent=2)
    print(f"  ✅ Backed up {len(data)} rows → {filepath}")
    return filepath


def main():
    print("=" * 70)
    print("BAKERY METRICS DATA MIGRATION")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 70)

    # ═══ STEP 1: BACKUP FROM OLD DB ═══
    print("\n📥 STEP 1: Backing up data from old Flask database...")
    old_conn = psycopg2.connect(OLD_DB_URL)

    tables = {
        'weekly_sheets': 'weekly_sheets.json',
        'week_submissions': 'week_submissions.json',
        'first_shift_metrics': 'first_shift_metrics.json',
        'second_shift_metrics': 'second_shift_metrics.json',
        'both_shifts_metrics': 'both_shifts_metrics.json',
        'kpi_targets': 'kpi_targets.json',
        'kpi_targets_history': 'kpi_targets_history.json',
        'submission_logs': 'submission_logs.json',
    }

    backups = {}
    for table, filename in tables.items():
        print(f"\n  📋 {table}...")
        data = fetch_all(old_conn, table)
        backup_to_json(data, filename)
        backups[table] = data

    old_conn.close()
    print(f"\n✅ Backup complete! {sum(len(v) for v in backups.values())} total rows saved.")

    # ═══ STEP 2: SEED INTO NEW DB ═══
    print("\n\n📤 STEP 2: Seeding data into new dashmet_rca_db...")
    new_conn = psycopg2.connect(NEW_DB_URL)
    new_conn.autocommit = False
    cur = new_conn.cursor()

    try:
        # ── 2a: Weekly Sheets ──
        print("\n  📋 bakery_weekly_sheets...")
        count = 0
        for row in backups['weekly_sheets']:
            cur.execute("""
                INSERT INTO bakery_weekly_sheets (id, "sheetName", "weekStart", "weekEnd", "isActive", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (
                str(row['id']),
                row['sheet_name'],
                row['week_start'],
                row['week_end'],
                row['is_active'],
                row['created_at'],
                row['updated_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} weekly sheets")

        # ── 2b: Week Submissions ──
        print("\n  📋 bakery_week_submissions...")
        count = 0
        for row in backups['week_submissions']:
            cur.execute("""
                INSERT INTO bakery_week_submissions (id, "weekName", "weekStart", "weekEnd", "dayOfWeek", "submittedBy", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (
                str(row['id']),
                row['week_name'],
                row['week_start'],
                row['week_end'],
                row['day_of_week'],
                row['submitted_by'],
                row['created_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} week submissions")

        # ── 2c: First Shift Metrics ──
        print("\n  📋 bakery_first_shift_metrics...")
        count = 0
        for row in backups['first_shift_metrics']:
            cur.execute("""
                INSERT INTO bakery_first_shift_metrics ("weekSubmissionId", "dieCut1OeePct", "dieCut2OeePct", "oeeAvgPct", "dieCut1Lbs", "dieCut2Lbs", "poundsTotal", "dieCut1WasteLb", "dieCut2WasteLb", "dieCut1WastePct", "dieCut2WastePct", "wasteAvgPct", "submittedBy", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("weekSubmissionId") DO NOTHING
            """, (
                str(row['week_submission_id']),
                row['die_cut1_oee_pct'],
                row['die_cut2_oee_pct'],
                row['oee_avg_pct'],
                row['die_cut1_lbs'],
                row['die_cut2_lbs'],
                row['pounds_total'],
                row['die_cut1_waste_lb'],
                row['die_cut2_waste_lb'],
                row['die_cut1_waste_pct'],
                row['die_cut2_waste_pct'],
                row['waste_avg_pct'],
                row['submitted_by'],
                row['created_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} first shift metrics")

        # ── 2d: Second Shift Metrics ──
        print("\n  📋 bakery_second_shift_metrics...")
        count = 0
        for row in backups['second_shift_metrics']:
            cur.execute("""
                INSERT INTO bakery_second_shift_metrics ("weekSubmissionId", "dieCut1OeePct", "dieCut2OeePct", "oeeAvgPct", "dieCut1Lbs", "dieCut2Lbs", "poundsTotal", "dieCut1WasteLb", "dieCut2WasteLb", "dieCut1WastePct", "dieCut2WastePct", "wasteAvgPct", "submittedBy", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("weekSubmissionId") DO NOTHING
            """, (
                str(row['week_submission_id']),
                row['die_cut1_oee_pct'],
                row['die_cut2_oee_pct'],
                row['oee_avg_pct'],
                row['die_cut1_lbs'],
                row['die_cut2_lbs'],
                row['pounds_total'],
                row['die_cut1_waste_lb'],
                row['die_cut2_waste_lb'],
                row['die_cut1_waste_pct'],
                row['die_cut2_waste_pct'],
                row['waste_avg_pct'],
                row['submitted_by'],
                row['created_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} second shift metrics")

        # ── 2e: Both Shifts Metrics ──
        print("\n  📋 bakery_both_shifts_metrics...")
        count = 0
        for row in backups['both_shifts_metrics']:
            cur.execute("""
                INSERT INTO bakery_both_shifts_metrics ("weekSubmissionId", "dieCut1OeePct", "dieCut2OeePct", "oeeAvgPct", "dieCut1Lbs", "dieCut2Lbs", "poundsTotal", "dieCut1WasteLb", "dieCut2WasteLb", "dieCut1WastePct", "dieCut2WastePct", "wasteAvgPct", "submittedBy", "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("weekSubmissionId") DO NOTHING
            """, (
                str(row['week_submission_id']),
                row['die_cut1_oee_pct'],
                row['die_cut2_oee_pct'],
                row['oee_avg_pct'],
                row['die_cut1_lbs'],
                row['die_cut2_lbs'],
                row['pounds_total'],
                row['die_cut1_waste_lb'],
                row['die_cut2_waste_lb'],
                row['die_cut1_waste_pct'],
                row['die_cut2_waste_pct'],
                row['waste_avg_pct'],
                row['submitted_by'],
                row['created_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} both shifts metrics")

        # ── 2f: KPI Targets ──
        print("\n  📋 bakery_kpi_targets...")
        count = 0
        for row in backups['kpi_targets']:
            cur.execute("""
                INSERT INTO bakery_kpi_targets ("metricType", "metricName", "targetValue", "unit", "comparisonType", "updatedBy", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("metricType", "metricName") DO UPDATE SET
                    "targetValue" = EXCLUDED."targetValue",
                    "unit" = EXCLUDED."unit",
                    "comparisonType" = EXCLUDED."comparisonType",
                    "updatedBy" = EXCLUDED."updatedBy",
                    "updatedAt" = EXCLUDED."updatedAt"
            """, (
                row['metric_type'],
                row['metric_name'],
                row['target_value'],
                row['unit'],
                row['comparison_type'],
                row['updated_by'],
                row['updated_at'],
            ))
            count += 1
        print(f"  ✅ Upserted {count} KPI targets")

        # ── 2g: KPI Targets History ──
        print("\n  📋 bakery_kpi_targets_history...")
        count = 0
        for row in backups['kpi_targets_history']:
            cur.execute("""
                INSERT INTO bakery_kpi_targets_history ("metricType", "metricName", "oldValue", "newValue", "changedBy", "changedAt")
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                row['metric_type'],
                row['metric_name'],
                row['old_value'],
                row['new_value'],
                row['changed_by'],
                row['changed_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} KPI target history entries")

        # ── 2h: Submission Logs ──
        print("\n  📋 bakery_submission_logs...")
        count = 0
        for row in backups['submission_logs']:
            cur.execute("""
                INSERT INTO bakery_submission_logs (id, "userId", "userName", "userEmail", "submissionType", message, "weekSheet", "dayOfWeek", success, "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (
                str(row['id']),
                str(row['user_id']) if row['user_id'] else None,
                row['user_name'],
                row['user_email'],
                row['submission_type'],
                row['message'],
                row['week_sheet'],
                row['day_of_week'],
                row['success'],
                row['created_at'],
            ))
            count += cur.rowcount
        print(f"  ✅ Inserted {count} submission logs")

        # ── COMMIT ──
        new_conn.commit()
        print("\n✅ ALL DATA COMMITTED SUCCESSFULLY!")

    except Exception as e:
        new_conn.rollback()
        print(f"\n❌ ERROR — transaction rolled back: {e}")
        raise
    finally:
        cur.close()
        new_conn.close()

    # ═══ STEP 3: VERIFY ═══
    print("\n\n🔍 STEP 3: Verifying data in new database...")
    verify_conn = psycopg2.connect(NEW_DB_URL)
    verify_cur = verify_conn.cursor()

    new_tables = [
        'bakery_weekly_sheets',
        'bakery_week_submissions',
        'bakery_first_shift_metrics',
        'bakery_second_shift_metrics',
        'bakery_both_shifts_metrics',
        'bakery_kpi_targets',
        'bakery_kpi_targets_history',
        'bakery_submission_logs',
    ]

    for table in new_tables:
        verify_cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = verify_cur.fetchone()[0]
        print(f"  {table}: {count} rows")

    verify_conn.close()

    print("\n" + "=" * 70)
    print("🎉 MIGRATION COMPLETE!")
    print("  - Old data is UNTOUCHED in bakery_metrics_db")
    print(f"  - Backups saved in: {os.path.abspath(BACKUP_DIR)}")
    print("  - New tables populated in dashmet_rca_db")
    print("=" * 70)


if __name__ == '__main__':
    main()
