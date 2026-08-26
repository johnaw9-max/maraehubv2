-- Stage 6 of the Getting Started checklist (ClickUp 86d43ycf9 / 86d453dm7).
-- Lets the Charter generator save the structured field values it already
-- collects (marae name, hapu, iwi, trustee count, quorum %, etc.) so a
-- saved Charter can be reopened pre-filled and edited, instead of only
-- ever generating blank. Nullable, additive -- only the single "Marae
-- Charter" tracking row (added by Stage 5) will ever populate this;
-- every other document row stays null, same as file_name/file_size/
-- file_type already do for that row today.

alter table public.documents add column charter_fields jsonb;
