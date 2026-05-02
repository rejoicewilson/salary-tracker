import React, { Component, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
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

const SHOP_ADVANCE_REASONS = ['Current bill', 'Recharge', 'Other'];

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthParts(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return { year, month };
}

function createMonthValue(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatMonthTitle(monthValue) {
  return getDayDate(monthValue, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
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

function getDayFromDateText(dateText) {
  const parts = String(dateText || '').split('-').map(Number);
  return parts.length === 3 ? parts[2] : 0;
}

function getRecordDateKey(record) {
  return `${record.work_month}-${String(record.work_day).padStart(2, '0')}`;
}

function getMonthEndKey(monthValue) {
  return formatDateKey(getDayDate(monthValue, getDaysInMonth(monthValue)));
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
  if (!saved) {
    return {
      records: [],
      rationPayments: [],
      shopAdvances: [],
      shopSalaryPayments: [],
      rubberTaps: [],
      rubberAdvances: [],
      rubberPayments: [],
    };
  }

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
    const shopAdvances = Array.isArray(parsed.shopAdvances) ? parsed.shopAdvances.filter(
      (advance) =>
        advance?.id &&
        advance?.employee_id === 'shop-employee' &&
        advance?.work_month &&
        advance?.advance_date &&
        Number.isFinite(Number(advance?.amount)),
    ) : [];
    const shopSalaryPayments = Array.isArray(parsed.shopSalaryPayments) ? parsed.shopSalaryPayments.filter(
      (payment) =>
        payment?.id &&
        payment?.employee_id === 'shop-employee' &&
        payment?.work_month &&
        Number.isFinite(Number(payment?.amount)),
    ) : [];
    const rubberTaps = Array.isArray(parsed.rubberTaps) ? parsed.rubberTaps.filter(
      (tap) =>
        tap?.id &&
        tap?.employee_id === 'rubber-tapping-employee' &&
        tap?.tap_date &&
        Number.isFinite(Number(tap?.count)),
    ) : [];
    const rubberAdvances = Array.isArray(parsed.rubberAdvances) ? parsed.rubberAdvances.filter(
      (advance) =>
        advance?.id &&
        advance?.employee_id === 'rubber-tapping-employee' &&
        advance?.work_month &&
        advance?.advance_date &&
        Number.isFinite(Number(advance?.amount)),
    ) : [];
    const rubberPayments = Array.isArray(parsed.rubberPayments) ? parsed.rubberPayments.filter(
      (payment) =>
        payment?.id &&
        payment?.employee_id === 'rubber-tapping-employee' &&
        payment?.work_month &&
        payment?.paid_date &&
        Number.isFinite(Number(payment?.amount)),
    ) : [];

    return { records, rationPayments, shopAdvances, shopSalaryPayments, rubberTaps, rubberAdvances, rubberPayments };
  } catch {
    return {
      records: [],
      rationPayments: [],
      shopAdvances: [],
      shopSalaryPayments: [],
      rubberTaps: [],
      rubberAdvances: [],
      rubberPayments: [],
    };
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
  const [shopAdvances, setShopAdvances] = useState([]);
  const [shopSalaryPayments, setShopSalaryPayments] = useState([]);
  const [rubberTaps, setRubberTaps] = useState([]);
  const [rubberAdvances, setRubberAdvances] = useState([]);
  const [rubberPayments, setRubberPayments] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(EMPLOYEES[0].id);
  const [attendancePicker, setAttendancePicker] = useState(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      if (!isSupabaseConfigured) {
        if (!alive) return;
        const local = readLocalData();
        setRecords(local.records);
        setRationPayments(local.rationPayments);
        setShopAdvances(local.shopAdvances);
        setShopSalaryPayments(local.shopSalaryPayments);
        setRubberTaps(local.rubberTaps);
        setRubberAdvances(local.rubberAdvances);
        setRubberPayments(local.rubberPayments);
        return;
      }

      await supabase.from('employees').upsert(EMPLOYEES);
      const [
        { data: recordRows, error: recordError },
        { data: paymentRows, error: paymentError },
        { data: advanceRows, error: advanceError },
        { data: shopPaymentRows, error: shopPaymentError },
        { data: rubberTapRows, error: rubberTapError },
        { data: rubberAdvanceRows, error: rubberAdvanceError },
        { data: rubberPaymentRows, error: rubberPaymentError },
      ] =
        await Promise.all([
          supabase.from('attendance_records').select('*'),
          supabase.from('ration_weekly_payments').select('*'),
          supabase.from('shop_advances').select('*'),
          supabase.from('shop_salary_payments').select('*'),
          supabase.from('rubber_taps').select('*'),
          supabase.from('rubber_advances').select('*'),
          supabase.from('rubber_payments').select('*'),
        ]);
      if (!alive) return;

      if (recordError || paymentError) {
        const local = readLocalData();
        setRecords(local.records);
        setRationPayments(local.rationPayments);
        setShopAdvances(local.shopAdvances);
        setShopSalaryPayments(local.shopSalaryPayments);
        setRubberTaps(local.rubberTaps);
        setRubberAdvances(local.rubberAdvances);
        setRubberPayments(local.rubberPayments);
        return;
      }

      setRecords(recordRows || []);
      setRationPayments(paymentRows || []);
      setShopAdvances(advanceError ? [] : advanceRows || []);
      setShopSalaryPayments(shopPaymentError ? [] : shopPaymentRows || []);
      setRubberTaps(rubberTapError ? [] : rubberTapRows || []);
      setRubberAdvances(rubberAdvanceError ? [] : rubberAdvanceRows || []);
      setRubberPayments(rubberPaymentError ? [] : rubberPaymentRows || []);
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          records,
          rationPayments,
          shopAdvances,
          shopSalaryPayments,
          rubberTaps,
          rubberAdvances,
          rubberPayments,
        }),
      );
    }
  }, [records, rationPayments, shopAdvances, shopSalaryPayments, rubberTaps, rubberAdvances, rubberPayments]);

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

  const monthShopAdvances = useMemo(
    () => shopAdvances
      .filter((advance) => advance.employee_id === 'shop-employee' && advance.work_month === month)
      .sort((a, b) => b.advance_date.localeCompare(a.advance_date)),
    [month, shopAdvances],
  );

  const monthShopSalaryPayment = useMemo(
    () => shopSalaryPayments.find(
      (payment) => payment.employee_id === 'shop-employee' && payment.work_month === month,
    ),
    [month, shopSalaryPayments],
  );

  const monthRubberPayments = useMemo(
    () => rubberPayments
      .filter((payment) => payment.employee_id === 'rubber-tapping-employee')
      .sort((a, b) => b.paid_date.localeCompare(a.paid_date)),
    [rubberPayments],
  );

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

  async function addShopAdvance({ amount, reason, note }) {
    const advanceAmount = Number(amount) || 0;
    if (advanceAmount <= 0) return;

    const advance = {
      id: createId(),
      employee_id: 'shop-employee',
      work_month: month,
      advance_date: formatDateKey(new Date()),
      reason,
      note: note.trim(),
      amount: advanceAmount,
    };

    setShopAdvances((current) => [...current, advance]);

    if (isSupabaseConfigured) {
      await supabase.from('shop_advances').insert(advance);
    }
  }

  async function deleteShopAdvance(id) {
    setShopAdvances((current) => current.filter((advance) => advance.id !== id));

    if (isSupabaseConfigured) {
      await supabase.from('shop_advances').delete().eq('id', id);
    }
  }

  async function saveShopSalaryPayment(amount) {
    const paymentAmount = Number(amount) || 0;
    const existing = shopSalaryPayments.find(
      (payment) => payment.employee_id === 'shop-employee' && payment.work_month === month,
    );

    if (existing) {
      const updated = { ...existing, amount: paymentAmount, paid_date: formatDateKey(new Date()) };
      setShopSalaryPayments((current) =>
        current.map((payment) => (payment.id === existing.id ? updated : payment)),
      );

      if (isSupabaseConfigured) {
        await supabase
          .from('shop_salary_payments')
          .update({ amount: paymentAmount, paid_date: updated.paid_date })
          .eq('id', existing.id);
      }
      return;
    }

    const payment = {
      id: createId(),
      employee_id: 'shop-employee',
      work_month: month,
      paid_date: formatDateKey(new Date()),
      amount: paymentAmount,
    };
    setShopSalaryPayments((current) => [...current, payment]);

    if (isSupabaseConfigured) {
      await supabase.from('shop_salary_payments').insert(payment);
    }
  }

  async function addRubberAdvance({ amount, note }) {
    const advanceAmount = Number(amount) || 0;
    if (advanceAmount <= 0) return;

    const advance = {
      id: createId(),
      employee_id: 'rubber-tapping-employee',
      work_month: getMonthValue(new Date()),
      advance_date: formatDateKey(new Date()),
      note: note.trim(),
      amount: advanceAmount,
    };

    setRubberAdvances((current) => [...current, advance]);

    if (isSupabaseConfigured) {
      await supabase.from('rubber_advances').insert(advance);
    }
  }

  async function addRubberTap({ count, note }) {
    const tapCount = Number(count) || 0;
    if (tapCount <= 0) return;

    const tap = {
      id: createId(),
      employee_id: 'rubber-tapping-employee',
      tap_date: formatDateKey(new Date()),
      count: tapCount,
      note: note.trim(),
    };

    setRubberTaps((current) => [...current, tap]);

    if (isSupabaseConfigured) {
      await supabase.from('rubber_taps').insert(tap);
    }
  }

  async function deleteRubberTap(id) {
    setRubberTaps((current) => current.filter((tap) => tap.id !== id));

    if (isSupabaseConfigured) {
      await supabase.from('rubber_taps').delete().eq('id', id);
    }
  }

  async function deleteRubberAdvance(id) {
    setRubberAdvances((current) => current.filter((advance) => advance.id !== id));

    if (isSupabaseConfigured) {
      await supabase.from('rubber_advances').delete().eq('id', id);
    }
  }

  async function addRubberPayment(amount, carryForwardAmount = 0) {
    const paymentAmount = Number(amount) || 0;
    const nextCarry = Number(carryForwardAmount) || 0;
    if (paymentAmount <= 0 && nextCarry <= 0) return;

    const payment = {
      id: createId(),
      employee_id: 'rubber-tapping-employee',
      work_month: getMonthValue(new Date()),
      paid_date: formatDateKey(new Date()),
      amount: paymentAmount,
      carry_forward_amount: nextCarry,
    };

    setRubberPayments((current) => [...current, payment]);

    if (isSupabaseConfigured) {
      await supabase.from('rubber_payments').insert(payment);
    }
  }

  async function deleteRubberPayment(id) {
    setRubberPayments((current) => current.filter((payment) => payment.id !== id));

    if (isSupabaseConfigured) {
      await supabase.from('rubber_payments').delete().eq('id', id);
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
            <strong>{formatMonthTitle(month)}</strong>
          </div>
          <button
            className="month-icon-button"
            type="button"
            aria-label="Select month"
            onClick={() => setMonthPickerOpen(true)}
          >
            <CalendarDays size={20} />
          </button>
        </div>
      </section>

      <section className="panel employee-selector" aria-label="Select employee">
        <p className="eyebrow">Employee</p>
        <div className="employee-tabs">
          {EMPLOYEES.map((employee) => {
            const rule = EMPLOYEE_TYPES[employee.type];
            const active = employee.id === selectedEmployee.id;

            return (
              <button
                className={`employee-tab ${active ? 'active' : ''}`}
                key={employee.id}
                type="button"
                onClick={() => setSelectedEmployeeId(employee.id)}
              >
                <span>
                  <strong>{rule.label}</strong>
                </span>
                {active && <Check size={18} />}
              </button>
            );
          })}
        </div>
      </section>

      {selectedEmployee && (
        <EmployeePanel
          employee={selectedEmployee}
          allRecords={records}
          month={month}
          monthRecords={monthRecords}
          onToggle={toggleRecord}
          onSavePayment={saveRationPayment}
          onAddShopAdvance={addShopAdvance}
          onDeleteShopAdvance={deleteShopAdvance}
          onSaveShopSalaryPayment={saveShopSalaryPayment}
          onAddRubberAdvance={addRubberAdvance}
          onAddRubberTap={addRubberTap}
          onDeleteRubberAdvance={deleteRubberAdvance}
          onDeleteRubberTap={deleteRubberTap}
          onAddRubberPayment={addRubberPayment}
          onDeleteRubberPayment={deleteRubberPayment}
          rationWeeklySummary={rationWeeklySummary}
          rubberAdvances={rubberAdvances}
          rubberPayments={rubberPayments}
          rubberTaps={rubberTaps}
          visibleRubberPayments={monthRubberPayments}
          shopAdvances={monthShopAdvances}
          shopSalaryPayment={monthShopSalaryPayment}
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

      {monthPickerOpen && (
        <MonthPicker
          month={month}
          onClose={() => setMonthPickerOpen(false)}
          onSelect={(nextMonth) => {
            setMonth(nextMonth);
            setMonthPickerOpen(false);
          }}
        />
      )}

    </main>
  );
}

function MonthPicker({ month, onClose, onSelect }) {
  const { year, month: selectedMonth } = getMonthParts(month);
  const [visibleYear, setVisibleYear] = useState(year);
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Date(visibleYear, index, 1).toLocaleDateString('en-IN', { month: 'short' }),
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="sheet-modal month-sheet" role="dialog" aria-modal="true">
        <div className="sheet-header">
          <div>
            <p className="eyebrow">Select month</p>
            <h2>{visibleYear}</h2>
          </div>
          <div className="year-actions">
            <button type="button" aria-label="Previous year" onClick={() => setVisibleYear((current) => current - 1)}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Next year" onClick={() => setVisibleYear((current) => current + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="month-grid">
          {monthNames.map((monthName, index) => {
            const monthNumber = index + 1;
            const value = createMonthValue(visibleYear, monthNumber);
            const active = visibleYear === year && monthNumber === selectedMonth;

            return (
              <button
                className={active ? 'active' : ''}
                key={monthName}
                type="button"
                onClick={() => onSelect(value)}
              >
                {monthName}
              </button>
            );
          })}
        </div>
        <button className="cancel-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </section>
    </div>
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
  allRecords,
  month,
  monthRecords,
  onSavePayment,
  onAddShopAdvance,
  onDeleteShopAdvance,
  onSaveShopSalaryPayment,
  onAddRubberAdvance,
  onAddRubberTap,
  onDeleteRubberAdvance,
  onDeleteRubberTap,
  onAddRubberPayment,
  onDeleteRubberPayment,
  onToggle,
  rationWeeklySummary,
  rubberAdvances,
  rubberPayments,
  rubberTaps,
  visibleRubberPayments,
  shopAdvances,
  shopSalaryPayment,
  summary,
}) {
  const rule = EMPLOYEE_TYPES[employee.type];
  const days = Array.from({ length: getDaysInMonth(month) }, (_, index) => index + 1);
  const firstDayOffset = getDayDate(month, 1).getDay();
  const shopAdvanceTotal = shopAdvances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
  const shopPaid = Number(shopSalaryPayment?.amount || 0);
  const shopNetSalary = Math.max(rule.rate - shopAdvanceTotal, 0);
  const shopBalance = Math.max(shopNetSalary - shopPaid, 0);
  const todayKey = formatDateKey(new Date());
  const latestAnyRubberPayment = rubberPayments
    .filter((payment) => payment.employee_id === 'rubber-tapping-employee')
    .sort((a, b) => b.paid_date.localeCompare(a.paid_date))[0];
  const rubberSettledThroughDate = latestAnyRubberPayment?.paid_date || '';
  const latestRubberPayment = latestAnyRubberPayment;
  const rubberClosedThroughDate = latestRubberPayment?.paid_date || '';
  const openRubberTaps = employee.type === 'rubber'
    ? rubberTaps
      .filter(
        (tap) =>
          tap.employee_id === 'rubber-tapping-employee' &&
          tap.tap_date > rubberClosedThroughDate &&
          tap.tap_date <= todayKey,
      )
      .sort((a, b) => b.tap_date.localeCompare(a.tap_date))
    : [];
  const openRubberCount = openRubberTaps.reduce((sum, tap) => sum + Number(tap.count || 0), 0);
  const openRubberEarned = openRubberCount * EMPLOYEE_TYPES.rubber.rate;
  const openRubberAdvances = rubberAdvances
    .filter(
      (advance) =>
        advance.employee_id === 'rubber-tapping-employee' &&
        advance.advance_date > rubberClosedThroughDate &&
        advance.advance_date <= todayKey,
    )
    .sort((a, b) => b.advance_date.localeCompare(a.advance_date));
  const rubberManualAdvanceTotal = openRubberAdvances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
  const rubberOpeningAdvanceTotal = Number(latestRubberPayment?.carry_forward_amount || 0);
  const rubberAdvanceTotal = rubberManualAdvanceTotal + rubberOpeningAdvanceTotal;
  const rubberPaid = rubberPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const rubberBalance = Math.max(openRubberEarned - rubberAdvanceTotal, 0);
  const rubberExtraAdvance = Math.max(rubberAdvanceTotal - openRubberEarned, 0);
  const rubberClosedThroughDay = rubberClosedThroughDate.startsWith(month) ? getDayFromDateText(rubberClosedThroughDate) : 0;
  const displaySalary = employee.type === 'rubber' ? openRubberEarned : summary.salary;

  return (
    <section className="panel employee-panel">
      <div className="selected-head">
        <div>
          <p className="eyebrow">{rule.label}</p>
          <h2>{employee.name}</h2>
          <span>{rule.rateLabel} - {rule.detail}</span>
        </div>
        <strong className="employee-salary">{formatMoney(displaySalary)}</strong>
      </div>

      <div className="salary-line">
        <span>{employee.type === 'shop' ? 'Balance salary' : rule.salaryLabel}</span>
        <strong>
          {employee.type === 'shop'
            ? formatMoney(shopBalance)
            : employee.type === 'rubber'
              ? `${openRubberCount} = ${formatMoney(openRubberEarned)}`
              : `${summary.workCount} = ${formatMoney(summary.salary)}`}
        </strong>
      </div>

      {employee.type !== 'rubber' && (
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
          const recordDateKey = dayRecord ? getRecordDateKey(dayRecord) : '';
          const settledRubberDay =
            employee.type === 'rubber' &&
            active &&
            recordDateKey <= rubberSettledThroughDate;
          const label = employee.type === 'rubber'
            ? settledRubberDay ? 'Closed' : 'Tap'
            : ATTENDANCE_STATUSES[dayRecord?.status]?.label;

          return (
            <button
              className={`day-button ${active ? `active ${dayRecord?.status || 'present'}` : ''} ${settledRubberDay ? 'settled' : ''} ${sunday ? 'holiday' : ''}`}
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
      )}

      {employee.type === 'ration' && (
        <RationWeeklyPayments
          onSavePayment={onSavePayment}
          weeks={rationWeeklySummary}
        />
      )}

      {employee.type === 'shop' && (
        <ShopAdvances
          advances={shopAdvances}
          balance={shopBalance}
          netSalary={shopNetSalary}
          onAddAdvance={onAddShopAdvance}
          onDeleteAdvance={onDeleteShopAdvance}
          onSavePayment={onSaveShopSalaryPayment}
          paid={shopPaid}
          total={shopAdvanceTotal}
        />
      )}

      {employee.type === 'rubber' && (
        <RubberAccount
          advances={rubberAdvances}
          taps={openRubberTaps}
          openAdvances={openRubberAdvances}
          advanceTotal={rubberAdvanceTotal}
          balance={rubberBalance}
          closedThroughDate={rubberClosedThroughDate}
          closedThroughDay={rubberClosedThroughDay}
          earned={openRubberEarned}
          extraAdvance={rubberExtraAdvance}
          openingAdvanceTotal={rubberOpeningAdvanceTotal}
          onAddAdvance={onAddRubberAdvance}
          onAddTap={onAddRubberTap}
          onAddPayment={onAddRubberPayment}
          onDeleteAdvance={onDeleteRubberAdvance}
          onDeleteTap={onDeleteRubberTap}
          onDeletePayment={onDeleteRubberPayment}
          paid={rubberPaid}
          payments={visibleRubberPayments}
        />
      )}
    </section>
  );
}

function ShopAdvances({
  advances,
  balance,
  netSalary,
  onAddAdvance,
  onDeleteAdvance,
  onSavePayment,
  paid,
  total,
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(SHOP_ADVANCE_REASONS[0]);
  const [note, setNote] = useState('');

  function submitAdvance(event) {
    event.preventDefault();
    onAddAdvance({ amount, reason, note });
    setAmount('');
    setNote('');
  }

  return (
    <div className="shop-advances">
      <div className="advance-summary">
        <div>
          <span>Taken this month</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div>
          <span>Pending salary</span>
          <strong>{formatMoney(balance)}</strong>
        </div>
      </div>

      <div className={`shop-payment-card ${balance === 0 ? 'paid' : 'pending'}`}>
        <div className="shop-payment-top">
          <div>
            <span>Monthly payment</span>
            <strong>{formatMoney(balance)} pending</strong>
            <small>{formatMoney(paid)} paid from {formatMoney(netSalary)}</small>
          </div>
          <span className={`payment-seal ${balance === 0 ? 'paid' : 'not-paid'}`}>
            <span>{balance === 0 ? 'Paid' : 'Not paid'}</span>
          </span>
        </div>
        <div className="payment-actions shop-payment-actions">
          <button type="button" className="mark-paid" onClick={() => onSavePayment(netSalary)}>
            Mark paid
          </button>
          <button type="button" className="clear-paid" onClick={() => onSavePayment(0)}>
            Clear
          </button>
        </div>
      </div>

      <form className="advance-form" onSubmit={submitAdvance}>
        <div className="reason-tabs" role="group" aria-label="Advance reason">
          {SHOP_ADVANCE_REASONS.map((item) => (
            <button
              className={reason === item ? 'active' : ''}
              key={item}
              type="button"
              onClick={() => setReason(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="advance-entry">
          <input
            min="1"
            type="number"
            inputMode="numeric"
            placeholder="Amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button type="submit">Add</button>
        </div>
        <input
          type="text"
          placeholder="Note optional"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>

      <div className="advance-list">
        {advances.length === 0 ? (
          <p className="status">No bill or recharge money added for this month.</p>
        ) : (
          advances.map((advance) => (
            <div className="advance-row" key={advance.id}>
              <div>
                <strong>{advance.reason}</strong>
                <span>
                  {new Date(`${advance.advance_date}T00:00:00`).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                  {advance.note ? ` - ${advance.note}` : ''}
                </span>
              </div>
              <div>
                <strong>{formatMoney(Number(advance.amount || 0))}</strong>
                <button type="button" onClick={() => onDeleteAdvance(advance.id)}>
                  Clear
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RubberAccount({
  advances,
  taps,
  openAdvances,
  advanceTotal,
  balance,
  closedThroughDay,
  earned,
  extraAdvance,
  openingAdvanceTotal,
  onAddAdvance,
  onAddTap,
  onAddPayment,
  onDeleteAdvance,
  onDeleteTap,
  onDeletePayment,
  paid,
  payments,
}) {
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [tapCount, setTapCount] = useState('1');
  const [tapNote, setTapNote] = useState('');

  function submitAdvance(event) {
    event.preventDefault();
    onAddAdvance({ amount: advanceAmount, note: advanceNote });
    setAdvanceAmount('');
    setAdvanceNote('');
  }

  function submitTap(event) {
    event.preventDefault();
    onAddTap({ count: tapCount, note: tapNote });
    setTapCount('1');
    setTapNote('');
  }

  return (
    <div className="rubber-account">
      <div className="advance-summary rubber-summary">
        <div>
          <span>Earned</span>
          <strong>{formatMoney(earned)}</strong>
        </div>
        <div>
          <span>{extraAdvance > 0 ? 'Extra advance' : 'Pending'}</span>
          <strong>{formatMoney(extraAdvance > 0 ? extraAdvance : balance)}</strong>
        </div>
      </div>

      <div className={`shop-payment-card ${balance === 0 ? 'paid' : 'pending'}`}>
        <div className="shop-payment-top">
          <div>
            <span>Rubber payment</span>
            <strong>{formatMoney(balance)} pending</strong>
            <small>
              {formatMoney(paid)} paid, {formatMoney(advanceTotal)} advance
              {extraAdvance > 0 ? `, ${formatMoney(extraAdvance)} extra` : ''}
              {openingAdvanceTotal > 0 ? `, ${formatMoney(openingAdvanceTotal)} opening balance` : ''}
              {closedThroughDay > 0 ? `, counting after day ${closedThroughDay}` : ''}
            </small>
          </div>
          <span className={`payment-seal ${balance === 0 ? 'paid' : 'not-paid'}`}>
            <span>{balance === 0 ? 'Paid' : 'Not paid'}</span>
          </span>
        </div>
        <div className="payment-actions shop-payment-actions">
          <button
            type="button"
            className="mark-paid"
            disabled={balance === 0 && extraAdvance === 0}
            onClick={() => onAddPayment(balance, extraAdvance)}
          >
            Close payment
          </button>
          <button
            type="button"
            className="clear-paid"
            disabled={payments.length === 0}
            onClick={() => payments[0] && onDeletePayment(payments[0].id)}
          >
            Clear
          </button>
        </div>
      </div>

      <form className="advance-form" onSubmit={submitTap}>
        <div className="advance-entry">
          <input
            min="1"
            type="number"
            inputMode="numeric"
            placeholder="Tap count"
            value={tapCount}
            onChange={(event) => setTapCount(event.target.value)}
          />
          <button type="submit">Add tap</button>
        </div>
        <input
          type="text"
          placeholder="Tap note optional"
          value={tapNote}
          onChange={(event) => setTapNote(event.target.value)}
        />
      </form>

      <form className="advance-form" onSubmit={submitAdvance}>
        <div className="advance-entry">
          <input
            min="1"
            type="number"
            inputMode="numeric"
            placeholder="Advance amount"
            value={advanceAmount}
            onChange={(event) => setAdvanceAmount(event.target.value)}
          />
          <button type="submit">Add</button>
        </div>
        <input
          type="text"
          placeholder="Note optional"
          value={advanceNote}
          onChange={(event) => setAdvanceNote(event.target.value)}
        />
      </form>

      <div className="account-history">
        <h3>Open taps</h3>
        <div className="advance-list">
          {taps.length === 0 ? (
            <p className="status">No taps added for this open payment.</p>
          ) : (
            taps.map((tap) => (
              <div className="advance-row" key={tap.id}>
                <div>
                  <strong>{tap.count} taps</strong>
                  <span>
                    {new Date(`${tap.tap_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {tap.note ? ` - ${tap.note}` : ''}
                  </span>
                </div>
                <div>
                  <strong>{formatMoney(Number(tap.count || 0) * EMPLOYEE_TYPES.rubber.rate)}</strong>
                  <button type="button" onClick={() => onDeleteTap(tap.id)}>
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="account-history">
        <h3>Advance amounts</h3>
        <div className="advance-list">
          {openAdvances.length === 0 ? (
            <p className="status">No advance amount added for this open payment.</p>
          ) : (
            openAdvances.map((advance) => (
              <div className="advance-row" key={advance.id}>
                <div>
                  <strong>Advance</strong>
                  <span>
                    {new Date(`${advance.advance_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {advance.note ? ` - ${advance.note}` : ''}
                  </span>
                </div>
                <div>
                  <strong>{formatMoney(Number(advance.amount || 0))}</strong>
                  <button type="button" onClick={() => onDeleteAdvance(advance.id)}>
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="account-history">
        <h3>Closed payments</h3>
        <div className="advance-list">
          {payments.length === 0 ? (
            <p className="status">No rubber payment closed for this month.</p>
          ) : (
            payments.map((payment) => (
              <div className="advance-row" key={payment.id}>
                <div>
                  <strong>Payment closed</strong>
                  <span>
                    {new Date(`${payment.paid_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {Number(payment.carry_forward_amount || 0) > 0
                      ? ` - ${formatMoney(Number(payment.carry_forward_amount || 0))} opening next payment`
                      : ''}
                  </span>
                </div>
                <div>
                  <strong>{formatMoney(Number(payment.amount || 0))}</strong>
                  <button type="button" onClick={() => onDeletePayment(payment.id)}>
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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
