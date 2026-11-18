# Reference implementation: Node.js (TypeScript)

A complete implementation of the handler contract in `SKILL.md`, for Node.js 22 or later. It uses the built in `fetch` and `node:crypto` and has no dependencies. Express is used only in the wiring example; `handle()` takes the raw body and the headers, so any framework works.

Port it to another language by keeping the same parts: `handle()` (authenticate, record, answer), the worker (`processEvents()`), the re-read (`syncCustomer()`), the login refresh (`refreshUser()`), and the store contract.

## The module

```ts
// revenuecat-webhooks.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const REVENUECAT = "https://api.revenuecat.com";

// Events that never change access. Skipping their re-read saves REST API calls.
const NO_ACCESS_CHANGE = new Set([
  "TEST",
  "VIRTUAL_CURRENCY_TRANSACTION",
  "PRICE_INCREASE_CONSENT_REQUIRED",
  "PRICE_INCREASE_CONSENT_APPROVED",
  "INVOICE_ISSUANCE",
  "EXPERIMENT_ENROLLMENT",
]);

export interface RevenueCatEvent {
  id: string;
  type: string;
  event_timestamp_ms?: number | null;
  environment?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  transaction_id?: string | null;
  quantity?: number | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  redeemed_by?: string[] | null;
}

export interface InboxEvent {
  id: string;
  body: string;
  attempts: number;
}

/** Your database. Run each method in one transaction and lock the rows it changes. */
export interface WebhookStore {
  /** Insert into the inbox (unique key on id). Return false when the id is already there. */
  recordEvent(id: string, body: string): Promise<boolean>;
  /** Unfinished events whose next attempt is due, oldest first. With several workers, claim them (SKIP LOCKED). */
  dueEvents(now: number, limit: number): Promise<InboxEvent[]>;
  markDone(id: string): Promise<void>;
  /** Keep the event, add one to attempts, and try again at nextAttemptAt. */
  markRetry(id: string, nextAttemptAt: number, error: string): Promise<void>;
  /** Your user for any of these RevenueCat app user IDs, or undefined. */
  findUser(appUserIds: string[]): Promise<string | undefined>;
  /**
   * Replace the entitlements this RevenueCat project grants the user with `active` (lookup key to expiry in ms,
   * null for no expiry). Skip the write when this user and project already hold a read with a later readAtMs.
   * Leave other projects and access from other sources alone.
   */
  saveEntitlements(userId: string, projectId: string, active: Record<string, number | null>, readAtMs: number): Promise<void>;
  /*
   * Consumable ledger, one row per transactionId: purchaseSeen, reversed, owner (user or none), units, the
   * purchase's app user IDs, and refundEventMs (the event_timestamp_ms of the last refund or reversal applied, null
   * until one is).
   * The balance holds `units` for a row exactly while purchaseSeen && !reversed && owner is set: after each change,
   * add the difference to the owner's balance. A row with no owner is "held". Each method creates the row if
   * it is missing.
   */
  /** Purchase: the first time, set purchaseSeen, units, IDs, and owner (when known). Later calls change nothing. */
  recordPurchase(transactionId: string, productId: string, units: number, owner: string | undefined, appUserIds: string[], eventMs: number): Promise<void>;
  /** Refund: set reversed when refundEventMs is null or eventMs is later than it (then store eventMs). */
  reverseCredit(transactionId: string, eventMs: number): Promise<void>;
  /** Refund reversed: clear reversed when refundEventMs is null or eventMs is later than it (then store eventMs). */
  restoreCredit(transactionId: string, eventMs: number): Promise<void>;
  /** Set owner = userId on every row without an owner whose IDs include one of appUserIds. */
  claimHeldCredits(userId: string, appUserIds: string[]): Promise<void>;
}

export interface WebhookConfig {
  /** The Authorization header value set on the webhook in the RevenueCat dashboard. */
  authorization: string;
  /** The HMAC signing secret. Set only when HMAC webhook signing is on. */
  signingSecret?: string;
  /**
   * A RevenueCat secret API key created for REST API v2 (sk_...; a v1 key does not work with v2) with
   * customer_information:customers:read and project_configuration:entitlements:read.
   */
  secretApiKey: string;
  /** The RevenueCat project this webhook belongs to (proj...). */
  projectId: string;
  /** Consumables you credit yourself: product_id to units per purchase. */
  consumables: Record<string, number>;
  /** Credit consumables bought in sandbox too. Keep false on a production server. */
  creditSandbox?: boolean;
  store: WebhookStore;
}

class RetryLater extends Error {
  waitMs: number;
  constructor(message: string, waitMs: number) {
    super(message);
    this.waitMs = waitMs;
  }
}

export function createRevenueCatWebhook(config: WebhookConfig) {
  // Fail at startup, not on every request. A blank value would also match an empty header.
  if (!config.authorization?.trim()) throw new Error("Set the webhook Authorization value from the RevenueCat dashboard");
  if (!config.secretApiKey?.trim()) throw new Error("Set a RevenueCat secret API key for REST API v2");
  if (!config.projectId?.trim()) throw new Error("Set the RevenueCat project ID");
  const { store } = config;
  const project = `/v2/projects/${encodeURIComponent(config.projectId)}`;
  let running = false;
  let again = false;
  let entitlementKeys = new Map<string, string>();
  let keysLoadedAt = 0;

  /** Authenticate, record the event once, and return the status to answer. */
  async function handle(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<number> {
    if (!safeEqual(header(headers, "authorization"), config.authorization)) return 401;
    if (!Buffer.isBuffer(rawBody)) return 400;
    if (config.signingSecret && !verifySignature(rawBody, header(headers, "x-revenuecat-webhook-signature"), config.signingSecret)) {
      return 401;
    }
    let id: unknown;
    try {
      id = JSON.parse(rawBody.toString("utf8"))?.event?.id;
    } catch {
      return 400;
    }
    if (typeof id !== "string" || id === "") return 400;
    // A duplicate is already recorded: answer 200 again and do nothing more.
    await store.recordEvent(id, rawBody.toString("utf8"));
    return 200;
  }

  /** Apply every due event. Safe to call often; overlapping calls in one process merge into one pass. */
  async function processEvents(): Promise<void> {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await drain();
      } while (again);
    } finally {
      running = false;
    }
  }

  async function drain(): Promise<void> {
    for (;;) {
      const due = await store.dueEvents(Date.now(), 25);
      if (due.length === 0) return;
      for (const row of due) {
        try {
          await apply(JSON.parse(row.body).event as RevenueCatEvent);
          await store.markDone(row.id);
        } catch (error) {
          const waitMs = error instanceof RetryLater ? error.waitMs : 0;
          const backoffMs = Math.max(waitMs, Math.min(1000 * 2 ** row.attempts, 3_600_000));
          console.error(`RevenueCat event ${row.id} failed, retrying in ${backoffMs} ms`, error);
          await store.markRetry(row.id, Date.now() + backoffMs, String(error));
        }
      }
    }
  }

  async function apply(event: RevenueCatEvent): Promise<void> {
    if (event.type === "TEST") return;
    const ids = knownIds(event);
    const eventMs = event.event_timestamp_ms ?? 0;
    let aliasIds: string[] | undefined; // fetched at most once per event

    // The payload only for what the customer record does not carry: consumable credits.
    const productId = event.product_id ?? "";
    const units = Object.hasOwn(config.consumables, productId) ? config.consumables[productId] : 0;
    if (units > 0 && !event.transaction_id) {
      console.warn(`RevenueCat ${event.type} ${event.id} for ${productId} has no transaction_id; not credited or reversed`);
    } else if (units > 0 && event.environment === "SANDBOX" && !config.creditSandbox) {
      console.info(`RevenueCat sandbox ${event.type} ${event.transaction_id}: no credit change`);
    } else if (units > 0 && event.transaction_id) {
      if (event.type === "NON_RENEWING_PURCHASE") {
        // Bought before logIn, the event can carry only anonymous IDs. Once logIn merged them, the
        // customer's aliases include the user's ID; until then the credit is held for a later claim.
        let owner = await store.findUser(ids);
        if (!owner && event.app_user_id) {
          aliasIds = await aliases(event.app_user_id);
          owner = await store.findUser(aliasIds);
        }
        await store.recordPurchase(event.transaction_id, productId, units * (event.quantity ?? 1), owner, ids, eventMs);
      } else if (event.type === "CANCELLATION") {
        if (event.event_timestamp_ms == null) console.warn(`RevenueCat ${event.type} ${event.id} has no event_timestamp_ms`);
        await store.reverseCredit(event.transaction_id, eventMs);
      } else if (event.type === "REFUND_REVERSED") {
        if (event.event_timestamp_ms == null) console.warn(`RevenueCat ${event.type} ${event.id} has no event_timestamp_ms`);
        await store.restoreCredit(event.transaction_id, eventMs);
      }
    }

    // Access: re-read every customer the event touches and store what RevenueCat reports now.
    if (NO_ACCESS_CHANGE.has(event.type)) return;
    let targets: string[][];
    if (event.type === "TRANSFER") targets = [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].map((id) => [id]);
    else if (event.type === "PURCHASE_REDEEMED") targets = (event.redeemed_by ?? []).map((id) => [id]);
    else targets = ids.length > 0 ? [aliasIds ? [...ids, ...aliasIds] : ids] : [];
    if (targets.length === 0) console.warn(`RevenueCat event ${event.id} (${event.type}) has no app user ID`);
    for (const target of targets) {
      // Not in this project: the project ID or key belongs to another project, or the customer was deleted.
      // Never revoke on that; fail and keep the event queued, where the error stays visible.
      if ((await syncCustomer(target, aliasIds !== undefined)) === "not_found") {
        throw new Error(`RevenueCat customer ${target[0]} not found in project ${config.projectId}; check the project ID and the key`);
      }
    }
  }

  /** Re-read one customer and save its active entitlements. Also use it before denying access at serve time. */
  async function syncCustomer(ids: string[], aliasesIncluded = false): Promise<"saved" | "no_user" | "not_found"> {
    let known = ids;
    let userId = await store.findUser(known);
    if (!userId && !aliasesIncluded) {
      // An event can name only an anonymous ID of a customer your user merged into (TRANSFER does this too).
      known = [...ids, ...(await aliases(ids[0]))];
      userId = await store.findUser(known);
    }
    if (!userId) {
      console.warn(`RevenueCat customer ${ids[0]} matches no user; skipped`);
      return "no_user";
    }
    const readAtMs = Date.now();
    const customer = await get(`${project}/customers/${encodeURIComponent(ids[0])}`);
    if (customer === null) return "not_found";
    // Never read a missing list as "no access".
    if (!customer.active_entitlements) throw new Error(`RevenueCat customer ${ids[0]} came back without active_entitlements`);
    const active: Record<string, number | null> = {};
    let page = customer.active_entitlements;
    while (page) {
      for (const item of page.items ?? []) {
        const key = await lookupKey(item.entitlement_id);
        if (key === undefined) console.error(`RevenueCat entitlement ${item.entitlement_id} is not in the entitlements list of ${config.projectId}; skipped`);
        else active[key] = item.expires_at ?? null;
      }
      page = page.next_page ? await get(page.next_page) : null;
    }
    await store.saveEntitlements(userId, config.projectId, active, readAtMs);
    // Consumables bought under one of these IDs before the user signed in now have an owner.
    await store.claimHeldCredits(userId, known);
    return "saved";
  }

  /**
   * Call after the app reports that Purchases.logIn or restorePurchases finished, with the signed in user's own ID
   * (never an ID from the request). Refreshes access and claims consumables bought before login.
   */
  async function refreshUser(userId: string): Promise<void> {
    await syncCustomer([userId, ...(await aliases(userId))], true);
  }

  async function aliases(appUserId: string): Promise<string[]> {
    const ids: string[] = [];
    let page = await get(`${project}/customers/${encodeURIComponent(appUserId)}/aliases`);
    while (page) {
      for (const alias of page.items ?? []) ids.push(alias.id);
      page = page.next_page ? await get(page.next_page) : null;
    }
    return ids;
  }

  /** active_entitlements carries entitlement IDs; map them to lookup keys (your "premium"). */
  async function lookupKey(entitlementId: string): Promise<string | undefined> {
    if (entitlementKeys.has(entitlementId)) return entitlementKeys.get(entitlementId);
    // Reload at most once a minute (the entitlements endpoint has a lower rate limit); retry until then.
    if (Date.now() - keysLoadedAt < 60_000) throw new RetryLater(`RevenueCat entitlement ${entitlementId} is not in the cached entitlements list`, 60_000);
    const keys = new Map<string, string>();
    let page = await get(`${project}/entitlements?limit=100`);
    if (page === null) throw new Error(`RevenueCat project ${config.projectId} not found; check the project ID and the key`);
    while (page) {
      for (const entitlement of page.items ?? []) keys.set(entitlement.id, entitlement.lookup_key);
      page = page.next_page ? await get(page.next_page) : null;
    }
    entitlementKeys = keys;
    keysLoadedAt = Date.now();
    // undefined: a fresh list still lacks it. The caller skips it with an alert rather than stalling the customer.
    return entitlementKeys.get(entitlementId);
  }

  /** GET a REST API v2 path. null on 404; throws on anything else that is not 2xx. */
  async function get(path: string): Promise<any> {
    const response = await fetch(`${REVENUECAT}${path}`, { headers: { Authorization: `Bearer ${config.secretApiKey}` } });
    if (response.status === 404) return null;
    // 423: RevenueCat is still processing this customer (wait backoff_ms). 429 and 5xx: try again later.
    if (response.status === 429 || response.status === 423 || response.status >= 500) {
      const backoffMs = Number((await response.json().catch(() => ({})))?.backoff_ms);
      throw new RetryLater(`GET ${path} answered ${response.status}`, Math.max(retryAfterMs(response), Number.isFinite(backoffMs) ? backoffMs : 0));
    }
    if (!response.ok) throw new Error(`GET ${path} answered ${response.status}; check the key (a v1 key does not work with REST API v2) and its permissions`);
    return response.json();
  }

  return { handle, processEvents, syncCustomer, refreshUser };
}

export function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string, toleranceSeconds = 300): boolean {
  if (!signature) return false;
  const parts = new Map<string, string>();
  for (const part of signature.split(",")) {
    const i = part.indexOf("=");
    if (i > 0) parts.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1 || !/^\d+$/.test(t)) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false;
  // Over "<t>." plus the raw bytes exactly as received. Re-serialized JSON would not match.
  const expected = createHmac("sha256", secret).update(`${t}.`).update(rawBody).digest("hex");
  return safeEqual(v1, expected);
}

function safeEqual(actual: string | undefined, expected: string): boolean {
  if (actual === undefined) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function knownIds(event: RevenueCatEvent): string[] {
  // app_user_id first: it is the ID RevenueCat saw last. Look users up by all of them.
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}
```

## Wiring it into Express

```ts
// server.ts
import express from "express";
import { createRevenueCatWebhook } from "./revenuecat-webhooks.ts";
import { store } from "./revenuecat-store.ts"; // your WebhookStore on your database
import { requireUser } from "./auth.ts"; // your auth middleware; it sets res.locals.userId

const webhook = createRevenueCatWebhook({
  authorization: process.env.REVENUECAT_WEBHOOK_AUTHORIZATION ?? "",
  signingSecret: process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET || undefined,
  secretApiKey: process.env.REVENUECAT_SECRET_API_KEY ?? "",
  projectId: process.env.REVENUECAT_PROJECT_ID ?? "",
  consumables: { coins_100: 100 },
  store,
});

function processSoon(): void {
  webhook.processEvents().catch((error) => console.error("RevenueCat event processing failed", error));
}

const app = express();

// Raw body on this route only: the HMAC covers the exact bytes RevenueCat sent.
app.post("/webhooks/revenuecat", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    res.sendStatus(await webhook.handle(req.body, req.headers));
  } catch (error) {
    console.error("RevenueCat event not recorded", error);
    res.sendStatus(500); // Not recorded: RevenueCat delivers it again.
  }
  processSoon();
});

// The app calls this right after Purchases.logIn or restorePurchases finishes.
app.post("/me/revenuecat/refresh", requireUser, async (_req, res) => {
  try {
    await webhook.refreshUser(res.locals.userId);
    res.sendStatus(204);
  } catch (error) {
    console.error("RevenueCat refresh failed", error);
    res.sendStatus(502);
  }
});

// Retries and anything a crash left behind.
setInterval(processSoon, 10_000);

app.listen(3000);
```

On serverless hosting, keep `handle()` in the request and run `processEvents()` from a scheduled function or a queue consumer instead of `setInterval`.

## The store

Implement `WebhookStore` on your database. A relational layout that fits it:

- `revenuecat_events`: `id` primary key, `body`, `attempts`, `next_attempt_at`, `done_at`, `last_error`. `recordEvent` is an insert that ignores a duplicate key and reports whether it inserted. With several workers, `dueEvents` claims rows by moving `next_attempt_at` forward in the same statement (`UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`), so no lock is held during the HTTP calls.
- `revenuecat_access`: one row per user and RevenueCat project with `read_at_ms`, and one child row per lookup key with `expires_at` (null for no expiry). `saveEntitlements` locks the access row, returns when the stored `read_at_ms` is later, then replaces the child rows, all in one transaction.
- `consumable_ledger`: `transaction_id` primary key, `purchase_seen`, `reversed`, `owner_user_id` (nullable), `units`, `app_user_ids`, `refund_event_ms` (null until a refund or reversal is applied). Every method inserts the row if it is missing, reads it `FOR UPDATE`, and changes the row and the owner's balance by the difference in credited units in the same transaction, so a refund and a claim cannot both win.

The in-memory store below shows the same semantics, and is what the tests for this file run against:

```ts
// memory-store.ts
import type { InboxEvent, WebhookStore } from "./revenuecat-webhooks.ts";

type LedgerRow = { purchaseSeen: boolean; reversed: boolean; owner?: string; units: number; ids: string[]; refundEventMs: number | null };

export class MemoryStore implements WebhookStore {
  users = new Map<string, { access: Map<string, { active: Record<string, number | null>; readAtMs: number }>; coins: number }>();
  private inbox = new Map<string, InboxEvent & { nextAttemptAt: number; done: boolean }>();
  private ledger = new Map<string, LedgerRow>();

  constructor(userIds: string[]) {
    for (const id of userIds) this.users.set(id, { access: new Map(), coins: 0 });
  }

  async recordEvent(id: string, body: string): Promise<boolean> {
    if (this.inbox.has(id)) return false;
    this.inbox.set(id, { id, body, attempts: 0, nextAttemptAt: 0, done: false });
    return true;
  }

  async dueEvents(now: number, limit: number): Promise<InboxEvent[]> {
    return [...this.inbox.values()].filter((e) => !e.done && e.nextAttemptAt <= now).slice(0, limit);
  }

  async markDone(id: string): Promise<void> {
    const event = this.inbox.get(id);
    if (event) event.done = true;
  }

  async markRetry(id: string, nextAttemptAt: number): Promise<void> {
    const event = this.inbox.get(id);
    if (event) {
      event.attempts += 1;
      event.nextAttemptAt = nextAttemptAt;
    }
  }

  async findUser(appUserIds: string[]): Promise<string | undefined> {
    return appUserIds.find((id) => this.users.has(id));
  }

  async saveEntitlements(userId: string, projectId: string, active: Record<string, number | null>, readAtMs: number): Promise<void> {
    const user = this.users.get(userId);
    const stored = user?.access.get(projectId);
    if (!user || (stored && stored.readAtMs > readAtMs)) return;
    user.access.set(projectId, { active: { ...active }, readAtMs });
  }

  async recordPurchase(transactionId: string, _productId: string, units: number, owner: string | undefined, appUserIds: string[]): Promise<void> {
    const row = this.row(transactionId);
    if (row.purchaseSeen) return;
    this.change(row, () => {
      row.purchaseSeen = true;
      row.units = units;
      row.ids = appUserIds;
      row.owner ??= owner;
    });
  }

  async reverseCredit(transactionId: string, eventMs: number): Promise<void> {
    const row = this.row(transactionId);
    if (row.refundEventMs !== null && eventMs <= row.refundEventMs) return;
    this.change(row, () => {
      row.reversed = true;
      row.refundEventMs = eventMs;
    });
  }

  async restoreCredit(transactionId: string, eventMs: number): Promise<void> {
    const row = this.row(transactionId);
    if (row.refundEventMs !== null && eventMs <= row.refundEventMs) return;
    this.change(row, () => {
      row.reversed = false;
      row.refundEventMs = eventMs;
    });
  }

  async claimHeldCredits(userId: string, appUserIds: string[]): Promise<void> {
    for (const row of this.ledger.values()) {
      if (row.owner || !row.ids.some((id) => appUserIds.includes(id))) continue;
      this.change(row, () => {
        row.owner = userId;
      });
    }
  }

  private row(transactionId: string): LedgerRow {
    let row = this.ledger.get(transactionId);
    if (!row) this.ledger.set(transactionId, (row = { purchaseSeen: false, reversed: false, units: 0, ids: [], refundEventMs: null }));
    return row;
  }

  /** Apply a mutation, then move the difference in credited units to the owner's balance. */
  private change(row: LedgerRow, mutate: () => void): void {
    const credited = () => (row.purchaseSeen && !row.reversed && row.owner ? row.units : 0);
    const before = credited();
    mutate();
    const delta = credited() - before;
    if (delta !== 0) this.users.get(row.owner!)!.coins += delta;
  }
}
```

Access check at serve time: an entitlement is active while its stored expiry is null or in the future. When it has passed, call `webhook.syncCustomer([appUserId])` before denying (throttled per user, for example once every few minutes), because a renewal reaches the store only when its webhook does. `syncCustomer` answers `"not_found"` for a user RevenueCat does not know yet; treat that as no access.
