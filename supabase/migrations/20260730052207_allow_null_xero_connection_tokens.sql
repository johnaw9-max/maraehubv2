-- Allow access_token/refresh_token to be null so disconnect (xero-callback
-- Path C) can clear stored credentials instead of leaving stale, unused
-- tokens sitting in a disconnected row indefinitely. Path B's insert/update
-- always provides real, non-null tokens on connect, so this only permits
-- the disconnect path's deliberate null, it doesn't weaken anything there.

alter table xero_connections alter column access_token drop not null;
alter table xero_connections alter column refresh_token drop not null;
