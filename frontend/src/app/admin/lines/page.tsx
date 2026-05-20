'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import { DashTimeDisplay, DashTimeField } from '@/components/ui/DashDateTimeFields';

interface Area {
  id: string;
  name: string;
  department?: {
    id: string;
    name: string;
    facility?: {
      id: string;
      name: string;
    };
  };
}

interface Line {
  id: string;
  name: string;
  lineNumber?: string | null;
  scheduledStartTime?: string | null;
  scheduledStartTimes?: LineScheduledStartTime[];
  areaId: string;
  area?: Area;
  _count?: {
    shifts: number;
  };
}

interface ShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  Facility?: {
    id: string;
    name: string;
  } | null;
  facility?: {
    id: string;
    name: string;
  } | null;
}

interface LineScheduledStartTime {
  id?: string;
  shiftId: string;
  scheduledStartTime: string;
  Shift?: ShiftOption | null;
  shift?: ShiftOption | null;
}

type ScheduledStartFormRow = {
  shiftId: string;
  scheduledStartTime: string;
};

function numericLineNumber(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function lineNumberLabel(lineNumber: string) {
  return lineNumber ? `Line ${lineNumber}` : 'Line';
}

function lineNamePrefix(storedName: string, lineNumber: string) {
  const label = lineNumberLabel(numericLineNumber(lineNumber));
  return storedName.replace(new RegExp(`\\s+${label.replace(/\s+/g, '\\s+')}$`, 'i'), '').trim();
}

function cleanLineName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function finalLineName(prefix: string, lineNumber: string) {
  const cleanPrefix = cleanLineName(prefix);
  const cleanLineNumber = numericLineNumber(lineNumber);
  return cleanPrefix && cleanLineNumber ? `${cleanPrefix} ${lineNumberLabel(cleanLineNumber)}` : cleanPrefix;
}

function emptyScheduledStartRow(): ScheduledStartFormRow {
  return { shiftId: '', scheduledStartTime: '' };
}

function shiftNumber(shift?: ShiftOption | null) {
  const name = String(shift?.name || '').toLowerCase();
  if (/\b(first|1st)\b/.test(name)) return 1;
  if (/\b(second|2nd)\b/.test(name)) return 2;
  if (/\b(third|3rd)\b/.test(name)) return 3;
  const numericMatch = name.match(/\bshift\s*(\d+)\b/) || name.match(/\b(\d+)\s*shift\b/);
  return numericMatch ? Number(numericMatch[1]) : null;
}

function minutesFromTime(value?: string | null) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function compareShifts(a?: ShiftOption | null, b?: ShiftOption | null) {
  const aNumber = shiftNumber(a);
  const bNumber = shiftNumber(b);
  if (aNumber !== null || bNumber !== null) {
    if (aNumber === null) return 1;
    if (bNumber === null) return -1;
    if (aNumber !== bNumber) return aNumber - bNumber;
  }

  const startDiff = minutesFromTime(a?.startTime) - minutesFromTime(b?.startTime);
  if (startDiff !== 0) return startDiff;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function ordinal(value: number) {
  const suffix = value % 10 === 1 && value % 100 !== 11
    ? 'st'
    : value % 10 === 2 && value % 100 !== 12
      ? 'nd'
      : value % 10 === 3 && value % 100 !== 13
        ? 'rd'
        : 'th';
  return `${value}${suffix}`;
}

function shiftHeaderLabel(shift: ShiftOption) {
  const number = shiftNumber(shift);
  return number ? `${ordinal(number)} Shift Start` : 'Shift Start';
}

function scheduleShift(schedule: LineScheduledStartTime, shiftsById: Map<string, ShiftOption>) {
  return schedule.Shift || schedule.shift || shiftsById.get(schedule.shiftId) || null;
}

function sortLineScheduledStartTimes(schedules: LineScheduledStartTime[], shiftsById: Map<string, ShiftOption>) {
  return [...schedules].sort((a, b) => compareShifts(scheduleShift(a, shiftsById), scheduleShift(b, shiftsById)));
}

export default function LinesPage() {
  const { user } = useAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    lineNumber: '',
    lineNumberNotApplicable: false,
    scheduledStartTimes: [emptyScheduledStartRow()],
    areaId: '',
  });

  const canManageLines = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';
  const shiftsById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);
  const orderedShifts = useMemo(() => [...shifts].sort(compareShifts), [shifts]);
  const scheduledStartColumns = useMemo(() => {
    const columns = new Map<string, ShiftOption>();
    lines.forEach((line) => {
      (line.scheduledStartTimes || []).forEach((schedule) => {
        const shift = scheduleShift(schedule, shiftsById);
        if (shift) columns.set(shift.id, shift);
      });
    });
    return Array.from(columns.values()).sort(compareShifts);
  }, [lines, shiftsById]);
  const scheduledStartColumnCount = scheduledStartColumns.length || 1;
  const tableColumnCount = 5 + scheduledStartColumnCount + (canManageLines ? 1 : 0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linesRes, areasRes, shiftsRes] = await Promise.all([
        api.get('/facilities/lines'),
        api.get('/facilities/areas'),
        api.get('/facilities/shifts'),
      ]);
      
      // Normalize lines data - backend returns Area/Department/Facility (PascalCase)
      const linesData = linesRes.data.data.lines || [];
      const normalizedLines = linesData.map((l: any) => ({
        ...l,
        area: l.Area ? {
          ...l.Area,
          department: l.Area.Department ? {
            ...l.Area.Department,
            facility: l.Area.Department.Facility || l.Area.Department.facility,
          } : l.Area.department,
        } : l.area,
        _count: l._count ? {
          shifts: l._count.ShiftLine || l._count.shifts || 0,
        } : undefined,
        scheduledStartTimes: l.LineScheduledStartTime || l.scheduledStartTimes || [],
      }));
      setLines(normalizedLines);
      
      // Normalize areas data
      const areasData = areasRes.data.data.areas || [];
      const normalizedAreas = areasData.map((a: any) => ({
        ...a,
        department: a.Department ? {
          ...a.Department,
          facility: a.Department.Facility || a.Department.facility,
        } : a.department,
      }));
      setAreas(normalizedAreas);

      setShifts(shiftsRes.data.data.shifts || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const scheduledStartRows = formData.scheduledStartTimes.filter((row) => row.shiftId || row.scheduledStartTime);
      const hasPartialScheduledStart = scheduledStartRows.some((row) => !row.shiftId || !row.scheduledStartTime);
      const duplicateShift = scheduledStartRows.some((row, index) => scheduledStartRows.findIndex((item) => item.shiftId === row.shiftId) !== index);
      if (hasPartialScheduledStart) {
        setError('Each scheduled start needs both a shift and a start time.');
        return;
      }
      if (duplicateShift) {
        setError('Each shift can only be selected once for this line.');
        return;
      }

      const payload = {
        ...formData,
        lineNumber: formData.lineNumberNotApplicable ? null : numericLineNumber(formData.lineNumber),
        name: formData.lineNumberNotApplicable ? cleanLineName(formData.name) : finalLineName(formData.name, formData.lineNumber),
        scheduledStartTimes: scheduledStartRows,
      };

      if (editingLine) {
        await api.patch(`/facilities/lines/${editingLine.id}`, payload);
      } else {
        await api.post('/facilities/lines', payload);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save line');
    }
  };

  const handleEdit = (line: Line) => {
    const cleanLineNumber = numericLineNumber(line.lineNumber);
    const lineNumberNotApplicable = !cleanLineNumber;
    const scheduledStartTimes = sortLineScheduledStartTimes(line.scheduledStartTimes || [], shiftsById)
      .map((row) => ({
        shiftId: row.shiftId,
        scheduledStartTime: row.scheduledStartTime,
      }))
      .filter((row) => row.shiftId && row.scheduledStartTime);

    setEditingLine(line);
    setFormData({
      name: lineNumberNotApplicable ? cleanLineName(line.name) : lineNamePrefix(line.name, cleanLineNumber),
      lineNumber: cleanLineNumber,
      lineNumberNotApplicable,
      scheduledStartTimes: scheduledStartTimes.length ? scheduledStartTimes : [emptyScheduledStartRow()],
      areaId: line.areaId,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this production line? This will also delete all shifts.')) return;

    try {
      await api.delete(`/facilities/lines/${id}`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete line');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      lineNumber: '',
      lineNumberNotApplicable: false,
      scheduledStartTimes: [emptyScheduledStartRow()],
      areaId: '',
    });
    setEditingLine(null);
    setShowForm(false);
  };

  const updateScheduledStartRow = (index: number, field: keyof ScheduledStartFormRow, value: string) => {
    setFormData((prev) => ({
      ...prev,
      scheduledStartTimes: prev.scheduledStartTimes.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      )),
    }));
  };

  const addScheduledStartRow = () => {
    setFormData((prev) => ({
      ...prev,
      scheduledStartTimes: [...prev.scheduledStartTimes, emptyScheduledStartRow()],
    }));
  };

  const removeScheduledStartRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      scheduledStartTimes: prev.scheduledStartTimes.length > 1
        ? prev.scheduledStartTimes.filter((_, rowIndex) => rowIndex !== index)
        : [emptyScheduledStartRow()],
    }));
  };

  const selectedShiftIds = new Set(formData.scheduledStartTimes.map((row) => row.shiftId).filter(Boolean));

  if (loading) {
    return (
      <ProtectedRoute minRole={UserRole.ADMIN}>
        <div className="p-8">
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  const lineLabel = lineNumberLabel(formData.lineNumber);
  const previewLineName = formData.lineNumberNotApplicable
    ? cleanLineName(formData.name)
    : finalLineName(formData.name, formData.lineNumber);

  return (
    <ProtectedRoute minRole={UserRole.ADMIN}>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Production Lines</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage production lines within areas</p>
          </div>
          {canManageLines && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Line'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {showForm && canManageLines && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingLine ? 'Edit Production Line' : 'Create New Production Line'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Area *
                </label>
                <select
                  value={formData.areaId}
                  onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name} ({area.department?.facility?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Line Number {formData.lineNumberNotApplicable ? '' : '*'}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.lineNumberNotApplicable}
                      onChange={(e) => setFormData({
                        ...formData,
                        lineNumberNotApplicable: e.target.checked,
                        lineNumber: e.target.checked ? '' : formData.lineNumber,
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Not Applicable
                  </label>
                </div>
                <input
                  type="text"
                  value={formData.lineNumber}
                  onChange={(e) => setFormData({ ...formData, lineNumber: numericLineNumber(e.target.value) })}
                  required={!formData.lineNumberNotApplicable}
                  disabled={formData.lineNumberNotApplicable}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:disabled:bg-slate-800 dark:disabled:text-gray-500"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={formData.lineNumberNotApplicable ? 'No line number required' : 'e.g., 1'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Line Name *
                </label>
                {formData.lineNumberNotApplicable ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g., Kitchen"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_150px_minmax(260px,1fr)] sm:gap-0">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 rounded-t-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white sm:rounded-l-lg sm:rounded-r-none"
                      placeholder="e.g., Assembly"
                    />
                    <div className="flex min-h-[42px] items-center border-x border-b border-gray-300 bg-gray-50 px-4 text-sm font-semibold text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-200 sm:border-y sm:border-l-0">
                      {lineLabel}
                    </div>
                    <div className="flex min-h-[42px] items-center rounded-b-lg border border-t-0 border-gray-300 bg-gray-100 px-4 text-sm font-semibold text-gray-900 dark:border-slate-600 dark:bg-slate-900/70 dark:text-white sm:rounded-l-none sm:rounded-r-lg sm:border-l-0 sm:border-t">
                      {previewLineName || 'Final line name'}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Shift Scheduled Start Times
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Select a shift from the database, then set the scheduled start used by Production EOS.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addScheduledStartRow}
                    className="rounded-md border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 dark:border-primary-800 dark:bg-slate-800 dark:text-primary-300 dark:hover:bg-slate-700"
                  >
                    + Add another start time
                  </button>
                </div>

                {shifts.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    No shifts are available yet. Create shifts first, then assign scheduled start times here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.scheduledStartTimes.map((row, index) => (
                      <div key={`${index}-${row.shiftId || 'new'}`} className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_auto] md:items-end">
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Shift</span>
                          <select
                            value={row.shiftId}
                            onChange={(e) => updateScheduledStartRow(index, 'shiftId', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          >
                            <option value="">Select shift</option>
                            {orderedShifts
                              .filter((shift) => shift.id === row.shiftId || !selectedShiftIds.has(shift.id))
                              .map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                  {shift.name} ({shift.startTime} - {shift.endTime})
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">Scheduled start</span>
                          <DashTimeField
                            value={row.scheduledStartTime}
                            onChange={(value) => updateScheduledStartRow(index, 'scheduledStartTime', value)}
                            ariaLabel={`Scheduled start time for shift row ${index + 1}`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeScheduledStartRow(index)}
                          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:border-danger-800 dark:hover:bg-danger-950/40 dark:hover:text-danger-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingLine ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Line Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Line Name
                </th>
                {scheduledStartColumns.length ? (
                  scheduledStartColumns.map((shift) => (
                    <th key={shift.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span className="block text-gray-700 dark:text-gray-300">{shiftHeaderLabel(shift)}</span>
                      <span className="mt-1 block text-[10px] font-semibold normal-case tracking-normal text-gray-500 dark:text-gray-400">
                        {shift.name}
                      </span>
                    </th>
                  ))
                ) : (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Scheduled Start
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Department
                </th>
                {canManageLines && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No production lines found. Create your first line to get started.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const sortedSchedules = sortLineScheduledStartTimes(line.scheduledStartTimes || [], shiftsById);
                  return (
                    <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded">
                          {line.lineNumber?.trim() || 'None'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {line.name}
                        </div>
                      </td>
                      {scheduledStartColumns.length ? (
                        scheduledStartColumns.map((shift) => {
                          const schedule = sortedSchedules.find((row) => row.shiftId === shift.id);
                          return (
                            <td key={`${line.id}-${shift.id}`} className="px-6 py-4 whitespace-nowrap">
                              {schedule ? (
                                <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                                  <DashTimeDisplay value={schedule.scheduledStartTime} />
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-gray-400 dark:text-gray-500">None</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {line.scheduledStartTime ? (
                              <DashTimeDisplay value={line.scheduledStartTime} />
                            ) : (
                              <span className="font-medium text-gray-400 dark:text-gray-500">None</span>
                            )}
                          </div>
                        </td>
                      )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {line.area?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {line.area?.department?.facility?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {line.area?.department?.name || '-'}
                      </div>
                    </td>
                      {canManageLines && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(line)}
                            className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(line.id)}
                            className="text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-300"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
