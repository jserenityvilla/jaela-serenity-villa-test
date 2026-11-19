(() => {
    "use strict";

    const db = firebase.firestore();
    const $ = id => document.getElementById(id);

    const collections = {
        bookings: "bookings",
        rooms: "housekeepingRooms",
        items: "housekeepingLinenItems",
        rules: "housekeepingPackRules",
        packs: "housekeepingGuestPacks",
        audit: "housekeepingAuditLogs"
    };

    const beds = [
        { id: "room1-single", room: "Room 1", type: "Single", pillows: 1 },
        { id: "room1-double", room: "Room 1", type: "Double", pillows: 2 },
        { id: "room2-double", room: "Room 2", type: "Double", pillows: 2 },
        { id: "room3-queen", room: "Room 3", type: "Queen", pillows: 2 },
        { id: "room4-queen", room: "Room 4", type: "Queen", pillows: 2 }
    ];

    let bookings = [];
    let rooms = [];
    let items = [];
    let rules = [];
    let selectedBooking = null;
    let saving = false;

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[c]);

    function localDateString() {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Colombo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const values = Object.fromEntries(
            parts.filter(p => p.type !== "literal").map(p => [p.type, p.value])
        );

        return `${values.year}-${values.month}-${values.day}`;
    }
    function isCheckInDateReached(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
        if (!match) return false;

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) return false;

        return String(value) <= localDateString();
    }

    function setStatus(id, message, error = false) {
        $(id).textContent = message;
        $(id).style.color = error ? "#a93226" : "#203030";
    }

    function showDate(value) {
        if (!value) return "Not specified";
        const parts = String(value).split("-");
        if (parts.length !== 3) return String(value);
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function nightsFor(booking) {
        const dateOnlyUtc = value => {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
            if (!match) return null;

            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const timestamp = Date.UTC(year, month - 1, day);
            const date = new Date(timestamp);

            if (
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day
            ) return null;

            return timestamp;
        };

        const start = dateOnlyUtc(booking.checkin);
        const end = dateOnlyUtc(booking.checkout);

        if (start !== null && end !== null && end > start) {
            return (end - start) / 86400000;
        }

        const stored = Number(booking.nights);
        return Number.isInteger(stored) && stored > 0 ? stored : 0;
    }
    function renderBookings() {
        const target = $("bookingList");

        if (!bookings.length) {
            target.textContent = "No upcoming confirmed bookings found.";
            return;
        }

        target.innerHTML = `<table class="prep-table">
            <thead><tr><th>Booking</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Guests</th><th>Action</th></tr></thead>
            <tbody>${bookings.map(b => `<tr>
                <td>${escapeHtml(b.bookingReference || b.id)}</td>
                <td>${escapeHtml(b.guestName)}</td>
                <td>${escapeHtml(showDate(b.checkin))}</td>
                <td>${escapeHtml(showDate(b.checkout))}</td>
                <td>${escapeHtml(b.totalGuests ?? "")}</td>
                <td><button class="prep-button prep-primary" data-prepare="${escapeHtml(b.id)}" type="button">Prepare pack</button></td>
            </tr>`).join("")}</tbody></table>`;
    }

    async function loadBookings() {
        setStatus("bookingStatus", "Loading confirmed bookings...");
        try {
            const snapshot = await db.collection(collections.bookings)
                .where("status", "==", "Confirmed").get();

            const today = localDateString();
            bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(String(b.checkin || "")) && b.checkin >= today)
                .sort((a,b) => String(a.checkin).localeCompare(String(b.checkin)));

            renderBookings();
            setStatus("bookingStatus", `${bookings.length} upcoming confirmed booking(s) loaded.`);
        } catch (error) {
            console.error("Housekeeping booking load failed:", error);
            setStatus("bookingStatus", `Unable to load bookings: ${error.message}`, true);
        }
    }

    async function loadConfiguration() {
        const [roomSnap, itemSnap, ruleSnap] = await Promise.all([
            db.collection(collections.rooms).get(),
            db.collection(collections.items).get(),
            db.collection(collections.rules).get()
        ]);

        rooms = roomSnap.docs.map(d => ({id:d.id,...d.data()})).filter(x => x.active !== false);
        items = itemSnap.docs.map(d => ({id:d.id,...d.data()})).filter(x => x.active !== false);
        rules = ruleSnap.docs.map(d => ({id:d.id,...d.data()})).filter(x => x.active !== false);
    }

    function selectedBeds() {
        return beds.filter(b => {
            const checkbox = document.querySelector(`[data-bed="${b.id}"]`);
            return checkbox && checkbox.checked;
        });
    }

    function applicableRule(nights) {
        return rules.find(r => Number(nights) >= Number(r.minNights) &&
            Number(nights) <= Number(r.maxNights));
    }

    function calculate() {
        if (!selectedBooking) return null;

        const chosen = selectedBeds();
        const nights = nightsFor(selectedBooking);
        const rule = applicableRule(nights);

        if (!nights || !rule) {
            setStatus("calculationStatus", "No applicable pack rule was found for this stay duration.", true);
            $("requirements").innerHTML = "";
            return null;
        }

        const bedCount = chosen.length;
        const pillowCount = chosen.reduce((sum, bed) => sum + bed.pillows, 0);
        const guestCount = Number(selectedBooking.totalGuests);
        const linenSets = Number(rule.linenSets);
        const towelSets = Number(rule.towelSets);
        const bathMats = Number(rule.bathMats);

        if (!Number.isInteger(guestCount) || guestCount < 1) {
            setStatus("calculationStatus", "The booking must have a valid guest count before preparation can be calculated.", true);
            $("requirements").innerHTML = "";
            return null;
        }

        if (
            !Number.isInteger(linenSets) || linenSets < 1 ||
            !Number.isInteger(towelSets) || towelSets < 1 ||
            !Number.isInteger(bathMats) || bathMats < 0
        ) {
            setStatus("calculationStatus", "The selected pack rule has invalid linen, towel or bath-mat quantities. Check Housekeeping Configuration.", true);
            $("requirements").innerHTML = "";
            return null;
        }

        const rows = [
            {
                name: "Top Sheet",
                quantity: bedCount * linenSets,
                basis: `${bedCount} selected bed(s) × ${linenSets} linen set(s)`
            },
            {
                name: "Fitted Sheet",
                quantity: bedCount * linenSets,
                basis: `${bedCount} selected bed(s) × ${linenSets} linen set(s)`
            },
            {
                name: "Pillowcase",
                quantity: pillowCount * linenSets,
                basis: `${pillowCount} pillow(s) × ${linenSets} linen set(s)`
            },
            {
                name: "Bath Towel",
                quantity: guestCount * towelSets,
                basis: `${guestCount} guest(s) × ${towelSets} towel set(s)`
            },
            {
                name: "Hand Towel",
                quantity: 2 * towelSets,
                basis: `2 bathrooms × ${towelSets} towel set(s)`
            },
            {
                name: "Bath Mat",
                quantity: bathMats,
                basis: rule.ruleName
            }
        ];

        $("requirements").innerHTML = rows.map(r => `<tr>
            <td>${escapeHtml(r.name)}</td><td>${r.quantity}</td><td>${escapeHtml(r.basis)}</td>
        </tr>`).join("");

        setStatus(
            "calculationStatus",
            `${bedCount} of 5 beds selected; ${pillowCount} pillows required as fixed bed assets; ${guestCount} guest(s); ${nights} night(s); ${linenSets} linen set(s); ${towelSets} towel set(s); ${rule.ruleName}. No stock deducted.`
        );

        return {
            beds: chosen.map(b => ({...b})),
            bedCount,
            pillowCount,
            nights,
            linenSets,
            towelSets,
            guestCount,
            packRuleId: rule.id,
            packRuleName: rule.ruleName,
            requirements: rows
        };
    }
    async function openPreparation(bookingId) {
        selectedBooking = bookings.find(b => b.id === bookingId);
        if (!selectedBooking) return;

        // Load the existing preparation draft for this booking.
        const packRef = db.collection(collections.packs).doc(bookingId);
        const packSnapshot = await packRef.get();
        const savedPack = packSnapshot.exists ? packSnapshot.data() : null;

        // Restore saved bed selections only while the pack remains an editable draft.
        const isEditableDraft =
            savedPack &&
            (savedPack.preparationStatus || "Draft") === "Draft" &&
            (savedPack.allocationStatus || "Not Allocated") === "Not Allocated";

        const hasSavedBedSelection =
            isEditableDraft && Array.isArray(savedPack.selectedBeds);

        const savedBedIds = new Set(
            hasSavedBedSelection
                ? savedPack.selectedBeds.map(b => b.id)
                : []
        );

        $("editor").hidden = false;
        $("guestHeading").textContent = `Prepare pack — ${selectedBooking.bookingReference || selectedBooking.id}`;
        $("bookingDetails").innerHTML = [
            ["Guest", selectedBooking.guestName],
            ["Check-in", showDate(selectedBooking.checkin)],
            ["Check-out", showDate(selectedBooking.checkout)],
            ["Guests", selectedBooking.totalGuests ?? ""],
            ["Nights", nightsFor(selectedBooking)],
            ["Arrival time", selectedBooking.arrivalTime || "Not specified"]
        ].map(([label,value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join("");

        $("bedOptions").innerHTML = beds.map(b => {
            const checked = hasSavedBedSelection
                ? savedBedIds.has(b.id)
                : true;

            return `<label class="bed-option">
                <input type="checkbox" data-bed="${b.id}" ${checked ? "checked" : ""}>
                <strong>${escapeHtml(b.room)} — ${escapeHtml(b.type)} bed</strong>
                <span>(${b.pillows} pillow${b.pillows === 1 ? "" : "s"})</span>
            </label>`;
        }).join("");

        $("bedOptions").querySelectorAll("input").forEach(input =>
            input.addEventListener("change", calculate));

        $("saveStatus").textContent = "";
        await refreshCheckInButton();
        calculate();
        $("editor").scrollIntoView({behavior:"smooth",block:"start"});
    }
    async function saveDraft() {
        if (saving || !selectedBooking) return;

        const calculation = calculate();
        if (!calculation) return;

        if (!calculation.bedCount) {
            setStatus("saveStatus", "Select at least one bed before saving.", true);
            return;
        }

        saving = true;
        $("saveDraft").disabled = true;
        setStatus("saveStatus", "Saving preparation draft...");

        try {
            const bookingRef = db.collection(collections.bookings).doc(selectedBooking.id);
            const bookingSnapshot = await bookingRef.get();

            if (!bookingSnapshot.exists) {
                throw new Error("The booking no longer exists. Refresh the booking list.");
            }

            const freshBooking = bookingSnapshot.data();

            if (
                freshBooking.status !== "Confirmed" ||
                freshBooking.checkin !== selectedBooking.checkin ||
                freshBooking.checkout !== selectedBooking.checkout
            ) {
                throw new Error("The booking status or dates have changed. Refresh the booking list before saving.");
            }

            const ref = db.collection(collections.packs).doc(selectedBooking.id);
            const existing = await ref.get();
            const existingData = existing.exists ? existing.data() : {};

            if (
                existing.exists &&
                existingData.allocationStatus &&
                existingData.allocationStatus !== "Not Allocated"
            ) {
                throw new Error("This preparation has progressed beyond the draft stage. It cannot be overwritten here.");
            }

            const user = firebase.auth().currentUser;
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();

            const data = {
                bookingId: selectedBooking.id,
                bookingReference: freshBooking.bookingReference || "",
                guestName: freshBooking.guestName || "",
                checkin: freshBooking.checkin,
                checkout: freshBooking.checkout,
                bookingStatus: freshBooking.status,
                selectedBeds: calculation.beds,
                bedCount: calculation.bedCount,
                pillowCount: calculation.pillowCount,
                nights: calculation.nights,
                linenSets: calculation.linenSets,
                towelSets: calculation.towelSets,
                guestCount: calculation.guestCount,
                packRuleId: calculation.packRuleId,
                packRuleName: calculation.packRuleName,
                requirements: calculation.requirements,
                preparationStatus: existingData.preparationStatus || "Draft",
                allocationStatus: existingData.allocationStatus || "Not Allocated",
                updatedAt: timestamp,
                updatedBy: user?.email || ""
            };

            if (!existing.exists) {
                data.createdAt = timestamp;
                data.createdBy = user?.email || "";
            }

            const batch = db.batch();
            batch.set(ref, data, {merge:true});

            const auditRef = db.collection(collections.audit).doc();
            batch.set(auditRef, {
                entityType: "guestPack",
                entityId: selectedBooking.id,
                action: existing.exists ? "guest_pack_draft_updated" : "guest_pack_draft_created",
                summary: `${existing.exists ? "Updated" : "Created"} guest pack draft for ${freshBooking.bookingReference || selectedBooking.id}`,
                actorUid: user?.uid || "",
                actorEmail: user?.email || "",
                createdAt: timestamp
            });

            await batch.commit();
            setStatus("saveStatus", "Preparation draft saved with individual linen and towel quantities. No stock has been allocated or deducted.");
            await loadDrafts();
        } catch (error) {
            console.error("Guest pack draft save failed:", error);
            setStatus("saveStatus", `Unable to save draft: ${error.message}`, true);
        } finally {
            saving = false;
            $("saveDraft").disabled = false;
        }
    }
    async function allocateStock() {
        if (saving || !selectedBooking) return;

        const packRef = db.collection(collections.packs).doc(selectedBooking.id);
        const user = firebase.auth().currentUser;

        saving = true;

        const allocationButton = $("allocateStock");
        allocationButton.disabled = true;
        $("saveDraft").disabled = true;

        setStatus("saveStatus", "Checking all required stock before allocation...");

        try {
            const packSnapshot = await packRef.get();

            if (!packSnapshot.exists) {
                throw new Error("Save the preparation draft before allocating stock.");
            }

            const pack = packSnapshot.data();

            if (pack.allocationStatus !== "Not Allocated") {
                throw new Error(
                    `This pack cannot be allocated. Current status: ${pack.allocationStatus || "Unknown"}.`
                );
            }

            if (!Array.isArray(pack.requirements) || !pack.requirements.length) {
                throw new Error("The saved preparation has no stock requirements.");
            }

            const itemByName = new Map(
                items.map(item => [
                    String(item.itemName || "").trim().toLowerCase(),
                    item
                ])
            );

            const requirements = pack.requirements.map(requirement => {
                const itemName = String(requirement.name || "").trim();
                const quantity = Number(requirement.quantity);
                const item = itemByName.get(itemName.toLowerCase());

                if (!itemName || !Number.isInteger(quantity) || quantity <= 0) {
                    throw new Error(`Invalid stock requirement: ${itemName || "Unknown item"}.`);
                }

                if (!item || !item.id) {
                    throw new Error(`No active configured stock item matches "${itemName}".`);
                }

                return {
                    itemId: item.id,
                    itemName: item.itemName,
                    quantity
                };
            });

            const uniqueItemIds = new Set(requirements.map(item => item.itemId));

            if (uniqueItemIds.size !== requirements.length) {
                throw new Error("Duplicate stock items were found in the preparation requirements.");
            }

            const balanceRefs = requirements.map(item =>
                db.collection("housekeepingStockBalances").doc(item.itemId)
            );

            // Create stable references outside the transaction callback.
            // Firestore may retry the callback if another operation changes stock.
            const movementRefs = requirements.map(() =>
                db.collection("housekeepingStockMovements").doc()
            );

            const auditRef = db.collection(collections.audit).doc();
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const expectedSnapshot = await db.collection("housekeepingExpectedLaundryReturns")
                .where("bookingId", "==", selectedBooking.id).get();
            const expectedRecords = expectedSnapshot.docs.map(doc => ({id:doc.id, ...doc.data()}));
            const expectedRefs = expectedRecords.map(record => db.collection("housekeepingExpectedLaundryReturns").doc(record.id));

            await db.runTransaction(async transaction => {
                // Read the pack and every balance before performing any writes.
                const freshPackSnapshot = await transaction.get(packRef);

                if (!freshPackSnapshot.exists) {
                    throw new Error("The preparation pack no longer exists.");
                }

                const freshPack = freshPackSnapshot.data();

                if (freshPack.allocationStatus !== "Not Allocated") {
                    throw new Error(
                        `Allocation stopped. Pack status is now ${freshPack.allocationStatus || "Unknown"}.`
                    );
                }

                const balanceSnapshots = await Promise.all(
                    balanceRefs.map(ref => transaction.get(ref))
                );

                const expectedSnapshots = [];
                for (const ref of expectedRefs) expectedSnapshots.push(await transaction.get(ref));
                const shortages = [];
                const shortfallRows = [];

                const movements = balanceSnapshots.map((snapshot, index) => {
                    const requirement = requirements[index];

                    if (!snapshot.exists) {
                        shortages.push(`${requirement.itemName}: stock balance is not initialised.`);
                        return null;
                    }

                    const balance = snapshot.data();
                    const available = Number(balance.available ?? 0);
                    const allocated = Number(balance.allocated ?? 0);

                    if (
                        !Number.isInteger(available) ||
                        available < 0 ||
                        !Number.isInteger(allocated) ||
                        allocated < 0
                    ) {
                        throw new Error(
                            `Invalid stock balance for ${requirement.itemName}. No allocation was made.`
                        );
                    }

                    if (available < requirement.quantity) {
                        const shortfall = requirement.quantity - available;
                        shortages.push(`${requirement.itemName}: requires ${requirement.quantity}, available ${available}, short ${shortfall}.`);
                        shortfallRows.push({itemId:requirement.itemId,itemName:requirement.itemName,quantity:shortfall});
                    }

                    return {
                        balance,
                        available,
                        allocated,
                        requirement
                    };
                });

                if (shortages.length) {
                    const reservations = [];
                    for (const shortfall of shortfallRows) {
                        let remaining = shortfall.quantity;
                        for (let i = 0; i < expectedSnapshots.length && remaining > 0; i++) {
                            const snap = expectedSnapshots[i];
                            if (!snap.exists) continue;
                            const record = snap.data();
                            if (record.itemId !== shortfall.itemId || !["Pending", "Partially Received"].includes(record.status)) continue;
                            const unreceived = Number(record.quantityExpected || 0) - Number(record.quantityReceivedClean || 0) - Number(record.quantityReceivedDamaged || 0);
                            const unreserved = Math.max(0, unreceived - Number(record.quantityReserved || 0));
                            const reserve = Math.min(remaining, unreserved);
                            if (reserve > 0) { reservations.push({index:i,recordId:record.id || expectedRecords[i].id,quantity:reserve}); remaining -= reserve; }
                        }
                        if (remaining > 0) throw new Error("Insufficient stock and no matching unreserved expected laundry return covers the shortage:\n- " + shortages.join("\n- "));
                    }
                    const now = firebase.firestore.FieldValue.serverTimestamp();
                    reservations.forEach(reservation => {
                        const snap = expectedSnapshots[reservation.index];
                        transaction.update(expectedRefs[reservation.index], {quantityReserved:Number(snap.data().quantityReserved || 0)+reservation.quantity, updatedAt:now});
                    });
                    transaction.update(packRef, {
                        allocationStatus:"Pending Laundry Return",
                        pendingAllocationRequirements:requirements,
                        pendingLaundryReservations:reservations.map(r=>({expectedReturnId:expectedRecords[r.index].id,itemId:expectedRecords[r.index].itemId,itemName:expectedRecords[r.index].itemName,quantity:r.quantity})),
                        conditionalAllocationCreatedAt:now,
                        conditionalAllocationCreatedBy:user?.email || ""
                    });
                    transaction.set(auditRef, {
                        entityType:"guestPack", entityId:selectedBooking.id,
                        action:"guest_pack_conditional_allocation_created",
                        summary:`Conditional allocation pending expected laundry return for ${freshPack.bookingReference || selectedBooking.id}`,
                        actorUid:user?.uid || "", actorEmail:user?.email || "", createdAt:now
                    });
                    return;
                }

                // All physical stock checks passed. Apply the complete allocation atomically.
                movements.forEach((movement, index) => {
                    const { balance, available, allocated, requirement } = movement;

                    transaction.update(balanceRefs[index], {
                        available: available - requirement.quantity,
                        allocated: allocated + requirement.quantity,
                        updatedAt: timestamp
                    });

                    transaction.set(movementRefs[index], {
                        itemId: requirement.itemId,
                        itemName: requirement.itemName,
                        quantity: requirement.quantity,
                        fromStatus: "available",
                        toStatus: "allocated",
                        note: `Guest pack allocation for ${freshPack.bookingReference || selectedBooking.id}`,
                        bookingId: selectedBooking.id,
                        bookingReference: freshPack.bookingReference || "",
                        actorUid: user?.uid || "",
                        actorEmail: user?.email || "",
                        createdAt: timestamp
                    });
                });

                const allocatedByItem = Object.fromEntries(
                    requirements.map(requirement => [requirement.itemId, requirement.quantity])
                );

                transaction.update(packRef, {
                    allocationStatus: "Allocated",
                    allocatedByItem,
                    allocatedAt: timestamp,
                    allocatedBy: user?.email || ""
                });

                transaction.set(auditRef, {
                    entityType: "guestPack",
                    entityId: selectedBooking.id,
                    action: "guest_pack_stock_allocated",
                    summary: `Allocated stock for ${freshPack.bookingReference || selectedBooking.id}`,
                    actorUid: user?.uid || "",
                    actorEmail: user?.email || "",
                    createdAt: timestamp
                });
            });

            const latestPack = await packRef.get();
            if (latestPack.exists && latestPack.data().allocationStatus === "Pending Laundry Return") {
                setStatus("saveStatus", "Conditional allocation recorded. The expected laundry quantity is reserved for this booking but is NOT available stock. Confirm physical receipt in Laundry Management; clean items will then be allocated automatically.");
            } else {
                setStatus("saveStatus", "Stock allocation completed successfully.");
            }
            await loadDrafts();

        } catch (error) {
            console.error("Guest pack stock allocation failed:", error);
            setStatus("saveStatus", `Stock was not allocated: ${error.message}`, true);
        } finally {
            saving = false;
            allocationButton.disabled = false;
            await refreshCheckInButton();
            $("saveDraft").disabled = false;
        }
    }
    async function refreshCheckInButton() {
        const button = $("markGuestInUse");
        if (!button || !selectedBooking) return;

        button.disabled = true;
        button.title = "A successfully allocated pack is required.";

        if (!isCheckInDateReached(selectedBooking.checkin)) {
            button.title = "Check-in is only allowed on or after the booking date (Sri Lanka time).";
            return;
        }

        try {
            const snapshot = await db.collection(collections.packs)
                .doc(selectedBooking.id).get();

            const isAllocated = snapshot.exists &&
                snapshot.data().allocationStatus === "Allocated";

            button.disabled = !isAllocated;
            button.title = isAllocated
                ? "Confirm room readiness and guest check-in."
                : "A successfully allocated pack is required.";
        } catch (error) {
            button.disabled = true;
            console.error("Unable to check pack status:", error);
        }
    }

    async function markGuestInUse() {
        if (saving || !selectedBooking) return;

        if (!isCheckInDateReached(selectedBooking.checkin)) {
            setStatus(
                "saveStatus",
                "Guest check-in is not allowed before the booking check-in date (Sri Lanka time).",
                true
            );
            await refreshCheckInButton();
            return;
        }

        const confirmed = window.confirm(
            "Please confirm that the room is ready and the guest has checked in.\n\n" +
            "This will move all allocated guest-pack stock into In Use."
        );

        if (!confirmed) return;

        const packRef = db.collection(collections.packs).doc(selectedBooking.id);
        const user = firebase.auth().currentUser;
        const button = $("markGuestInUse");

        saving = true;
        button.disabled = true;
        $("saveDraft").disabled = true;
        $("allocateStock").disabled = true;

        setStatus("saveStatus", "Verifying allocated stock before guest check-in...");

        try {
            const packSnapshot = await packRef.get();

            if (!packSnapshot.exists) {
                throw new Error("The preparation pack does not exist.");
            }

            const pack = packSnapshot.data();

            if (pack.allocationStatus !== "Allocated") {
                throw new Error(
                    `Guest check-in cannot proceed. Pack status: ${pack.allocationStatus || "Unknown"}.`
                );
            }

            if (!Array.isArray(pack.requirements) || !pack.requirements.length) {
                throw new Error("The saved pack has no stock requirements.");
            }

            const itemByName = new Map(
                items.map(item => [
                    String(item.itemName || "").trim().toLowerCase(),
                    item
                ])
            );

            const requirements = pack.requirements.map(requirement => {
                const itemName = String(requirement.name || "").trim();
                const quantity = Number(requirement.quantity);
                const item = itemByName.get(itemName.toLowerCase());

                if (!item || !item.id ||
                    !Number.isInteger(quantity) || quantity <= 0) {
                    throw new Error(`Invalid or unconfigured requirement: ${itemName}.`);
                }

                return {
                    itemId: item.id,
                    itemName: item.itemName,
                    quantity
                };
            });

            if (new Set(requirements.map(item => item.itemId)).size !== requirements.length) {
                throw new Error("Duplicate stock items found in the preparation pack.");
            }

            const balanceRefs = requirements.map(item =>
                db.collection("housekeepingStockBalances").doc(item.itemId)
            );

            const movementRefs = requirements.map(() =>
                db.collection("housekeepingStockMovements").doc()
            );

            const auditRef = db.collection(collections.audit).doc();
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();

            await db.runTransaction(async transaction => {
                const freshPackSnapshot = await transaction.get(packRef);

                if (!freshPackSnapshot.exists) {
                    throw new Error("The preparation pack no longer exists.");
                }

                const freshPack = freshPackSnapshot.data();

                const bookingRef = db.collection(collections.bookings)
                    .doc(selectedBooking.id);
                const freshBookingSnapshot = await transaction.get(bookingRef);

                if (!freshBookingSnapshot.exists) {
                    throw new Error("The booking no longer exists. No stock was moved.");
                }

                const freshBooking = freshBookingSnapshot.data();

                if (!isCheckInDateReached(freshBooking.checkin)) {
                    throw new Error(
                        "Check-in is not allowed before the booking date (Sri Lanka time). No stock was moved."
                    );
                }

                if (freshPack.allocationStatus !== "Allocated") {
                    throw new Error(
                        `Check-in stopped. Current pack status: ${freshPack.allocationStatus || "Unknown"}.`
                    );
                }

                const allocatedByItem = freshPack.allocatedByItem || {};
                requirements.forEach(requirement => {
                    if (Number(allocatedByItem[requirement.itemId]) !== requirement.quantity) {
                        throw new Error(
                            `Booking-level allocated quantity is missing or incorrect for ${requirement.itemName}. Re-allocate this pack before check-in.`
                        );
                    }
                });

                const balanceSnapshots = await Promise.all(
                    balanceRefs.map(ref => transaction.get(ref))
                );

                const shortages = [];

                const balancesToMove = balanceSnapshots.map((snapshot, index) => {
                    const requirement = requirements[index];

                    if (!snapshot.exists) {
                        shortages.push(`${requirement.itemName}: stock balance missing.`);
                        return null;
                    }

                    const balance = snapshot.data();
                    const allocated = Number(balance.allocated ?? 0);
                    const inUse = Number(balance.inUse ?? 0);

                    if (!Number.isInteger(allocated) || allocated < 0 ||
                        !Number.isInteger(inUse) || inUse < 0) {
                        throw new Error(`Invalid stock balance for ${requirement.itemName}.`);
                    }

                    if (allocated < requirement.quantity) {
                        shortages.push(
                            `${requirement.itemName}: requires ${requirement.quantity} allocated, available ${allocated}.`
                        );
                    }

                    return { allocated, inUse, requirement };
                });

                if (shortages.length) {
                    throw new Error(
                        "Insufficient allocated stock. No items moved:\n- " +
                        shortages.join("\n- ")
                    );
                }

                balancesToMove.forEach((entry, index) => {
                    const { allocated, inUse, requirement } = entry;

                    transaction.update(balanceRefs[index], {
                        allocated: allocated - requirement.quantity,
                        inUse: inUse + requirement.quantity,
                        updatedAt: timestamp
                    });

                    transaction.set(movementRefs[index], {
                        itemId: requirement.itemId,
                        itemName: requirement.itemName,
                        quantity: requirement.quantity,
                        fromStatus: "allocated",
                        toStatus: "inUse",
                        note: `Guest check-in — ${freshPack.bookingReference || selectedBooking.id}`,
                        bookingId: selectedBooking.id,
                        guestPackId: selectedBooking.id,
                        bookingReference: freshPack.bookingReference || "",
                        actorUid: user?.uid || "",
                        actorEmail: user?.email || "",
                        createdAt: timestamp
                    });
                });

                const inUseByItem = Object.fromEntries(
                    requirements.map(requirement => [requirement.itemId, requirement.quantity])
                );
                const clearedAllocatedByItem = Object.fromEntries(
                    requirements.map(requirement => [requirement.itemId, 0])
                );

                transaction.update(packRef, {
                    allocationStatus: "In Use",
                    preparationStatus: "In Use",
                    allocatedByItem: clearedAllocatedByItem,
                    inUseByItem,
                    inLaundryByItem: {},
                    laundryDispatched: {},
                    checkedInAt: timestamp,
                    checkedInBy: user?.email || ""
                });

                transaction.set(auditRef, {
                    entityType: "guestPack",
                    entityId: selectedBooking.id,
                    action: "guest_pack_checked_in",
                    summary: `Guest checked in; allocated stock moved to In Use for ${freshPack.bookingReference || selectedBooking.id}`,
                    actorUid: user?.uid || "",
                    actorEmail: user?.email || "",
                    createdAt: timestamp
                });
            });

            setStatus("saveStatus", "Guest check-in recorded. Stock moved from Allocated to In Use.");
            await loadDrafts();

        } catch (error) {
            console.error("Guest check-in failed:", error);
            setStatus("saveStatus", `Guest check-in was not recorded: ${error.message}`, true);
        } finally {
            saving = false;
            $("saveDraft").disabled = false;
            $("allocateStock").disabled = false;
            await refreshCheckInButton();
        }
    }
    async function loadDrafts() {
        try {
            const snapshot = await db.collection(collections.packs).get();
            const drafts = snapshot.docs.map(d => ({id:d.id,...d.data()}))
                .sort((a,b) => String(a.checkin || "").localeCompare(String(b.checkin || "")));

            $("draftList").innerHTML = drafts.length
                ? `<table class="prep-table"><thead><tr><th>Booking</th><th>Guest</th><th>Check-in</th><th>Beds</th><th>Status</th><th>Allocation</th></tr></thead><tbody>
                    ${drafts.map(d => `<tr><td>${escapeHtml(d.bookingReference || d.bookingId)}</td>
                    <td>${escapeHtml(d.guestName)}</td><td>${escapeHtml(showDate(d.checkin))}</td>
                    <td>${Number(d.bedCount || 0)}</td><td>${escapeHtml(d.preparationStatus)}</td>
                    <td>${escapeHtml(d.allocationStatus)}</td></tr>`).join("")}
                    </tbody></table>`
                : "No preparation drafts have been saved.";
        } catch (error) {
            $("draftList").textContent = `Unable to load drafts: ${error.message}`;
        }
    }

    $("bookingList").addEventListener("click", event => {
        const button = event.target.closest("[data-prepare]");
        if (button) openPreparation(button.dataset.prepare);
    });

    $("refreshBookings").addEventListener("click", loadBookings);
    $("saveDraft").addEventListener("click", saveDraft);
    const allocationButton = document.createElement("button");
    allocationButton.type = "button";
    allocationButton.id = "allocateStock";
    allocationButton.textContent = "Allocate Stock";
    allocationButton.className = $("saveDraft").className;
    allocationButton.style.marginLeft = "8px";
    $("saveDraft").insertAdjacentElement("afterend", allocationButton);
    allocationButton.addEventListener("click", allocateStock);
    const checkInButton = document.createElement("button");
    checkInButton.type = "button";
    checkInButton.id = "markGuestInUse";
    checkInButton.textContent = "Confirm Guest Check-in";
    checkInButton.className = $("saveDraft").className;
    checkInButton.style.marginLeft = "8px";
    checkInButton.disabled = true;
    allocationButton.insertAdjacentElement("afterend", checkInButton);
    checkInButton.addEventListener("click", markGuestInUse);
    $("closeEditor").addEventListener("click", () => {
        $("editor").hidden = true;
        selectedBooking = null;
    });

    async function initialise() {
        try {
            await loadConfiguration();
            await Promise.all([loadBookings(), loadDrafts()]);
        } catch (error) {
            console.error("Housekeeping preparation initialisation failed:", error);
            setStatus("bookingStatus", `Unable to initialise: ${error.message}`, true);
        }
    }

    initialise();
})();
