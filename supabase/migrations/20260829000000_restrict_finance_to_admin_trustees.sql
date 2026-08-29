-- Restrict finance_income/finance_expenses/finance_budgets/finance_balance_sheet
-- to admin trustees only (ClickUp 86d3uy01x). Confirmed live before writing this:
-- finance_income/finance_expenses were already gated to role='trustee' (any
-- trustee, standard included) + entity membership; finance_budgets/
-- finance_balance_sheet had NO role check at all -- "authenticated full
-- access", true/true, open to any logged-in user including community role.
-- The real live project has 7 real trustees today, all trustee_role='admin',
-- zero standard -- this closes a latent gap, not an active one, for its real
-- current users.

drop policy "Trustees can manage finance_income within their entities" on finance_income;
create policy "Admin trustees can manage finance_income within their entities"
  on finance_income for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    and is_entity_member(finance_income.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    and is_entity_member(finance_income.entity_id)
  );

drop policy "Trustees can manage finance_expenses within their entities" on finance_expenses;
create policy "Admin trustees can manage finance_expenses within their entities"
  on finance_expenses for all
  to authenticated
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    and is_entity_member(finance_expenses.entity_id)
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin')
    and is_entity_member(finance_expenses.entity_id)
  );

drop policy "finance_budgets: authenticated full access" on finance_budgets;
create policy "Admin trustees can manage finance_budgets"
  on finance_budgets for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

drop policy "finance_balance_sheet: authenticated full access" on finance_balance_sheet;
create policy "Admin trustees can manage finance_balance_sheet"
  on finance_balance_sheet for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee' and profiles.trustee_role = 'admin'));

-- ── FINANCE HEALTH SCORE, ADMIN-INDEPENDENT ─────────────────────────────────
-- Board View's overall Health Score includes a Finance category for every
-- trustee today. Once the RLS above lands, a standard trustee's client can no
-- longer fetch finance_income/finance_expenses at all -- without this, their
-- overall Health Score would silently differ from what an admin sees on the
-- same day, not because finances genuinely differ, but because they can't
-- see them. This RPC is the first SECURITY DEFINER function in this project
-- meant to be called directly by an authenticated browser client (every
-- other one is locked to service_role, called only from Edge Functions) --
-- the internal role check below IS the auth boundary, not a supporting layer
-- in front of one. Returns only a 0/10/20 score and a coarse status enum --
-- deliberately never a real dollar figure, or this would just reopen the
-- same leak the RLS change above closes.

create or replace function get_finance_health_score()
returns table(has_enough_data boolean, score integer, status text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_fy_year   int;
  v_fy_from   date;
  v_fy_to     date;
  v_income    numeric;
  v_expenses  numeric;
  v_net       numeric;
  v_record_count int;
  v_score     int := 0;
  v_status    text := 'surplus';
begin
  if not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'trustee') then
    raise exception 'Trustee access required';
  end if;

  v_fy_year := case when extract(month from (now() at time zone 'Pacific/Auckland')) >= 4
                    then extract(year from (now() at time zone 'Pacific/Auckland'))::int
                    else extract(year from (now() at time zone 'Pacific/Auckland'))::int - 1
               end;
  v_fy_from := make_date(v_fy_year, 4, 1);
  v_fy_to   := make_date(v_fy_year + 1, 3, 31);

  select coalesce(sum(amount), 0) into v_income
    from finance_income where date >= v_fy_from and date <= v_fy_to;

  select coalesce(sum(amount), 0) into v_expenses
    from finance_expenses where date >= v_fy_from and date <= v_fy_to;

  select count(*) into v_record_count from (
    select amount from finance_income   where date >= v_fy_from and date <= v_fy_to and amount <> 0
    union all
    select amount from finance_expenses where date >= v_fy_from and date <= v_fy_to and amount <> 0
  ) t;

  v_net := v_income - v_expenses;

  if v_net >= 0 then
    v_score := 20; v_status := 'surplus';
  elsif v_income > 0 and abs(v_net) < v_income * 0.1 then
    v_score := 10; v_status := 'near_breakeven_deficit';
  else
    v_score := 0; v_status := 'deficit';
  end if;

  return query select (v_record_count >= 3), v_score, v_status;
end;
$$;

revoke execute on function get_finance_health_score() from public, anon;
grant  execute on function get_finance_health_score() to authenticated;
