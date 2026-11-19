(() => {
    "use strict";

    const db = firebase.firestore();
    const $ = id => document.getElementById(id);

    const ITEMS = "housekeepingLinenItems";
    const BALANCES = "housekeepingStockBalances";
    const MOVEMENTS = "housekeepingStockMovements";

    const STATES = ["available", "allocated", "inUse", "inLaundry", "damaged"];

    const LABELS = {
        available: "Available",
        allocated: "Allocated",
        inUse: "In Use",
        inLaundry: "In Laundry",
        damaged: "Damaged",
        purchase: "Purchase Received"
    };

    const TRANSITIONS = {
        available: ["allocated", "damaged"],
        allocated: ["available", "inUse", "damaged"],
        inUse: ["inLaundry", "damaged"],
        inLaundry: ["available", "damaged"],
        damaged: ["available"]
    };

    let items = [];
    let balances = [];
    let selectedItem = null;
    let saving = false;

    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);

    function showStatus(message, error = false) {
        $("stockStatus").textContent = message;
        $("stockStatus").style.color = error ? "#a93226" : "#203030";
    }

    function number(value) {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    function total(balance) {
        return STATES.reduce((sum, state) => sum + number(balance[state]), 0);
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = value.toDate ? value.toDate() : new Date(value);
        return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
    }

    function getBalance(itemId) {
        return balances.find(record => record.itemId === itemId);
    }

    function renderOverview() {
        const totals = Object.fromEntries(STATES.map(state => [
            state,
            balances.reduce((sum, balance) => sum + number(balance[state]), 0)
        ]));

        $("availableTotal").textContent = totals.available;
        $("allocatedTotal").textContent = totals.allocated;
        $("inUseTotal").textContent = totals.inUse;
        $("laundryTotal").textContent = totals.inLaundry;
        $("damagedTotal").textContent = totals.damaged;
    }

    function renderBalances() {
        const body = $("stockBody");

        if (!items.length) {
            body.innerHTML = `<tr><td colspan="9">No active configured stock items found.</td></tr>`;
            return;
        }

        const configuredRows = items.map(item => {
            const balance = getBalance(item.id);

            if (!balance) {
                return `<tr>
                    <td>${esc(item.itemName || "Unnamed item")}</td>
                    <td>${esc(item.size || "")}</td>
                    <td colspan="6">Not initialised</td>
                    <td><button type="button" class="hk-btn" data-opening-item="${esc(item.id)}">Enter Quantity</button></td>
                </tr>`;
            }

            return `<tr>
                <td>${esc(balance.itemName || item.itemName || "Unknown item")}</td>
                <td>${esc(balance.size || item.size || "")}</td>
                <td>${number(balance.available)}</td>
                <td>${number(balance.allocated)}</td>
                <td>${number(balance.inUse)}</td>
                <td>${number(balance.inLaundry)}</td>
                <td>${number(balance.damaged)}</td>
                <td><strong>${total(balance)}</strong></td>
                <td><button type="button" class="hk-btn" data-move="${esc(item.id)}">Move Stock</button></td>
            </tr>`;
        });

        const orphanedRows = balances
            .filter(balance => !items.some(item => item.id === balance.itemId))
            .map(balance => `<tr>
                <td>${esc(balance.itemName || "Unknown item")} (inactive/unconfigured)</td>
                <td>${esc(balance.size || "")}</td>
                <td>${number(balance.available)}</td>
                <td>${number(balance.allocated)}</td>
                <td>${number(balance.inUse)}</td>
                <td>${number(balance.inLaundry)}</td>
                <td>${number(balance.damaged)}</td>
                <td><strong>${total(balance)}</strong></td>
                <td>Preserved</td>
            </tr>`);

        body.innerHTML = [...configuredRows, ...orphanedRows].join("");
    }

    function renderMovements(records) {
        const body = $("movementBody");

        if (!records.length) {
            body.innerHTML = `<tr><td colspan="7">No stock movements recorded.</td></tr>`;
            return;
        }

        body.innerHTML = records.map(record => `<tr>
            <td>${esc(formatDate(record.createdAt))}</td>
            <td>${esc(record.itemName)}</td>
            <td>${number(record.quantity)}</td>
            <td>${esc(LABELS[record.fromStatus] || record.fromStatus)}</td>
            <td>${esc(LABELS[record.toStatus] || record.toStatus)}</td>
            <td>${esc(record.note)}</td>
            <td>${esc(record.actorEmail || record.actorUid || "Admin")}</td>
        </tr>`).join("");
    }

    async function loadAll() {
        showStatus("Loading configured items and stock balances...");

        try {
            const [itemSnapshot, balanceSnapshot, movementSnapshot] = await Promise.all([
                db.collection(ITEMS).where("active", "==", true).get(),
                db.collection(BALANCES).get(),
                db.collection(MOVEMENTS).orderBy("createdAt", "desc").limit(100).get()
            ]);

            items = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            balances = balanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            renderOverview();
            renderBalances();
            renderMovements(movementSnapshot.docs.map(doc => doc.data()));

            const uninitialised = items.filter(item => !getBalance(item.id)).length;

            showStatus(
                `${items.length} active configured item(s); ${balances.length} balance(s) loaded; ${uninitialised} item(s) not initialised.`
            );
        } catch (error) {
            console.error("Stock load failed:", error);
            showStatus(`Unable to load stock: ${error.message}`, true);
        }
    }

    function openOpeningStock(focusItemId = null) {
        if (saving) return;

        const uninitialised = items.filter(item => {
            const balance = getBalance(item.id);
            if (!balance) return true;

            const states = [
                "available", "allocated", "inUse",
                "inLaundry", "damaged"
            ];

            const hasQuantity = states.some(
                state => number(balance[state]) !== 0
            );

            return !hasQuantity &&
                balance.openingQuantityVerified !== true &&
                balance.initialisedFromConfiguration !== true &&
                balance.openingInLaundryRecorded !== true &&
                !balance.createdFromPurchaseId &&
                number(balance.openingQuantity) === 0;
        });

        if (!uninitialised.length) {
            showStatus("All active configured items already have stock balances.");
            return;
        }

        $("openingStockBody").innerHTML = uninitialised.map(item => `
            <tr>
                <td>${esc(item.itemName || "Unnamed item")}</td>
                <td>${esc(item.size || "")}</td>
                <td>${number(item.quantity)}</td>
                <td>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        data-opening-quantity
                        data-item-id="${esc(item.id)}"
                        aria-label="Verified physical quantity for ${esc(item.itemName || "item")}"
                        style="width:110px"
                    >
                </td>
            </tr>
        `).join("");

        $("openingStockPanel").hidden = false;
        $("openingStockPanel").scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        const target = focusItemId
            ? $("openingStockBody").querySelector(
                `[data-item-id="${CSS.escape(focusItemId)}"]`
              )
            : $("openingStockBody").querySelector("[data-opening-quantity]");

        if (target) target.focus();

        showStatus(
            `${uninitialised.length} item(s) require verified opening quantities.`
        );
    }

    async function saveOpeningStock(event) {
        event.preventDefault();

        if (saving) return;

        const inputs = [
            ...$("openingStockBody").querySelectorAll("[data-opening-quantity]")
        ];

        const quantities = new Map();

        for (const input of inputs) {
            const raw = input.value.trim();
            const quantity = Number(raw);

            if (
                raw === "" ||
                !Number.isInteger(quantity) ||
                quantity < 0
            ) {
                input.focus();
                showStatus(
                    "Enter a valid whole-number physical quantity for every item. No quantities were saved.",
                    true
                );
                return;
            }

            quantities.set(input.dataset.itemId, quantity);
        }

        if (!quantities.size) {
            showStatus("There are no eligible opening quantities to save.", true);
            return;
        }

        const confirmed = confirm(
            `Save verified physical opening quantities for ${quantities.size} item(s)? Existing stock activity and non-zero balances will be preserved.`
        );

        if (!confirmed) return;

        saving = true;
        $("saveOpeningStock").disabled = true;
        $("cancelOpeningStock").disabled = true;

        try {
            let created = 0;
            let updated = 0;
            let skipped = 0;

            const eligibleItems = items.filter(
                item => quantities.has(item.id)
            );

            const user = firebase.auth().currentUser;

            for (const item of eligibleItems) {
                const openingQuantity = quantities.get(item.id);
                const balanceRef = db.collection(BALANCES).doc(item.id);
                const movementRef = db.collection(MOVEMENTS).doc();

                // Preserve any item with an existing stock movement.
                const movementSnapshot = await db
                    .collection(MOVEMENTS)
                    .where("itemId", "==", item.id)
                    .limit(1)
                    .get();

                if (!movementSnapshot.empty) {
                    skipped++;
                    continue;
                }

                const result = await db.runTransaction(async transaction => {
                    const existing = await transaction.get(balanceRef);

                    if (existing.exists) {
                        const current = existing.data();

                        const states = [
                            "available", "allocated", "inUse",
                            "inLaundry", "damaged"
                        ];

                        const hasQuantity = states.some(
                            state => number(current[state]) !== 0
                        );

                        if (
                            hasQuantity ||
                            current.openingQuantityVerified === true ||
                            current.initialisedFromConfiguration === true ||
                            current.openingInLaundryRecorded === true ||
                            current.createdFromPurchaseId ||
                            number(current.openingQuantity) !== 0
                        ) {
                            return "skipped";
                        }

                        transaction.update(balanceRef, {
                            available: openingQuantity,
                            openingQuantity,
                            openingQuantityVerified: true,
                            initialisedFromConfiguration: false,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        transaction.set(balanceRef, {
                            itemId: item.id,
                            itemName: item.itemName || "",
                            category: item.category || "",
                            size: item.size || "",
                            available: openingQuantity,
                            allocated: 0,
                            inUse: 0,
                            inLaundry: 0,
                            damaged: 0,
                            openingQuantity,
                            initialisedFromConfiguration: false,
                            openingQuantityVerified: true,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    transaction.set(movementRef, {
                        itemId: item.id,
                        itemName: item.itemName || "",
                        quantity: openingQuantity,
                        fromStatus: "opening",
                        toStatus: "available",
                        note: "Verified physical opening stock",
                        actorUid: user?.uid || "",
                        actorEmail: user?.email || "",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    return existing.exists ? "updated" : "created";
                });

                if (result === "created") created++;
                else if (result === "updated") updated++;
                else skipped++;
            }

            $("openingStockPanel").hidden = true;

            showStatus(
                `Opening stock saved. ${created} created; ${updated} existing balances initialised; ${skipped} skipped and preserved.`
            );

            await loadAll();

        } catch (error) {
            console.error("Opening stock save failed:", error);
            showStatus(
                `Opening stock save failed: ${error.message}. Check the balances before retrying.`,
                true
            );
        } finally {
            saving = false;
            $("saveOpeningStock").disabled = false;
            $("cancelOpeningStock").disabled = false;
        }
    }
    function openOpeningLaundry() {
        if (saving) return;
        const eligible = items.filter(item => {
            const balance = getBalance(item.id);
            return balance && balance.openingInLaundryRecorded !== true;
        });
        if (!eligible.length) {
            showStatus("Opening In Laundry quantities have already been recorded for all initialised items.", true);
            return;
        }
        $("openingLaundryItem").innerHTML = '<option value="">Select item</option>' + eligible.map(item => {
            const balance = getBalance(item.id);
            return `<option value="${esc(item.id)}">${esc(item.itemName)} — ${esc(item.size || "")} (currently In Laundry: ${number(balance.inLaundry)})</option>`;
        }).join("");
        $("openingLaundryQuantity").value = "";
        $("openingLaundryProvider").value = "";
        $("openingLaundryExpectedDate").value = "";
        $("openingLaundryNote").value = "Opening stock already at external laundry when TEST stock tracking commenced.";
        $("openingLaundryPanel").hidden = false;
        $("openingLaundryPanel").scrollIntoView({behavior:"smooth",block:"center"});
    }

    async function saveOpeningLaundry(event) {
        event.preventDefault();
        if (saving) return;
        const itemId = $("openingLaundryItem").value;
        const quantity = Number($("openingLaundryQuantity").value);
        const provider = $("openingLaundryProvider").value.trim();
        const expectedDate = $("openingLaundryExpectedDate").value;
        const note = $("openingLaundryNote").value.trim();
        const item = items.find(x => x.id === itemId);
        if (!item || !Number.isInteger(quantity) || quantity < 1 || !provider || !expectedDate || !note) {
            showStatus("Select an item and enter a positive whole quantity, provider, expected return date and note.", true);
            return;
        }
        if (!confirm(`Record ${quantity} ${item.itemName} as opening stock already at ${provider}? Available stock will not change.`)) return;
        saving = true;
        $("saveOpeningLaundry").disabled = true;
        try {
            const balanceRef = db.collection(BALANCES).doc(itemId);
            const movementRef = db.collection(MOVEMENTS).doc();
            const user = firebase.auth().currentUser;
            await db.runTransaction(async tx => {
                const snap = await tx.get(balanceRef);
                if (!snap.exists) throw new Error("Stock balance not found. Refresh and try again.");
                const current = snap.data();
                if (current.openingInLaundryRecorded === true) throw new Error("Opening In Laundry quantity has already been recorded for this item. No change made.");
                tx.update(balanceRef, {
                    inLaundry: number(current.inLaundry) + quantity,
                    openingInLaundryRecorded: true,
                    openingInLaundryQuantity: quantity,
                    openingLaundryProvider: provider,
                    openingLaundryExpectedDate: expectedDate,
                    openingLaundryRecordedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                tx.set(movementRef, {
                    itemId, itemName: item.itemName || "", quantity,
                    fromStatus: "opening", toStatus: "inLaundry",
                    note: `${note} Provider: ${provider}. Expected return: ${expectedDate}.`,
                    movementType: "opening_external_laundry_balance",
                    actorUid: user?.uid || "", actorEmail: user?.email || "",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            $("openingLaundryPanel").hidden = true;
            $("openingLaundryForm").reset();
            showStatus(`Opening In Laundry balance recorded: ${quantity} ${item.itemName}. Available stock was not changed.`);
            await loadAll();
        } catch (error) {
            console.error("Opening laundry balance failed:", error);
            showStatus(`Opening In Laundry balance was not recorded: ${error.message}`, true);
        } finally {
            saving = false;
            $("saveOpeningLaundry").disabled = false;
        }
    }

    function openMovement(itemId) {
        selectedItem = items.find(item => item.id === itemId);

        if (!selectedItem) {
            showStatus("The selected configured item could not be found.", true);
            return;
        }

        const balance = getBalance(itemId);

        if (!balance) {
            showStatus("This item has no opening stock balance. Initialise verified physical stock first.", true);
            return;
        }

        $("movementItem").value = `${selectedItem.itemName} — ${selectedItem.size || ""}`;
        $("movementQuantity").value = "";
        $("movementNote").value = "";
        $("movementFrom").value = "available";
        $("movementTo").value = "allocated";
        $("movementPanel").hidden = false;
        $("movementPanel").scrollIntoView({ behavior: "smooth", block: "start" });

        updateAllowedDestinations();
    }

    function updateAllowedDestinations() {
        const fromStatus = $("movementFrom").value;
        const allowed = TRANSITIONS[fromStatus] || [];

        $("movementTo").innerHTML = allowed.map(status =>
            `<option value="${status}">${LABELS[status]}</option>`
        ).join("");
    }

    async function saveMovement(event) {
        event.preventDefault();

        if (saving || !selectedItem) return;

        const quantity = Number($("movementQuantity").value);
        const fromStatus = $("movementFrom").value;
        const toStatus = $("movementTo").value;
        const note = $("movementNote").value.trim();

        if (!Number.isInteger(quantity) || quantity <= 0) {
            showStatus("Enter a whole-number quantity greater than zero.", true);
            return;
        }

        if (!(TRANSITIONS[fromStatus] || []).includes(toStatus)) {
            showStatus("That stock movement is not an allowed transition.", true);
            return;
        }

        if (!note) {
            showStatus("Enter a reason or reference for this movement.", true);
            return;
        }

        const itemId = selectedItem.id;
        const balanceRef = db.collection(BALANCES).doc(itemId);
        const movementRef = db.collection(MOVEMENTS).doc();
        const user = firebase.auth().currentUser;
        const itemSnapshot = { ...selectedItem };

        saving = true;
        $("saveMovement").disabled = true;

        try {
            await db.runTransaction(async transaction => {
                const snapshot = await transaction.get(balanceRef);

                if (!snapshot.exists) {
                    throw new Error("Stock balance no longer exists. Refresh and try again.");
                }

                const current = snapshot.data();
                const fromQuantity = number(current[fromStatus]);

                if (fromQuantity < quantity) {
                    throw new Error(`Insufficient ${LABELS[fromStatus]} stock. Available: ${fromQuantity}.`);
                }

                transaction.update(balanceRef, {
                    [fromStatus]: fromQuantity - quantity,
                    [toStatus]: number(current[toStatus]) + quantity,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                transaction.set(movementRef, {
                    itemId,
                    itemName: itemSnapshot.itemName || "",
                    quantity,
                    fromStatus,
                    toStatus,
                    note,
                    actorUid: user?.uid || "",
                    actorEmail: user?.email || "",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            $("movementPanel").hidden = true;
            $("movementForm").reset();
            selectedItem = null;
            showStatus("Stock movement recorded successfully.");
            await loadAll();
        } catch (error) {
            console.error("Stock movement failed:", error);
            showStatus(`Stock movement was not saved: ${error.message}`, true);
        } finally {
            saving = false;
            $("saveMovement").disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        $("initialiseStock").addEventListener("click", () => openOpeningStock());
        $("openingStockForm").addEventListener("submit", saveOpeningStock);
        $("recordOpeningLaundry").addEventListener("click", openOpeningLaundry);
        $("openingLaundryForm").addEventListener("submit", saveOpeningLaundry);
        $("cancelOpeningLaundry").addEventListener("click", () => { $("openingLaundryPanel").hidden = true; });

        $("cancelOpeningStock").addEventListener("click", () => {
            $("openingStockPanel").hidden = true;
        });
        $("refreshStock").addEventListener("click", loadAll);
        $("movementForm").addEventListener("submit", saveMovement);
        $("movementFrom").addEventListener("change", updateAllowedDestinations);

        $("cancelMovement").addEventListener("click", () => {
            $("movementPanel").hidden = true;
            selectedItem = null;
        });

        $("stockBody").addEventListener("click", event => {
            const openingButton = event.target.closest("[data-opening-item]");
            if (openingButton) {
                openOpeningStock(openingButton.dataset.openingItem);
                return;
            }

            const movementButton = event.target.closest("[data-move]");
            if (movementButton) openMovement(movementButton.dataset.move);
        });

        loadAll();
    });
})();
