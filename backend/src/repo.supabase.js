const { createClient } = require("@supabase/supabase-js");

/** Evita URL colada do painel com /rest/v1/ no final, que quebra o cliente. */
function normalizeSupabaseUrl(raw) {
  if (raw == null || typeof raw !== "string") return raw;
  let u = raw.trim().replace(/\/+$/, "");
  if (u.endsWith("/rest/v1")) u = u.slice(0, -"/rest/v1".length);
  return u.replace(/\/+$/, "");
}

const supabase = createClient(
  normalizeSupabaseUrl(process.env.SUPABASE_URL),
  String(process.env.SUPABASE_SERVICE_KEY || "").trim(),
  {
    auth: { persistSession: false },
  },
);

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function findUserByUsername(username) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findUserById(id) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createUser({
  username,
  name,
  email,
  password_hash,
  role = "client",
  approval_status = "pending",
}) {
  const { data, error } = await supabase
    .from("users")
    .insert({ username, name, email, password_hash, role, approval_status, rejection_reason: null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createWallet(userId) {
  unwrap(
    await supabase.from("wallets").insert({ user_id: userId, balance_cents: 0 }),
  );
}

async function getWalletWithUser(userId) {
  const { data, error } = await supabase
    .from("wallets")
    .select("id, user_id, balance_cents, updated_at, users:user_id (name, username)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    balance_cents: data.balance_cents,
    updated_at: data.updated_at,
    name: data.users?.name,
    username: data.users?.username,
  };
}

async function addToWallet(userId, amountCents) {
  const { data: current } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", userId)
    .maybeSingle();
  const newBalance = (current?.balance_cents || 0) + amountCents;
  const { data, error } = await supabase
    .from("wallets")
    .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function listTransactions(userId) {
  const { data, error } = await supabase
    .from("pix_transactions")
    .select("id, amount_cents, status, customer_email, created_at, tribopay_transaction_id")
    .eq("user_id", userId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createPixTransactionRecord(payload) {
  const { data, error } = await supabase
    .from("pix_transactions")
    .insert({
      user_id: payload.user_id,
      amount_cents: payload.amount_cents,
      status: payload.status || "pending",
      tribopay_transaction_id: payload.tribopay_transaction_id,
      tribopay_offer_hash: payload.tribopay_offer_hash,
      tribopay_product_hash: payload.tribopay_product_hash,
      pix_qr_code: payload.pix_qr_code,
      customer_email: payload.customer_email,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

async function listCheckoutLinks(userId) {
  const { data, error } = await supabase
    .from("checkout_links")
    .select("id, token, title, amount_cents, status, created_at")
    .eq("user_id", userId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createCheckoutLink({ user_id, token, title, amount_cents }) {
  const { data, error } = await supabase
    .from("checkout_links")
    .insert({ user_id, token, title, amount_cents, status: "ready" })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    token: data.token,
    title: data.title,
    amount_cents: data.amount_cents,
    status: data.status,
  };
}

async function getCheckoutLinkByToken(token) {
  const { data, error } = await supabase
    .from("checkout_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateCheckoutLinkPix(id, { tribopay_transaction_id, pix_qr_code }) {
  unwrap(
    await supabase
      .from("checkout_links")
      .update({ status: "pending", tribopay_transaction_id, pix_qr_code })
      .eq("id", id),
  );
}

async function listApiKeys(userId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, key_hint, active, created_at")
    .eq("user_id", userId)
    .order("id", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, active: row.active ? 1 : 0 }));
}

async function createApiKey({ user_id, key_hash, key_hint }) {
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ user_id, key_hash, key_hint, active: true })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

async function revokeApiKey({ id, user_id }) {
  unwrap(
    await supabase
      .from("api_keys")
      .update({ active: false })
      .eq("id", id)
      .eq("user_id", user_id),
  );
}

async function findApiKeyByHash(keyHash) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, active, users:user_id (username, name, approval_status)")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    user_id: data.user_id,
    active: data.active ? 1 : 0,
    username: data.users?.username,
    name: data.users?.name,
    approval_status: data.users?.approval_status || "approved",
  };
}

async function setUserApproval({ user_id, approval_status, rejection_reason }) {
  unwrap(
    await supabase.from("users").update({ approval_status, rejection_reason }).eq("id", user_id),
  );
}

async function createWithdrawal({ user_id, amount_cents, pix_key }) {
  const { data: wallet, error: wErr } = await supabase
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", user_id)
    .maybeSingle();
  if (wErr) throw wErr;
  if (!wallet || wallet.balance_cents < amount_cents) throw new Error("INSUFFICIENT_FUNDS");

  const { data: row, error: insErr } = await supabase
    .from("withdrawal_requests")
    .insert({ user_id, amount_cents, pix_key, status: "processing" })
    .select()
    .single();
  if (insErr) throw insErr;

  const prev = wallet.balance_cents;
  const { data: updated, error: upErr } = await supabase
    .from("wallets")
    .update({ balance_cents: prev - amount_cents, updated_at: new Date().toISOString() })
    .eq("user_id", user_id)
    .eq("balance_cents", prev)
    .select()
    .maybeSingle();
  if (upErr) throw upErr;
  if (!updated) {
    await supabase.from("withdrawal_requests").delete().eq("id", row.id);
    throw new Error("INSUFFICIENT_FUNDS");
  }
  return row;
}

async function getWithdrawalById(id) {
  const { data, error } = await supabase.from("withdrawal_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function listWithdrawalsByUser(userId) {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("id, amount_cents, pix_key, status, admin_note, created_at, updated_at")
    .eq("user_id", userId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function setWithdrawalStatus({ id, status, admin_note }) {
  const { data: row, error } = await supabase.from("withdrawal_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== "processing") throw new Error(`INVALID_STATE:${row.status}`);
  if (status === "rejected") {
    await addToWallet(row.user_id, row.amount_cents);
  }
  unwrap(
    await supabase
      .from("withdrawal_requests")
      .update({
        status,
        admin_note: admin_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
}

module.exports = {
  findUserByUsername,
  findUserById,
  createUser,
  createWallet,
  getWalletWithUser,
  addToWallet,
  listTransactions,
  createPixTransactionRecord,
  listCheckoutLinks,
  createCheckoutLink,
  getCheckoutLinkByToken,
  updateCheckoutLinkPix,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  findApiKeyByHash,
  setUserApproval,
  createWithdrawal,
  getWithdrawalById,
  listWithdrawalsByUser,
  setWithdrawalStatus,
};
