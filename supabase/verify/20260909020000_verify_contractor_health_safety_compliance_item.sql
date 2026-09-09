select 'contractor_hs_review_item_exists' as check_name,
  exists(
    select 1 from compliance_items
    where category = 'health_safety'
      and name = 'Contractor Health & Safety Management Review'
  ) as result

union all
select 'contractor_hs_review_item_not_duplicated',
  (select count(*) from compliance_items
     where category = 'health_safety'
       and name = 'Contractor Health & Safety Management Review') = 1;
