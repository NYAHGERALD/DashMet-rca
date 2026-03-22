#!/usr/bin/env python3
"""Inspect the old Flask bakery_metrics_db to get schemas and row counts for relevant tables."""

import psycopg2
import json

OLD_DB_URL = "postgresql://bakery_users:IxGvEFj3amonfr9GeEnYWn89pFsFVky3@dpg-d2kgot15pdvs739jqlng-a.oregon-postgres.render.com/bakery_metrics_db"

RELEVANT_TABLES = [
    'first_shift_metrics',
    'second_shift_metrics',
    'both_shifts_metrics',
    'kpi_targets',
    'kpi_targets_history',
    'week_submissions',
    'weekly_sheets',
    'submission_logs',
]

conn = psycopg2.connect(OLD_DB_URL)
cur = conn.cursor()

for table in RELEVANT_TABLES:
    print(f"\n{'='*80}")
    print(f"TABLE: {table}")
    print('='*80)

    # Get row count
    cur.execute(f"SELECT COUNT(*) FROM {table};")
    count = cur.fetchone()[0]
    print(f"Rows: {count}")

    # Get column definitions
    cur.execute(f"""
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = '{table}' AND table_schema = 'public'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    print(f"Columns ({len(cols)}):")
    for col in cols:
        name, dtype, nullable, default, max_len = col
        info = f"  {name}: {dtype}"
        if max_len:
            info += f"({max_len})"
        if nullable == 'NO':
            info += " NOT NULL"
        if default:
            info += f" DEFAULT {default}"
        print(info)

    # Show sample row if data exists
    if count > 0:
        cur.execute(f"SELECT * FROM {table} LIMIT 1;")
        row = cur.fetchone()
        col_names = [desc[0] for desc in cur.description]
        print(f"\nSample row:")
        for cn, val in zip(col_names, row):
            print(f"  {cn} = {val}")

conn.close()
print("\nDone!")
