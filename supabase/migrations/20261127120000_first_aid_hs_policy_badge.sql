-- The badge beside an item is read from the start of legal_basis. First aid kit and the health and safety policy are
-- good practice for every marae (Framework Draft v0.4, Area 2.1), so the badge must say Good practice, not
-- "Legal duty if it applies". Follows 20261127110000.
update public.compliance_items
set legal_basis = 'Good practice for every marae; a legal duty under the Health and Safety at Work Act 2015 if the marae has employees'
where name in ('First aid kit — stocked and in date', 'Health & Safety Policy Review');
