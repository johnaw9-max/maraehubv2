select 'founder_capacity_check_state_seeded' as check_name,
  exists(
    select 1 from check_alert_state
    where check_name = 'founder_capacity_check'
      and last_alerted_at = '2026-08-17T00:00:00Z'::timestamptz
  ) as result;
