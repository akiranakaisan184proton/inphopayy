// Repository abstraction: SQLite for local dev, Supabase for production (Netlify).
// Selected automatically based on env var SUPABASE_URL.

const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

let impl;
if (useSupabase) {
  impl = require("./repo.supabase");
} else {
  // Dynamic path so bundlers don't try to package better-sqlite3 on Netlify.
  const sqlitePath = "./repo.sqlite";
  impl = require(sqlitePath);
}

module.exports = impl;
