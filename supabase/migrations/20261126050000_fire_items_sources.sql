-- Three emergency items were marked "legal requirement if it applies" but pointed to no source.
-- Framework section 4.1 (Fire and evacuation) already names the sources; the register rows
-- below are already verified. No wording or class changes, only the source link, and only where
-- the item has none and every key exists. Safe to run more than once.
update public.compliance_items i
set source_keys = array['FENZ17','FENZR18','FENZES']
where i.name in (
        'Emergency exits — checked clear, signed and operational',
        'Evacuation routes — identified and communicated to committee',
        'Fire warden arrangements — trained and refreshed')
  and coalesce(cardinality(i.source_keys),0) = 0
  and (select count(*) from public.legal_sources where key in ('FENZ17','FENZR18','FENZES')) = 3;
