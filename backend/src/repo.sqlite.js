const db = require("./db");

async function findUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

async function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

async function createUser({
  username,
  name,
  email,
  password_hash,
  role = "client",
  approval_status = "pending",
}) {
  const result = db
    .prepare(
      "INSERT INTO users (username, name, email, password_hash, role, approval_status, rejection_reason) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    )
    .run(username, name, email, password_hash, role, approval_status);
  return { id: Number(result.lastInsertRowid), username, name, email, role, approval_status };
}

async function createWallet(userId) {
  db.prepare("INSERT INTO wallets (user_id, balance_cents) VALUES (?, 0)").run(userId);
}

async function getWalletWithUser(userId) {
  return (
    db
      .prepare(
        `
        SELECT w.id, w.user_id, w.balance_cents, w.updated_at, u.name, u.username
        FROM wallets w
        JOIN users u ON u.id = w.user_id
        WHERE w.user_id = ?
        `,
      )
      .get(userId) || null
  );
}

async function addToWallet(userId, amountCents) {
  db.prepare(
    "UPDATE wallets SET balance_cents = balance_cents + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(amountCents, userId);
  return db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
}

async function listTransactions(userId) {
  return db
    .prepare(
      `
      SELECT id, amount_cents, status, customer_email, created_at, tribopay_transaction_id
      FROM pix_transactions
      WHERE user_id = ?
      ORDER BY id DESC
      `,
    )
    .all(userId);
}

async function createPixTransactionRecord({
  user_id,
  amount_cents,
  status = "pending",
  tribopay_transaction_id,
  tribopay_offer_hash,
  tribopay_product_hash,
  pix_qr_code,
  customer_email,
}) {
  const result = db
    .prepare(
      `
      INSERT INTO pix_transactions (
        user_id, amount_cents, status, tribopay_transaction_id,
        tribopay_offer_hash, tribopay_product_hash, pix_qr_code, customer_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      user_id,
      amount_cents,
      status,
      tribopay_transaction_id,
      tribopay_offer_hash,
      tribopay_product_hash,
      pix_qr_code,
      customer_email,
    );
  return { id: Number(result.lastInsertRowid) };
}

async function listCheckoutLinks(userId) {
  return db
    .prepare(
      `
      SELECT id, token, title, amount_cents, status, created_at
      FROM checkout_links
      WHERE user_id = ?
      ORDER BY id DESC
      `,
    )
    .all(userId);
}

async function createCheckoutLink({ user_id, token, title, amount_cents }) {
  const result = db
    .prepare(
      `
      INSERT INTO checkout_links (user_id, token, title, amount_cents, status)
      VALUES (?, ?, ?, ?, 'ready')
      `,
    )
    .run(user_id, token, title, amount_cents);
  return { id: Number(result.lastInsertRowid), token, title, amount_cents, status: "ready" };
}

async function getCheckoutLinkByToken(token) {
  return (
    db
      .prepare("SELECT * FROM checkout_links WHERE token = ?")
      .get(token) || null
  );
}

async function updateCheckoutLinkPix(id, { tribopay_transaction_id, pix_qr_code }) {
  db.prepare(
    "UPDATE checkout_links SET status = 'pending', tribopay_transaction_id = ?, pix_qr_code = ? WHERE id = ?",
  ).run(tribopay_transaction_id, pix_qr_code, id);
}

async function listApiKeys(userId) {
  return db
    .prepare(
      "SELECT id, key_hint, active, created_at FROM api_keys WHERE user_id = ? ORDER BY id DESC",
    )
    .all(userId);
}

async function createApiKey({ user_id, key_hash, key_hint }) {
  const result = db
    .prepare(
      "INSERT INTO api_keys (user_id, key_hash, key_hint, active) VALUES (?, ?, ?, 1)",
    )
    .run(user_id, key_hash, key_hint);
  return { id: Number(result.lastInsertRowid) };
}

async function revokeApiKey({ id, user_id }) {
  db.prepare("UPDATE api_keys SET active = 0 WHERE id = ? AND user_id = ?").run(id, user_id);
}

async function findApiKeyByHash(keyHash) {
  return (
    db
      .prepare(
        `
        SELECT ak.user_id, ak.active, u.username, u.name, u.approval_status
        FROM api_keys ak
        JOIN users u ON u.id = ak.user_id
        WHERE ak.key_hash = ?
        `,
      )
      .get(keyHash) || null
  );
}

async function setUserApproval({ user_id, approval_status, rejection_reason }) {
  db.prepare("UPDATE users SET approval_status = ?, rejection_reason = ? WHERE id = ?").run(
    approval_status,
    rejection_reason,
    user_id,
  );
}

function createWithdrawal({ user_id, amount_cents, pix_key }) {
  return db.transaction(() => {
    const wallet = db.prepare("SELECT balance_cents FROM wallets WHERE user_id = ?").get(user_id);
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    if (wallet.balance_cents < amount_cents) throw new Error("INSUFFICIENT_FUNDS");
    const ins = db
      .prepare(
        "INSERT INTO withdrawal_requests (user_id, amount_cents, pix_key, status) VALUES (?, ?, ?, 'processing')",
      )
      .run(user_id, amount_cents, pix_key);
    const id = Number(ins.lastInsertRowid);
    db.prepare("UPDATE wallets SET balance_cents = balance_cents - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(
      amount_cents,
      user_id,
    );
    return db.prepare("SELECT * FROM withdrawal_requests WHERE id = ?").get(id);
  })();
}

async function getWithdrawalById(id) {
  return db.prepare("SELECT * FROM withdrawal_requests WHERE id = ?").get(id) || null;
}

async function listWithdrawalsByUser(userId) {
  return db
    .prepare(
      "SELECT id, amount_cents, pix_key, status, admin_note, created_at, updated_at FROM withdrawal_requests WHERE user_id = ? ORDER BY id DESC",
    )
    .all(userId);
}

function setWithdrawalStatus({ id, status, admin_note }) {
  db.transaction(() => {
    const row = db.prepare("SELECT * FROM withdrawal_requests WHERE id = ?").get(id);
    if (!row) throw new Error("NOT_FOUND");
    if (row.status !== "processing") throw new Error(`INVALID_STATE:${row.status}`);
    if (status === "rejected") {
      db.prepare("UPDATE wallets SET balance_cents = balance_cents + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(
        row.amount_cents,
        row.user_id,
      );
    }
    db.prepare("UPDATE withdrawal_requests SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      status,
      admin_note != null ? admin_note : null,
      id,
    );
  })();
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
