# Antigravity Prompt — Audit, Complete, Polish & Implement Logic
## Chemical Packaging Management System

## IMPORTANT CONTEXT — READ FIRST
This project was **partially built in builder.io**, but that session **expired/ran out before completion**. As a result:
- **Dashboard module** is only partially built.
- **Orders module** is only partially built (roughly half — some screens/flows may be missing or incomplete).
- Other modules (Masters, Inventory, Notes, Leads placeholder) — verify their completion state too; do not assume they're fully done just because they weren't explicitly mentioned as incomplete.

**Your first task, before writing or changing any code:**
1. Thoroughly **go through the entire existing codebase** — every module, screen, component, and route.
2. Build a clear internal map of: what already exists and works, what exists but is incomplete/broken, and what is completely missing.
3. Cross-check this against the full spec below (this document contains the **complete intended system** — treat it as the source of truth for what the finished product should be).
4. Only after this audit, proceed to complete missing pieces, fix incomplete ones, and implement the functional logic described below.

Do **not** rebuild from scratch. Reuse and extend the existing code/components wherever they're already correctly structured. Only replace pieces that are broken, incomplete, or don't match the required flow.

---

## ALSO IMPORTANT — VISUAL DESIGN NEEDS SIGNIFICANT IMPROVEMENT
The current UI looks very basic — like plain unstyled HTML. This needs a real visual upgrade as part of this pass. Specifically:
- Move away from default/plain form elements — apply a proper design system: consistent spacing scale, card elevation/shadows, rounded corners, proper typography hierarchy (distinct font sizes/weights for headings vs body vs labels vs helper text).
- Use a cohesive color palette (a primary brand color, neutral grays for backgrounds/borders, semantic colors for status: pending/in-production/success/warning/error) — applied consistently across every module, not ad hoc per screen.
- Buttons, inputs, dropdowns, modals, and tables should look like they belong to one polished product, not default browser-styled elements.
- Add proper visual hierarchy to listing screens (clear row separation, hover states, status badges with color + icon, not just plain text).
- Dashboard should feel like a real analytics dashboard — proper card shadows/borders, spacing between KPI cards, a well-styled bar graph (not a default unstyled chart), polished alert cards with icons.
- Ensure this design upgrade is applied **consistently across all modules** — Masters, Orders, Inventory, Dashboard, Notes — not just the ones being completed in this pass.
- Maintain full responsiveness (mobile app view + desktop view) throughout the redesign.
- Keep text contrast strong and legible against all backgrounds at every screen.

If it's useful, treat this as: "take this from a basic/default-styled prototype to something that looks like a real, professionally designed SaaS product," while keeping all existing functionality and flows intact.

---

## FULL SYSTEM SPEC (Source of Truth)

### Business Context
Client buys chemicals (raw material) and packaging materials (containers, bags, labels — treated as raw material), packages them per customer orders, and dispatches finished goods. This system manages Masters, Orders, Inventory, Dashboard, Notes, and a future Leads module.

Currency: multi-currency supported, **INR (₹) default**. Units: **kg only**, currently.

Roles: Owner/Admin (full access, fixed), Salesperson, Worker, and other custom roles — fully configurable per employee via Employee Master, no hardcoded permission sets.

---

## MODULE 1: Masters

### 1.1 Product Master
- Toggle: **Finished Goods** / **Raw Material** — switches listing view.
- **Add New**: Product Name, Type (Finished Good / Raw Material). If Finished Good → **Container Type** multiselect (global master list) with inline "+ Add New" (adds to global list, case-insensitive duplicate check, immediately selected for this product).
- Each Finished Good stores its own assigned subset of container types (many-to-many).
- Anywhere else needing a product's container options (Orders → Preferred Container, Mark in Production → Dispatch Containers) fetches **only** that product's assigned types. If multiple products selected, take the deduplicated **union**.

### 1.2 Employee Master
- Listing + Add screen: Basic Details, Designation, **Module Access** (Read/Write checkboxes per module: Masters, Orders, Inventory, Dashboard, Notes, Leads), **Login Credentials** (Phone number = username, unique; Password — masked field with "Reset Password" flow, min 8 characters + at least 1 number + 1 letter, hashed/stored securely, never exposed in plaintext).
- Permissions stored as a permissions object per employee; every module's UI **and backend** must check this before allowing write actions.
- Owner/Admin flag is separate and fixed (cannot be restricted). "Assign Priority" in Orders checks `isOwnerAdmin === true` specifically, not a generic permission.

### 1.3 Supplier Master
- Listing + Add: Name, Address, Contact Number, Lead Source (text), Type (dropdown: Customer / Agent / Raw Material Supplier, inline "+ Add New" for custom types).
- Inline creation from Orders module writes directly here with `contactNumber: null` allowed.
- Name uniqueness check (case-insensitive); prompt "Did you mean [existing name]?" on close matches.

---

## MODULE 2: Orders

### 2.1 Listing
- Search by Batch Number or Supplier Name. Filter modal: Status, Date, Product.
- Status: Pending (default) → In Production.
- 3-dot menu per row: **View Details, Edit, Mark in Production, Assign Priority** (Owner/Admin only).
- **Priority sorting**: Orders with `status !== 'In Production'` AND priority set → sorted `priority ASC`, shown at top. In-Production orders always excluded from this group regardless of priority. Priority badge visible to all roles (read-only for non-owner/admin).

### 2.2 Add Order — 3 entry options
1. **Intake from Lead** — Coming Soon (disabled, tooltip).
2. **Import Order** — paste raw text → "Generate" triggers AI parsing (LLM call) extracting: supplier/customer name, product(s) (fuzzy-matched against Product Master finished goods), quantity per product, rate/kg per product, notes. Returns structured JSON matching the Manual Add schema → shown in an editable confirmation popup → "Confirm" creates the order. Handle low-confidence extraction gracefully (flag fields needing manual completion instead of blocking).
3. **Manual Add** — see 2.3.

### 2.3 Manual Add Order Fields (in order)
1. Supplier/Customer — searchable dropdown, inline add (contact optional; new supplier only persisted on order save, not on typing).
2. Product(s) — multiselect, Finished Goods only.
3. Order Quantity — per product if multiple; kg; **integers only** (reject decimals with inline error).
4. Date — prefilled today, editable.
5. Rate/kg — per product, decimal (2 places), tied to currency (default INR), clearly labeled per product.
6. Preferred Container — multiselect, filtered per selected product(s) (union if multiple).
7. Notes — text area.
8. **Previous Rate** (read-only) — per product: most recent past order's rate/kg from the **same supplier for that same product**. "N/A" if none.
9. **Total Amount** (read-only, real-time) — `Σ(quantity_i × rate_i)`, recalculates live.
10. **Repeat Order** checkbox → reveals: date picker + recurrence type (Monthly / Weekly w/ weekday multiselect) + helper text mentioning supplier name. Same section present in Edit Order.

### 2.4 View Details
All order fields, read-only. If status = In Production, also show Dispatch Containers, Dispatch Note, **View QR** (renders stored QR image).

### 2.5 Mark in Production Modal
Fields in order: Batch Number (auto-generated, read-only), Dispatch Containers (multiselect, positioned right after batch number), Product(s) (read-only), Order Quantity (read-only), Preferred Container (read-only, shown only if set), Dispatch Note (text area), Generate QR (+ Download/Print).
On Confirm (single transaction — all-or-nothing rollback on failure):
1. Generate unique batch number: `ORD-YYYYMMDD-###`, per-day atomic increment (avoid race conditions via DB transaction/atomic counter), never reused even if order later cancelled.
2. Save Dispatch Containers + Dispatch Note.
3. Generate real QR code encoding **batch number as plain text only** (no URL — future in-system scanner will look it up). Working Download (PNG/SVG) + Print.
4. Status: Pending → In Production.
5. Deduct **Finished Goods** inventory stock per product by order quantity. If this would go negative: allow it but show a "stock below zero" warning banner (do not hard-block) — *[confirm if hard-block is preferred instead; current default is allow + warn]*.
6. Create an **OUT** inventory log entry per product (product, quantity, timestamp, reference = batch number).
7. Dispatch Containers conceptually consume **Raw Material** stock — implement as a simple demo-level deduction (1 unit per container type per order, or log-only if no per-order container-quantity field exists yet) — clearly commented as placeholder for future refinement.
8. Order immediately excluded from priority sorting once In Production, even if priority value remains stored.

### 2.6 Repeat Order Logic
Store `recurrenceType`, `recurrenceDate`/weekday list, `supplierId`, `referenceDate` on repeat-enabled orders. Daily scheduled job:
- Monthly: check if today matches stored day-of-month.
- Weekly: check if today's weekday is in stored list.
- On match: check if any order was received from that supplier in the current cycle window. If not, create alert: "Repeat order from [Supplier Name] has not been received yet." Feed into Dashboard Alerts (not push notifications — deferred). Job must be idempotent (no duplicate alerts per day/supplier/rule).

---

## MODULE 3: Inventory
- Toggle Finished Goods / Raw Material, card view (name + qty in kg).
- **Add Inventory** modal: toggle (FG default) → multi-row product+quantity add ("+ Add More", no duplicate product per batch, validated server-side too) → "Add to Inventory" commits, increments stock, creates **IN** log entries.
- **View History**: filter by date range/product, combined IN/OUT log, latest first. Schema: `{ type: 'IN'|'OUT', product, quantity, timestamp, reference }`. OUT logs populated from Mark-in-Production (2.5.6); IN logs from Add Inventory.

---

## MODULE 4: Dashboard

### KPIs
Today's Leads (Coming Soon), New Customers (Today/This Month toggle — query Supplier Master `type='customer'` by `createdAt`), plus useful additions: Pending Orders count, In Production count, Low Stock count, Today's Dispatch count — all live queries.

### Alerts Feed
Unified Alerts collection (`type`, `message`, `timestamp`, `relatedEntityId`), populated by scheduled checks:
- Low Raw Material (below configurable threshold, default 50kg)
- Order unattended 2+ days (Pending, no field change since created/updated)
- No dispatch in 36 hours (no OUT log created)
- Priority order unattended 24 hours (has priority, Pending, no update in 24h+)
- Repeat customer order not received (from 2.6's job)
Dashboard shows latest 6, sorted `timestamp DESC`.

### Dispatch Bar Graph
Dropdown: Month-wise / This Week.
- This Week: sum dispatch qty/day, last 7 days ending today, rightmost bar labeled "Today."
- Month-wise: sum dispatch qty/month, 12 months of data — desktop shows all 12, mobile shows 7 at a time with horizontal scroll (frontend split already expected to exist; verify and complete if missing).
Query source: OUT inventory logs from Mark-in-Production events.

---

## MODULE 5: Notes
Simple CRUD, free-text sticky notes, scoped to logged-in user, no linkage to other entities.

## MODULE 6: Leads
Coming Soon placeholder screen, nav item present.

---

## CROSS-CUTTING REQUIREMENTS
- **Permission enforcement**: every write action across all modules validated against the employee's permissions object on the **backend**, not just hidden in UI.
- **Data integrity**: Mark in Production (batch gen + inventory deduction + log creation + status change) wrapped in a single transaction — full rollback on any failure.
- **Currency**: store rate/amount fields with explicit currency code (default INR) for future multi-currency readiness.
- **Validation states**: required fields, integer-only vs decimal fields, and inline error messages must be clear and consistent across all forms.
- **Reusable components**: Data Table/List, Card, Modal, Dropdown-with-inline-add, Multiselect, Status Badge, Priority Badge, Alert Card, KPI Card — audit existing ones for reuse before creating new versions; upgrade their styling per the visual design section above.

---

## OPEN QUESTION TO CONFIRM BEFORE FINALIZING
When Mark in Production would push Finished Goods stock below zero: allow it with a warning banner (current default), or hard-block until stock is topped up via Add Inventory? Please confirm before finalizing this validation branch.