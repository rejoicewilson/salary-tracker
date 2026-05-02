import React, { Component, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabase';
import './styles.css';

const STORAGE_KEY = 'salary-tracker-mobile-v2';

const EMPLOYEE_TYPES = {
  ration: {
    label: 'Ration',
    rateLabel: 'Rs 500 / day',
    detail: 'Sunday holiday',
    salaryLabel: 'Present days',
    rate: 500,
  },
  shop: {
    label: 'Shop',
    rateLabel: 'Rs 6500 / month',
    detail: 'Fixed salary',
    salaryLabel: 'Monthly salary',
    rate: 6500,
  },
  rubber: {
    label: 'Rubber tapping',
    rateLabel: 'Rs 750 / tapping',
    detail: 'Tap count',
    salaryLabel: 'Tappings',
    rate: 750,
  },
};

const EMPLOYEES = [
  { id: 'ration-employee', name: 'Ration Employee', type: 'ration' },
  { id: 'shop-employee', name: 'Shop Employee', type: 'shop' },
  { id: 'rubber-tapping-employee', name: 'Rubber Tapping Employee', type: 'rubber' },
];

const ATTENDANCE_STATUSES = {
  present: { label: 'Present', multiplier: 1 },
  absent: { label: 'Absent', multiplier: 0 },
  half: { label: 'Half day', multiplier: 0.5 },
  holiday: { label: 'Holiday', multiplier: 0 },
};

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(value) {
  return `Rs ${value.toLocaleString('en-IN')}`;
}

function getDaysInMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function getDayDate(monthValue, day) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isSunday(monthValue, day) {
  return getDayDate(monthValue, day).getDay() === 0;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getRationWeekStart(monthValue, day) {
  const date = getDayDate(monthValue, day);
  const dayOfWeek = date.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(date);
  start.setDate(date.getDate() - daysSinceMonday);
  return start;
}

function getWeekKey(monthValue, day) {
  return `week-${formatDateKey(getRationWeekStart(monthValue, day))}`;
}

function getWeekLabel(weekKey) {
  const startDateText = getWeekStartText(weekKey);
  const [year, month, day] = startDateText.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);

  return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
}

function getWeekStartText(weekKey) {
  if (weekKey.includes('-mon-')) {
    return weekKey.split('-mon-')[1];
  }
  return weekKey.replace('week-', '');
}

function readLocalData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { records: [], rationPayments: [] };

  try {
    const parsed = JSON.parse(saved);
    const records = Array.isArray(parsed.records) ? parsed.records.filter(
      (record) =>
        record?.id &&
        record?.employee_id &&
        record?.work_month &&
        Number.isInteger(record?.work_day),
    ) : [];
    const rationPayments = Array.isArray(parsed.rationPayments) ? parsed.rationPayments.filter(
      (payment) =>
        payment?.id &&
        payment?.employee_id === 'ration-employee' &&
        payment?.week_key &&
        Number.isFinite(Number(payment?.amount)),
    ) : [];

    return { records, rationPayments };
  } catch {
    return { records: [], rationPayments: [] };
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="phone-shell">
          <section className="panel error-panel">
            <h1>App error</h1>
            <p>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }}
            >
              Clear saved data
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [month, setMonth] = useState(getMonthValue());
  const [records, setRecords] = useState([]);
  const [rationPayments, setRationPayments] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(EMPLOYEES[0].id);
  const [attendancePicker, setAttendancePicker] = useState(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      if (!isSupabaseConfigured) {
        if (!alive) return;
        const local = readLocalData();
        setRecords(local.records);
        setRationPayments(local.rationPayments);
        return;
      }

      await supabase.from('employees').upsert(EMPLOYEES);
      const [{ data: recordRows, error: recordError }, { data: paymentRows, error: paymentError }] =
        await Promise.all([
          supabase.from('attendance_records').select('*'),
          supabase.from('ration_weekly_payments').select('*'),
        ]);
      if (!alive) return;

      if (recordError || paymentError) {
        const local = readLocalData();
        setRecords(local.records);
        setRationPayments(local.rationPayments);
        return;
      }

      setRecords(recordRows || []);
      setRationPayments(paymentRows || []);
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, rationPayments }));
    }
  }, [records, rationPayments]);

  const monthRecords = useMemo(
    () => records.filter((record) => record.work_month === month),
    [records, month],
  );

  const summaries = useMemo(() => {
    const byEmployee = new Map();

    EMPLOYEES.forEach((employee) => {
      const employeeRecords = monthRecords.filter((record) => record.employee_id === employee.id);
      const workCount = employeeRecords.reduce(
        (sum, record) => sum + (ATTENDANCE_STATUSES[record.status || 'present']?.multiplier || 0),
        0,
      );
      const salary = employee.type === 'shop'
        ? EMPLOYEE_TYPES.shop.rate
        : workCount * EMPLOYEE_TYPES[employee.type].rate;
      byEmployee.set(employee.id, { workCount, salary });
    });

    return {
      byEmployee,
      total: [...byEmployee.values()].reduce((sum, item) => sum + item.salary, 0),
      rationDays: byEmployee.get('ration-employee')?.workCount || 0,
      tappingCount: byEmployee.get('rubber-tapping-employee')?.workCount || 0,
    };
  }, [monthRecords]);

  const selectedEmployee =
    EMPLOYEES.find((employee) => employee.id === selectedEmployeeId) || EMPLOYEES[0];

  const rationWeeklySummary = useMemo(
    () => getRationWeeklySummary(month, records, rationPayments),
    [month, records, rationPayments],
  );

  const rationPending = rationWeeklySummary.reduce((sum, week) => sum + week.pending, 0);
  async function saveRationPayment(weekKey, amount) {
    const paymentAmount = Number(amount) || 0;
    const existing = rationPayments.find((payment) => payment.week_key === weekKey);

    if (existing) {
      const updated = { ...existing, amount: paymentAmount };
      setRationPayments((current) =>
        current.map((payment) => (payment.id === existing.id ? updated : payment)),
      );

      if (isSupabaseConfigured) {
        await supabase.from('ration_weekly_payments').update({ amount: paymentAmount }).eq('id', existing.id);
      }
      return;
    }

    const payment = {
      id: createId(),
      employee_id: 'ration-employee',
      week_key: weekKey,
      amount: paymentAmount,
    };
    setRationPayments((current) => [...current, payment]);

    if (isSupabaseConfigured) {
      await supabase.from('ration_weekly_payments').insert(payment);
    }
  }

  async function toggleRecord(employee, day) {
    if (employee.type === 'ration' && isSunday(month, day)) return;

    if (employee.type === 'rubber') {
      const existing = records.find(
        (record) =>
          record.employee_id === employee.id &&
          record.work_month === month &&
          record.work_day === day,
      );

      if (existing) {
        setRecords((current) => current.filter((record) => record.id !== existing.id));
        if (isSupabaseConfigured) {
          await supabase.from('attendance_records').delete().eq('id', existing.id);
        }
        return;
      }

      const record = {
        id: createId(),
        employee_id: employee.id,
        work_month: month,
        work_day: day,
        status: 'present',
      };

      setRecords((current) => [...current, record]);
      if (isSupabaseConfigured) {
        await supabase.from('attendance_records').insert(record);
      }
      return;
    }

    setAttendancePicker({ employee, day });
  }

  async function saveAttendanceStatus(statusValue) {
    if (!attendancePicker) return;

    const { employee, day } = attendancePicker;

    const existing = records.find(
      (record) =>
        record.employee_id === employee.id &&
        record.work_month === month &&
        record.work_day === day,
    );

    if (statusValue === 'clear') {
      if (existing) {
        setRecords((current) => current.filter((record) => record.id !== existing.id));
        if (isSupabaseConfigured) {
          await supabase.from('attendance_records').delete().eq('id', existing.id);
        }
      }
      setAttendancePicker(null);
      return;
    }

    if (existing) {
      const updated = { ...existing, status: statusValue };
      setRecords((current) =>
        current.map((record) => (record.id === existing.id ? updated : record)),
      );
      if (isSupabaseConfigured) {
        await supabase.from('attendance_records').update({ status: statusValue }).eq('id', existing.id);
      }
      setAttendancePicker(null);
      return;
    }

    const record = {
      id: createId(),
      employee_id: employee.id,
      work_month: month,
      work_day: day,
      status: statusValue,
    };

    setRecords((current) => [...current, record]);
    if (isSupabaseConfigured) {
      await supabase.from('attendance_records').insert(record);
    }
    setAttendancePicker(null);
  }

  return (
    <main className="phone-shell">
      <section className="app-header">
        <div className="header-top">
          <div className="header-copy">
            <p className="eyebrow">Salary tracker</p>
            <h1>Attendance & wages</h1>
          </div>
          <div className="sync-pill">{isSupabaseConfigured ? 'Sync' : 'Local'}</div>
        </div>
        <div className="header-controls">
          <div>
            <span>Month</span>
            <strong>{getDayDate(month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
          </div>
          <label className="month-icon-button" aria-label="Select month">
            <CalendarDays size={20} />
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel employee-selector" aria-label="Select employee">
        <div className="field">
          <label htmlFor="employeeSelect">Employee</label>
          <select
            id="employeeSelect"
            value={selectedEmployee.id}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
          >
            {EMPLOYEES.map((employee) => {
              const rule = EMPLOYEE_TYPES[employee.type];
              const summary = summaries.byEmployee.get(employee.id) || { workCount: 0, salary: 0 };

              return (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {rule.label}
                </option>
              );
            })}
          </select>
        </div>
      </section>

      {selectedEmployee && (
        <EmployeePanel
          employee={selectedEmployee}
          month={month}
          monthRecords={monthRecords}
          onToggle={toggleRecord}
          onSavePayment={saveRationPayment}
          rationWeeklySummary={rationWeeklySummary}
          summary={summaries.byEmployee.get(selectedEmployee.id) || { workCount: 0, salary: 0 }}
        />
      )}

      {attendancePicker && (
        <AttendancePicker
          day={attendancePicker.day}
          employee={attendancePicker.employee}
          month={month}
          onClose={() => setAttendancePicker(null)}
          onSelect={saveAttendanceStatus}
        />
      )}

    </main>
  );
}

function getWeekStartFromKey(weekKey) {
  const startDateText = getWeekStartText(weekKey);
  const [year, month, day] = startDateText.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function weekOverlapsMonth(weekKey, monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const weekStart = getWeekStartFromKey(weekKey);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);

  return weekStart <= monthEnd && weekEnd >= monthStart;
}

function getRationWeeklySummary(month, allRecords, rationPayments) {
  const weeks = new Map();

  allRecords
    .filter((record) => record.employee_id === 'ration-employee')
    .forEach((record) => {
      const weekKey = getWeekKey(record.work_month, record.work_day);
      const current = weeks.get(weekKey) || { weekKey, days: 0 };
      const multiplier = ATTENDANCE_STATUSES[record.status || 'present']?.multiplier || 0;
      weeks.set(weekKey, { ...current, days: current.days + multiplier });
    });

  rationPayments
    .filter((payment) => weekOverlapsMonth(payment.week_key, month))
    .forEach((payment) => {
      if (!weeks.has(payment.week_key)) {
        weeks.set(payment.week_key, { weekKey: payment.week_key, days: 0 });
      }
    });

  return [...weeks.values()]
    .filter((week) => weekOverlapsMonth(week.weekKey, month))
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .map((week) => {
      const earned = week.days * EMPLOYEE_TYPES.ration.rate;
      const paid = Number(
        rationPayments.find((payment) => payment.week_key === week.weekKey)?.amount || 0,
      );
      return {
        ...week,
        earned,
        paid,
        pending: Math.max(earned - paid, 0),
      };
    });
}

function EmployeePanel({
  employee,
  month,
  monthRecords,
  onSavePayment,
  onToggle,
  rationWeeklySummary,
  summary,
}) {
  const rule = EMPLOYEE_TYPES[employee.type];
  const days = Array.from({ length: getDaysInMonth(month) }, (_, index) => index + 1);
  const firstDayOffset = getDayDate(month, 1).getDay();

  return (
    <section className="panel employee-panel">
      <div className="selected-head">
        <div>
          <p className="eyebrow">{rule.label}</p>
          <h2>{employee.name}</h2>
          <span>{rule.rateLabel} - {rule.detail}</span>
        </div>
        <strong className="employee-salary">{formatMoney(summary.salary)}</strong>
      </div>

      <div className="salary-line">
        <span>{rule.salaryLabel}</span>
        <strong>
          {employee.type === 'shop'
            ? formatMoney(rule.rate)
            : `${summary.workCount} = ${formatMoney(summary.salary)}`}
        </strong>
      </div>

      <div className="calendar-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, index) => (
          <div className="weekday" key={`${dayName}-${index}`}>{dayName}</div>
        ))}
        {Array.from({ length: firstDayOffset }).map((_, index) => (
          <div className="empty-day" key={`empty-${index}`} />
        ))}
        {days.map((day) => {
          const active = monthRecords.some(
            (record) => record.employee_id === employee.id && record.work_day === day,
          );
          const dayRecord = monthRecords.find(
            (record) => record.employee_id === employee.id && record.work_day === day,
          );
          const sunday = employee.type === 'ration' && isSunday(month, day);
          const label = employee.type === 'rubber'
            ? 'Tap'
            : ATTENDANCE_STATUSES[dayRecord?.status]?.label;

          return (
            <button
              className={`day-button ${active ? `active ${dayRecord?.status || 'present'}` : ''} ${sunday ? 'holiday' : ''}`}
              disabled={sunday}
              key={day}
              type="button"
              onClick={() => onToggle(employee, day)}
            >
              <span>{day}</span>
              {active && <small>{label}</small>}
            </button>
          );
        })}
      </div>

      {employee.type === 'ration' && (
        <RationWeeklyPayments
          onSavePayment={onSavePayment}
          weeks={rationWeeklySummary}
        />
      )}
    </section>
  );
}

function AttendancePicker({ day, employee, month, onClose, onSelect }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="attendance-modal" role="dialog" aria-modal="true">
        <p className="eyebrow">{employee.name}</p>
        <h2>{getDayDate(month, day).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}</h2>
        <div className="attendance-actions">
          <button type="button" className="present" onClick={() => onSelect('present')}>
            Present
          </button>
          <button type="button" className="half" onClick={() => onSelect('half')}>
            Half day
          </button>
          <button type="button" className="absent" onClick={() => onSelect('absent')}>
            Absent
          </button>
          <button type="button" className="holiday" onClick={() => onSelect('holiday')}>
            Holiday
          </button>
          <button type="button" className="clear" onClick={() => onSelect('clear')}>
            Clear day
          </button>
        </div>
        <button className="cancel-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
  );
}

function RationWeeklyPayments({ onSavePayment, weeks }) {
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const orderedWeeks = [...weeks].reverse();
  const totalPages = Math.ceil(orderedWeeks.length / pageSize);
  const visibleWeeks = orderedWeeks.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [weeks.length]);

  if (weeks.length === 0) {
    return (
      <div className="weekly-payments">
        <h3>Weekly payment</h3>
        <p className="status">Mark attendance days to calculate weekly pending amount.</p>
      </div>
    );
  }

  return (
    <div className="weekly-payments">
      <div className="weekly-head">
        <h3>Weekly payment</h3>
        {totalPages > 1 && <span>Page {page + 1} / {totalPages}</span>}
      </div>
      {visibleWeeks.map((week) => (
        <div className={`week-row ${week.pending === 0 ? 'paid-week' : 'not-paid-week'}`} key={week.weekKey}>
          <div className="week-main">
            <div className="week-title">
              <strong>{getWeekLabel(week.weekKey)}</strong>
              <span className={`payment-seal ${week.pending === 0 ? 'paid' : 'not-paid'}`}>
                <span>{week.pending === 0 ? 'Paid' : 'Not paid'}</span>
              </span>
            </div>
            <div className="week-metrics">
              <span>{week.days} days</span>
              <span>Earned {formatMoney(week.earned)}</span>
              <span>Pending {formatMoney(week.pending)}</span>
            </div>
          </div>
          <label className="paid-input">
            <span>Paid</span>
            <input
              min="0"
              type="number"
              value={week.paid}
              onChange={(event) => onSavePayment(week.weekKey, event.target.value)}
            />
          </label>
          <div className="payment-actions">
            <button type="button" className="mark-paid" onClick={() => onSavePayment(week.weekKey, week.earned)}>
              Mark paid
            </button>
            <button type="button" className="clear-paid" onClick={() => onSavePayment(week.weekKey, 0)}>
              Clear
            </button>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div className="pager">
          <button
            disabled={page === 0}
            type="button"
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Newer
          </button>
          <button
            disabled={page >= totalPages - 1}
            type="button"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
