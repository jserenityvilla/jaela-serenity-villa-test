(function () {
    "use strict";

    const ITEMS = "housekeepingLinenItems";
    const BALANCES = "housekeepingStockBalances";
    const MOVEMENTS = "housekeepingStockMovements";
    const PURCHASES = "housekeepingPurchases";

    const $ = id => document.getElementById(id);

    let db;
    let storage;
    let configuredItems = [];
    let saving = false;

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function status(message, isError = false) {
        $("purchaseStatus").textContent = message;
        $("purchaseStatus").style.background = isError ? "#fdecec" : "#f2f6f6";
    }

    function currency() {
        return $("currency").value;
    }

    function formatMoney(value) {
        return Number(value || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function addLine() {
        const row = document.createElement("tr");

        const options = configuredItems.map(item =>
            `<option value="${escapeHtml(item.id)}">${escapeHtml(item.itemName)} — ${escapeHtml(item.size || "")}</option>`
        ).join("");

        row.innerHTML = `
            <td>
                <select class="line-item line-input" required>
                    <option value="">Select item</option>
                    ${options}
                </select>
            </td>
            <td>
                <input class="line-quantity line-input" type="number"
                    min="1" step="1" value="1" required>
            </td>
            <td>
                <input class="line-cost line-input" type="number"
                    min="0" step="0.01" value="0" required>
            </td>
            <td class="line-total">0.00</td>
            <td><button type="button" class="remove-line">Remove</button></td>
        `;

        $("purchaseLines").appendChild(row);

        row.querySelectorAll("input,select").forEach(input => {
            input.addEventListener("input", updateTotal);
            input.addEventListener("change", updateTotal);
        });

        row.querySelector(".remove-line").addEventListener("click", () => {
            row.remove();
            updateTotal();
        });

        updateTotal();
    }

    function collectLines() {
        const rows = [...$("purchaseLines").querySelectorAll("tr")];

        if (!rows.length) {
            throw new Error("Add at least one purchased item.");
        }

        const lines = rows.map(row => {
            const itemId = row.querySelector(".line-item").value;
            const quantity = Number(row.querySelector(".line-quantity").value);
            const unitCost = Number(row.querySelector(".line-cost").value);

            const item = configuredItems.find(candidate => candidate.id === itemId);

            if (!item) throw new Error("Select a valid configured stock item.");
            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error("Item quantities must be positive whole numbers.");
            }
            if (!Number.isFinite(unitCost) || unitCost < 0) {
                throw new Error("Unit costs must be zero or greater.");
            }

            return {
                itemId,
                itemName: item.itemName || "",
                category: item.category || "",
                size: item.size || "",
                quantity,
                unitCost,
                lineTotal: Number((quantity * unitCost).toFixed(2))
            };
        });

        const ids = lines.map(line => line.itemId);
        if (new Set(ids).size !== ids.length) {
            throw new Error("Each item should appear only once. Combine duplicate item quantities into one line.");
        }

        return lines;
    }

    function updateTotal() {
        let total = 0;

        $("purchaseLines").querySelectorAll("tr").forEach(row => {
            const quantity = Number(row.querySelector(".line-quantity").value || 0);
            const cost = Number(row.querySelector(".line-cost").value || 0);
            const lineTotal = quantity * cost;

            row.querySelector(".line-total").textContent = formatMoney(lineTotal);
            total += Number.isFinite(lineTotal) ? lineTotal : 0;
        });

        $("purchaseTotal").textContent = formatMoney(total);
        $("totalCurrency").textContent = currency();
    }

    function validateReceipt(file) {
        if (!file) throw new Error("Attach the purchase receipt.");

        if (file.size <= 0 || file.size >= 10 * 1024 * 1024) {
            throw new Error("Receipt must be greater than zero and smaller than 10 MB.");
        }

        const allowed = {
            "application/pdf": ["pdf"],
            "image/jpeg": ["jpg", "jpeg"],
            "image/png": ["png"]
        };

        const extension = file.name.split(".").pop().toLowerCase();
        const validExtensions = allowed[file.type] || [];

        if (!validExtensions.includes(extension)) {
            throw new Error("Only PDF, JPG, JPEG and PNG receipts are accepted.");
        }
    }

    function localDate(value) {
        return value || "";
    }

    async function loadItems() {
        const snapshot = await db.collection(ITEMS)
            .where("active", "==", true)
            .get();

        configuredItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (!configuredItems.length) {
            throw new Error("No active configured linen or towel items were found.");
        }

        addLine();
    }

    async function loadHistory() {
        const snapshot = await db.collection(PURCHASES)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();

        if (snapshot.empty) {
            $("purchaseHistory").innerHTML =
                '<tr><td colspan="6">No purchases have been recorded.</td></tr>';
            return;
        }

        $("purchaseHistory").innerHTML = snapshot.docs.map(doc => {
            const purchase = doc.data();
            const date = purchase.purchaseDate || "";
            const itemCount = Array.isArray(purchase.lines) ? purchase.lines.length : 0;
            const receiptUrl = purchase.receiptUrl || "";

            return `
                <tr>
                    <td>${escapeHtml(date)}</td>
                    <td>${escapeHtml(purchase.supplier)}</td>
                    <td>${escapeHtml(purchase.invoiceNumber || "—")}</td>
                    <td>${itemCount}</td>
                    <td>${escapeHtml(purchase.currency)} ${formatMoney(purchase.totalCost)}</td>
                    <td>${receiptUrl
                        ? `<a href="${escapeHtml(receiptUrl)}" target="_blank" rel="noopener">View receipt</a>`
                        : "—"}</td>
                </tr>`;
        }).join("");
    }

    async function savePurchase(event) {
        event.preventDefault();

        if (saving) return;

        const button = $("savePurchase");

        let receiptRef = null;
        let uploaded = false;

        try {
            const user = firebase.auth().currentUser;

            if (!user) throw new Error("Administrator session is not available.");

            const supplier = $("supplier").value.trim();
            const purchaseDate = localDate($("purchaseDate").value);
            const invoiceNumber = $("invoiceNumber").value.trim();
            const selectedCurrency = currency();
            const file = $("receiptFile").files[0];

            if (!supplier) throw new Error("Enter the supplier name.");
            if (!purchaseDate) throw new Error("Select the purchase date.");

            validateReceipt(file);

            const lines = collectLines();
            const totalCost = Number(
                lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2)
            );

            const purchaseRef = db.collection(PURCHASES).doc();
            const purchaseId = purchaseRef.id;

            receiptRef = storage.ref(
                `housekeeping/receipts/${purchaseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
            );

            saving = true;
            button.disabled = true;
            status("Uploading receipt...");

            await receiptRef.put(file, {
                contentType: file.type,
                customMetadata: {
                    purchaseId,
                    supplier
                }
            });

            uploaded = true;

            const receiptUrl = await receiptRef.getDownloadURL();

            status("Recording purchase and updating stock...");

            const balanceRefs = lines.map(line => ({
                line,
                ref: db.collection(BALANCES).doc(line.itemId)
            }));

            const movementRefs = lines.map(() =>
                db.collection(MOVEMENTS).doc()
            );

            await db.runTransaction(async transaction => {
                const existingPurchase = await transaction.get(purchaseRef);

                if (existingPurchase.exists) {
                    throw new Error("This purchase has already been recorded.");
                }

                // All reads must happen before transaction writes.
                const balanceSnapshots = [];

                for (const entry of balanceRefs) {
                    balanceSnapshots.push(
                        await transaction.get(entry.ref)
                    );
                }

                const now = firebase.firestore.FieldValue.serverTimestamp();

                transaction.set(purchaseRef, {
                    purchaseId,
                    supplier,
                    purchaseDate,
                    invoiceNumber,
                    currency: selectedCurrency,
                    lines,
                    totalCost,
                    receiptPath: receiptRef.fullPath,
                    receiptUrl,
                    receiptFileName: file.name,
                    receiptContentType: file.type,
                    receiptSize: file.size,
                    status: "received",
                    actorUid: user.uid,
                    actorEmail: user.email || "",
                    createdAt: now,
                    updatedAt: now
                });

                for (let index = 0; index < lines.length; index++) {
                    const line = lines[index];
                    const balanceRef = balanceRefs[index].ref;
                    const balanceSnapshot = balanceSnapshots[index];
                    const movementRef = movementRefs[index];

                    if (balanceSnapshot.exists) {
                        const current = balanceSnapshot.data();

                        transaction.update(balanceRef, {
                            available: Number(current.available || 0) + line.quantity,
                            updatedAt: now
                        });
                    } else {
                        transaction.set(balanceRef, {
                            itemId: line.itemId,
                            itemName: line.itemName,
                            category: line.category,
                            size: line.size,
                            available: line.quantity,
                            allocated: 0,
                            inUse: 0,
                            inLaundry: 0,
                            damaged: 0,
                            openingQuantity: 0,
                            initialisedFromConfiguration: false,
                            openingQuantityVerified: false,
                            createdFromPurchaseId: purchaseId,
                            createdAt: now,
                            updatedAt: now
                        });
                    }

                    transaction.set(movementRef, {
                        itemId: line.itemId,
                        itemName: line.itemName,
                        quantity: line.quantity,
                        fromStatus: "purchase",
                        toStatus: "available",
                        note: `Purchase ${purchaseId}${invoiceNumber ? ` | Invoice ${invoiceNumber}` : ""}`,
                        purchaseId,
                        supplier,
                        actorUid: user.uid,
                        actorEmail: user.email || "",
                        createdAt: now
                    });
                }
            });

            status("Purchase recorded successfully. Available stock has been updated.");

            $("purchaseForm").reset();
            $("purchaseLines").innerHTML = "";
            addLine();
            updateTotal();

            await loadHistory();

        } catch (error) {
            console.error("Purchase receiving failed:", error);

            if (uploaded && receiptRef) {
                try {
                    await receiptRef.delete();
                } catch (cleanupError) {
                    console.error("Receipt cleanup failed:", cleanupError);
                    status(
                        `Purchase was not confirmed. Receipt cleanup also failed; check Storage for the uploaded file. Error: ${error.message}`,
                        true
                    );
                    return;
                }
            }

            status(`Purchase was not saved: ${error.message}`, true);

        } finally {
            saving = false;
            button.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        try {
            if (!firebase.apps.length) {
                throw new Error("Firebase has not been initialised.");
            }

            db = firebase.firestore();
            storage = firebase.storage();

            $("purchaseDate").value =
                new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Colombo"
                });

            $("addLine").addEventListener("click", addLine);
            $("purchaseForm").addEventListener("submit", savePurchase);
            $("currency").addEventListener("change", updateTotal);

            $("resetPurchase").addEventListener("click", () => {
                setTimeout(() => {
                    $("purchaseLines").innerHTML = "";
                    addLine();
                    updateTotal();
                }, 0);
            });

            await loadItems();
            await loadHistory();

            status(`${configuredItems.length} active stock item(s) loaded. Ready to receive purchases.`);

        } catch (error) {
            console.error("Purchase module initialisation failed:", error);
            status(`Unable to initialise Purchase & Receiving: ${error.message}`, true);
        }
    });
})();
