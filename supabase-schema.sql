create table if not exists employees (
  id text primary key,
  name text not null,
  type text not null check (type in ('ration', 'shop', 'rubber')),
  created_at timestamptz not null default now()
);

create table if not exists attendance_records (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  work_month text not null,
  work_day integer not null check (work_day between 1 and 31),
  status text not null default 'present' check (status in ('present', 'absent', 'half', 'holiday')),
  created_at timestamptz not null default now(),
  unique (employee_id, work_month, work_day)
);

alter table attendance_records
add column if not exists status text not null default 'present'
check (status in ('present', 'absent', 'half', 'holiday'));

create table if not exists ration_weekly_payments (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  -- Format: week-YYYY-MM-DD, where the final date is the Monday week start.
  week_key text not null unique,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table employees enable row level security;
alter table attendance_records enable row level security;
alter table ration_weekly_payments enable row level security;

create policy "Allow public employee access"
on employees
for all
using (true)
with check (true);

create policy "Allow public attendance access"
on attendance_records
for all
using (true)
with check (true);

create policy "Allow public ration payment access"
on ration_weekly_payments
for all
using (true)
with check (true);
