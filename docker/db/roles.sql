-- Runs once when the local database volume is first initialised.
-- Gives the service roles the password from POSTGRES_PASSWORD so GoTrue,
-- PostgREST and the migration runner can connect over the compose network.
-- LOCAL DEVELOPMENT ONLY.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER postgres WITH PASSWORD :'pgpass';
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
