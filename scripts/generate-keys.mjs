#!/usr/bin/env node
// Prints the anon and service_role API keys (HS256 JWTs) for a JWT secret, for
// the local docker compose stack or any self-hosted Supabase.
//   node scripts/generate-keys.mjs "<JWT_SECRET>"
// Hosted Supabase projects generate their own keys: use those instead.
import { createHmac } from 'node:crypto';

const secret = process.argv[2] ?? process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('Usage: node scripts/generate-keys.mjs <JWT_SECRET (32+ chars)>');
  process.exit(1);
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (payload) => {
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
};

// Same claims as the Supabase CLI's local keys; expires in 2032.
for (const role of ['anon', 'service_role']) {
  console.log(
    `${role === 'anon' ? 'ANON_KEY' : 'SERVICE_ROLE_KEY'}=${sign({ iss: 'supabase-demo', role, exp: 1983812996 })}`,
  );
}
