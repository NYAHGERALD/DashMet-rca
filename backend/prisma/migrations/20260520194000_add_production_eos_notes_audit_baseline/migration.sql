ALTER TABLE "production_eos_reports"
ADD COLUMN IF NOT EXISTS "notesAuditBaseline" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "production_eos_reports" AS report
SET "notesAuditBaseline" = jsonb_build_object(
  'version', 1,
  'safetyConcerns', report."safetyConcerns",
  'qualityIssues', report."qualityIssues",
  'notes', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'lineGroup', note."lineGroup",
        'notes', note."notes",
        'sortOrder', note."sortOrder"
      )
      ORDER BY note."sortOrder", note."lineGroup"
    )
    FROM "production_eos_report_notes" AS note
    WHERE note."reportId" = report."id"
  ), '[]'::jsonb)
);
