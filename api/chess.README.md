# ChatGenius Chess API

This serverless endpoint lives in the ChatGenius Vercel project (`/api/chess`). It does not call RealtyFlow. It reuses the existing `chatgenius.chess_games` and `chatgenius.chess_progress` tables in Supabase.

## Production configuration

Set `CHESS_SUPABASE_SERVICE_ROLE_KEY` as an encrypted **server-only** Vercel environment variable for the ChatGenius project. Retrieve it in Supabase's API Keys dashboard and paste it directly into Vercel, **never into GitHub, chat, client JavaScript, or logs**. Optional `CHESS_SUPABASE_URL` defaults to the existing project URL. A new deployment is needed after adding the variable.

The API uses the service-role key exclusively on the server. It validates each incoming user's Supabase bearer token using `/auth/v1/user`, then scopes all game/progress database queries to that verified user's ID. Do not expose this API key to the browser.

## Release gate

- [ ] Confirm Supabase Data API exposes `chatgenius` schema and service_role has required grants.
- [ ] Confirm unauthenticated `GET /api/chess` responds HTTP 401 with `Sign in required`.
- [ ] Confirm authenticated GET returns `{games:[],progress:null}` for a fresh user.
- [ ] Confirm saving a game twice does not create duplicates.
- [ ] Confirm user A cannot read or change user B's games or progress.
- [ ] Confirm progress version conflict returns HTTP 409.
- [ ] Confirm the two existing local games sync, then appear on another browser/device.
- [ ] Confirm other ChatGenius games and Family remain unaffected.

Do not merge or deploy until the credential and tests are ready. Keep localStorage data intact during rollout.
