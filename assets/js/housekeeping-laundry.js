(() => {
    "use strict";

    const db = firebase.firestore();
    const $ = id => document.getElementById(id);

    const ITEMS = "housekeepingLinenItems";
    const BALANCES = "housekeepingStockBalances";
    const MOVEMENTS = "housekeepingStockMovements";
    const DISPATCHES = "housekeepingLaundryDispatches";
    const RETURNS = "housekeepingLaundryReturns";
    const EXPECTED_RETURNS = "housekeepingExpectedLaundryReturns";

    let user = null;
    let items = [];
    let balances = {};
    let dispatches = [];
    let returns = [];
    let expectedReturns = [];
    let guestPacks = [];
    let saving = false;

    const number = value => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };

    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;",
        '"':"&quot;", "'":"&#39;"
    }[c]));

    const dateText = value => {
        if (!value) return "";
        const date = value.toDate ? value.toDate() : new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
    };

    const localDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    };

    function status(message, error = false) {
        $("laundryStatus").textContent = message;
        $("laundryStatus").style.background = error ? "#fde8e8" : "#f2f6f6";
    }

    function balanceFor(id) {
        return balances[id] || null;
    }

    function renderDispatchLines() {
        const packId = $("dispatchGuestPack").value;
        const pack = guestPacks.find(p => p.id === packId);

        if (!pack) {
            $("dispatchLines").innerHTML =
                '<tr><td colspan="3">Select a guest pack currently In Use.</td></tr>';
            return;
        }

        const requirements = Array.isArray(pack.requirements) ? pack.requirements : [];
        const dispatched = pack.laundryDispatched || {};

        const rows = requirements.map(requirement => {
            const item = items.find(i =>
                String(i.itemName || "").trim().toLowerCase() ===
                String(requirement.name || "").trim().toLowerCase()
            );

            if (!item) {
                return `<tr><td>${esc(requirement.name)}</td>
                    <td>Item not configured</td><td>0</td></tr>`;
            }

            const inUseByItem = pack.inUseByItem || {};
            const inUse = number(inUseByItem[item.id]);
            const required = number(requirement.quantity);
            const alreadyDispatched = number(dispatched[item.id]);
            const remaining = Math.max(0, required - alreadyDispatched);
            const dispatchable = Math.min(inUse, remaining);

            return `<tr>
                <td>${esc(item.itemName)} — ${esc(item.size || "")}</td>
                <td>${inUse}</td>
                <td>
                    <input type="number" min="0" step="1"
                        max="${dispatchable}" value="0"
                        data-dispatch-item="${esc(item.id)}"
                        ${dispatchable <= 0 ? "disabled" : ""}>
                    <small>Remaining for this guest: ${remaining}</small>
                </td>
            </tr>`;
        });

        $("dispatchLines").innerHTML = rows.length
            ? rows.join("")
            : '<tr><td colspan="3">No linen requirements found in this guest pack.</td></tr>';
    }

        function renderReturnOptions() {
        const open = dispatches.filter(d => d.status !== "Completed");
        $("returnDispatch").innerHTML =
            '<option value="">Select an open dispatch</option>' +
            open.map(d => `<option value="${esc(d.id)}">${esc(d.reference)} — ${esc(d.provider)} (${d.status})</option>`).join("");
    }

    function renderReturnLines() {
        const dispatch = dispatches.find(d => d.id === $("returnDispatch").value);
        if (!dispatch) {
            $("returnPanel").hidden = true;
            return;
        }

        const outstandingLines = (dispatch.items || []).filter(line => number(line.outstanding) > 0);
        $("returnSummary").textContent =
            `${dispatch.reference} | ${dispatch.provider} | Outstanding: ${outstandingLines.reduce((s,l)=>s+number(l.outstanding),0)}`;

        $("returnLines").innerHTML = outstandingLines.map(line => `
            <tr>
                <td>${esc(line.itemName)} — ${esc(line.size || "")}</td>
                <td>${number(line.outstanding)}</td>
                <td><input type="number" min="0" step="1" value="0"
                    max="${number(line.outstanding)}" data-clean="${esc(line.itemId)}"></td>
                <td><input type="number" min="0" step="1" value="0"
                    max="${number(line.outstanding)}" data-damaged="${esc(line.itemId)}"></td>
            </tr>`).join("");

        $("returnPanel").hidden = false;
    }

    function renderHistory() {
        $("dispatchHistory").innerHTML = dispatches.length ? dispatches.map(d => {
            const sent = (d.items || []).reduce((s,l)=>s+number(l.quantitySent),0);
            const outstanding = (d.items || []).reduce((s,l)=>s+number(l.outstanding),0);
            return `<tr>
                <td>${esc(d.dispatchDate || "")}</td>
                <td>${esc(d.reference || "")}</td>
                <td>${esc(d.provider || "")}</td>
                <td>${(d.items || []).length}</td>
                <td>${sent}</td>
                <td>${outstanding}</td>
                <td>${esc(d.status || "")}</td>
            </tr>`;
        }).join("") : '<tr><td colspan="7">No laundry dispatches recorded.</td></tr>';

        $("returnHistory").innerHTML = returns.length ? returns.map(r => `
            <tr>
                <td>${esc(dateText(r.createdAt))}</td>
                <td>${esc(r.dispatchReference || "")}</td>
                <td>${(r.items || []).length}</td>
                <td>${number(r.totalClean)}</td>
                <td>${number(r.totalDamaged)}</td>
                <td>${esc(r.actorEmail || "Admin")}</td>
            </tr>`).join("") : '<tr><td colspan="6">No laundry returns recorded.</td></tr>';

        const open = dispatches.filter(d => d.status !== "Completed");
        $("openDispatches").textContent = open.length;
        $("outstandingTotal").textContent = open.reduce((sum,d) =>
            sum + (d.items || []).reduce((s,l)=>s+number(l.outstanding),0), 0);
        $("totalLaundry").textContent = Object.values(balances)
            .reduce((sum,b)=>sum+number(b.inLaundry),0);
    }

    function renderExpectedReturns() {
        const target = $("expectedReturnRows");
        const open = expectedReturns.filter(r => number(r.quantityExpected) > number(r.quantityReceivedClean) + number(r.quantityReceivedDamaged));
        target.innerHTML = open.length ? open.map(r => {
            const outstanding = number(r.quantityExpected) - number(r.quantityReceivedClean) - number(r.quantityReceivedDamaged);
            return `<tr>
                <td>${esc(r.bookingReference || r.bookingId)}</td><td>${esc(r.itemName)}</td>
                <td>${number(r.quantityExpected)}</td><td>${number(r.quantityReserved)}</td>
                <td>${number(r.quantityReceivedClean) + number(r.quantityReceivedDamaged)}</td>
                <td>${esc(r.expectedDate || "")}</td><td>${esc(r.provider || "")}</td>
                <td><input type="number" min="0" step="1" max="${outstanding}" value="0" data-expected-clean="${esc(r.id)}" aria-label="Clean received">
                <input type="number" min="0" step="1" max="${outstanding}" value="0" data-expected-damaged="${esc(r.id)}" aria-label="Damaged received">
                <button type="button" class="hk-btn" data-receive-expected="${esc(r.id)}">Confirm receipt</button></td>
            </tr>`;
        }).join("") : '<tr><td colspan="8">No expected external laundry returns are outstanding.</td></tr>';
    }

    async function saveExpectedReturn(event) {
        event.preventDefault();
        if (saving) return;
        const bookingReference = $("expectedBookingReference").value.trim();
        const provider = $("expectedProvider").value.trim();
        const itemId = $("expectedItem").value;
        const quantity = Number($("expectedQuantity").value);
        const expectedDate = $("expectedDate").value;
        if (!bookingReference || !provider || !itemId || !Number.isInteger(quantity) || quantity < 1 || !expectedDate) {
            status("Enter a booking reference, provider, item, positive whole quantity and expected date.", true); return;
        }
        const bookingSnap = await db.collection("bookings").where("bookingReference", "==", bookingReference).limit(2).get();
        if (bookingSnap.size !== 1) { status("The booking reference must match exactly one booking.", true); return; }
        const bookingDoc = bookingSnap.docs[0];
        if (bookingDoc.data().status !== "Confirmed") { status("Expected laundry returns can only be linked to a confirmed booking.", true); return; }
        const item = items.find(x => x.id === itemId);
        if (!item) { status("Select a valid configured linen item.", true); return; }
        saving = true; $("saveExpectedReturn").disabled = true;
        try {
            const ref = db.collection(EXPECTED_RETURNS).doc();
            const now = firebase.firestore.FieldValue.serverTimestamp();
            await ref.set({
                bookingId: bookingDoc.id, bookingReference, itemId, itemName: item.itemName,
                size: item.size || "", quantityExpected: quantity, quantityReserved: 0,
                quantityReceivedClean: 0, quantityReceivedDamaged: 0,
                expectedDate, provider, note: $("expectedNote").value.trim(),
                status: "Pending", actorUid: user.uid, actorEmail: user.email || "",
                createdAt: now, updatedAt: now
            });
            $("expectedReturnForm").reset();
            $("expectedDate").value = localDate();
            $("expectedReturnStatus").textContent = `Expected return registered for ${bookingReference}. No stock balance was changed.`;
            await loadAll();
        } catch (error) {
            console.error("Expected laundry return registration failed:", error);
            $("expectedReturnStatus").textContent = `Unable to register expected return: ${error.message}`;
        } finally { saving = false; $("saveExpectedReturn").disabled = false; }
    }

    async function completePendingAllocation(bookingId) {
        const packRef = db.collection("housekeepingGuestPacks").doc(bookingId);
        const packSnap = await packRef.get();
        if (!packSnap.exists || packSnap.data().allocationStatus !== "Pending Laundry Return") return;
        const pack = packSnap.data();
        const requirements = pack.pendingAllocationRequirements || [];
        if (!requirements.length) return;
        const balanceRefs = requirements.map(r => db.collection(BALANCES).doc(r.itemId));
        const movementRefs = requirements.map(() => db.collection(MOVEMENTS).doc());
        const auditRef = db.collection("housekeepingAuditLogs").doc();
        await db.runTransaction(async tx => {
            const freshPackSnap = await tx.get(packRef);
            if (!freshPackSnap.exists || freshPackSnap.data().allocationStatus !== "Pending Laundry Return") return;
            const snaps = [];
            for (const ref of balanceRefs) snaps.push(await tx.get(ref));
            const rows = requirements.map((r, i) => {
                if (!snaps[i].exists) throw new Error(`${r.itemName}: stock balance missing.`);
                const b = snaps[i].data();
                const available = number(b.available);
                if (available < number(r.quantity)) throw new Error(`${r.itemName}: still short; need ${r.quantity}, available ${available}.`);
                return {r, b, available};
            });
            const now = firebase.firestore.FieldValue.serverTimestamp();
            rows.forEach((x, i) => {
                tx.update(balanceRefs[i], {available:x.available-number(x.r.quantity), allocated:number(x.b.allocated)+number(x.r.quantity), updatedAt:now});
                tx.set(movementRefs[i], {itemId:x.r.itemId,itemName:x.r.itemName,quantity:x.r.quantity,fromStatus:"available",toStatus:"allocated",bookingId,bookingReference:freshPackSnap.data().bookingReference || "",note:"Conditional allocation completed after physical laundry receipt",actorUid:user.uid,actorEmail:user.email || "",createdAt:now});
            });
            tx.update(packRef, {allocationStatus:"Allocated",allocatedByItem:Object.fromEntries(requirements.map(r=>[r.itemId,r.quantity])),allocatedAt:now,allocatedBy:user.email || "",pendingAllocationRequirements:firebase.firestore.FieldValue.delete(),conditionalAllocationCompletedAt:now});
            tx.set(auditRef,{entityType:"guestPack",entityId:bookingId,action:"conditional_laundry_allocation_completed",summary:`Conditional allocation completed after laundry receipt for ${freshPackSnap.data().bookingReference || bookingId}`,actorUid:user.uid,actorEmail:user.email || "",createdAt:now});
        });
    }

    async function receiveExpectedReturn(id) {
        if (saving) return;
        const record = expectedReturns.find(r => r.id === id);
        if (!record) return;
        const clean = Number(document.querySelector(`[data-expected-clean="${CSS.escape(id)}"]`)?.value || 0);
        const damaged = Number(document.querySelector(`[data-expected-damaged="${CSS.escape(id)}"]`)?.value || 0);
        const outstanding = number(record.quantityExpected)-number(record.quantityReceivedClean)-number(record.quantityReceivedDamaged);
        if (!Number.isInteger(clean) || !Number.isInteger(damaged) || clean < 0 || damaged < 0 || clean+damaged < 1 || clean+damaged > outstanding) {
            status(`Enter valid clean/damaged quantities. Outstanding: ${outstanding}.`, true); return;
        }
        saving = true;
        try {
            const ref = db.collection(EXPECTED_RETURNS).doc(id);
            const balanceRef = db.collection(BALANCES).doc(record.itemId);
            const cleanMove = clean ? db.collection(MOVEMENTS).doc() : null;
            const damagedMove = damaged ? db.collection(MOVEMENTS).doc() : null;
            const now = firebase.firestore.FieldValue.serverTimestamp();
            await db.runTransaction(async tx => {
                const [rSnap,bSnap] = await Promise.all([tx.get(ref),tx.get(balanceRef)]);
                if (!rSnap.exists || !bSnap.exists) throw new Error("Expected return or stock balance no longer exists.");
                const r = rSnap.data(), b = bSnap.data();
                const remaining = number(r.quantityExpected)-number(r.quantityReceivedClean)-number(r.quantityReceivedDamaged);
                if (clean+damaged > remaining) throw new Error("Receipt exceeds the remaining expected quantity.");
                tx.update(ref,{quantityReceivedClean:number(r.quantityReceivedClean)+clean,quantityReceivedDamaged:number(r.quantityReceivedDamaged)+damaged,status:(clean+damaged===remaining)?"Received":"Partially Received",updatedAt:now,lastReceivedBy:user.email || ""});
                const totalReceived = clean + damaged;
                const currentInLaundry = number(b.inLaundry);
                if (currentInLaundry < totalReceived) {
                    throw new Error(`Cannot receive ${totalReceived} item(s): only ${currentInLaundry} are recorded In Laundry.`);
                }
                tx.update(balanceRef,{
                    available:number(b.available)+clean,
                    inLaundry:currentInLaundry-totalReceived,
                    damaged:number(b.damaged)+damaged,
                    updatedAt:now
                });
                if (cleanMove) tx.set(cleanMove,{itemId:record.itemId,itemName:record.itemName,quantity:clean,fromStatus:"inLaundry",toStatus:"available",bookingId:record.bookingId,bookingReference:record.bookingReference,note:`External laundry return ${id}`,actorUid:user.uid,actorEmail:user.email || "",createdAt:now});
                if (damagedMove) tx.set(damagedMove,{itemId:record.itemId,itemName:record.itemName,quantity:damaged,fromStatus:"inLaundry",toStatus:"damaged",bookingId:record.bookingId,bookingReference:record.bookingReference,note:`External laundry return ${id}`,actorUid:user.uid,actorEmail:user.email || "",createdAt:now});
            });
            try { await completePendingAllocation(record.bookingId); status("Physical receipt recorded. Clean items added to Available; conditional booking allocation was completed if all required stock is now available."); }
            catch (allocationError) { status(`Physical receipt recorded. Conditional allocation remains pending: ${allocationError.message}`); }
            await loadAll();
        } catch (error) { console.error("Expected laundry receipt failed:",error); status(`Receipt not recorded: ${error.message}`,true); }
        finally { saving = false; }
    }

    async function loadAll() {
        status("Loading laundry records...");

        const [itemSnap, balanceSnap, dispatchSnap, returnSnap, packSnap, expectedSnap] = await Promise.all([
            db.collection(ITEMS).where("active","==",true).get(),
            db.collection(BALANCES).get(),
            db.collection(DISPATCHES).get(),
            db.collection(RETURNS).get(),
            db.collection("housekeepingGuestPacks").where("allocationStatus","==","In Use").get(),
            db.collection(EXPECTED_RETURNS).get()
        ]);

        items = itemSnap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b)=>String(a.itemName).localeCompare(String(b.itemName)));

        balances = {};
        balanceSnap.docs.forEach(d => balances[d.id] = d.data());

        dispatches = dispatchSnap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b)=>String(b.dispatchDate || "").localeCompare(String(a.dispatchDate || "")));

        returns = returnSnap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b)=>dateText(b.createdAt).localeCompare(dateText(a.createdAt)));
        expectedReturns = expectedSnap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b)=>String(a.expectedDate || "").localeCompare(String(b.expectedDate || "")));
        $("expectedItem").innerHTML = '<option value="">Select item</option>' + items.map(i => `<option value="${esc(i.id)}">${esc(i.itemName)} — ${esc(i.size || "")}</option>`).join("");
        renderExpectedReturns();

        guestPacks = packSnap.docs.map(d => ({id:d.id,...d.data()}))
            .sort((a,b)=>String(a.checkin || "").localeCompare(String(b.checkin || "")));

        const selectedPackId = $("dispatchGuestPack").value;

        $("dispatchGuestPack").innerHTML =
            '<option value="">Select a guest pack</option>' +
            guestPacks.map(p => `<option value="${esc(p.id)}">
                ${esc(p.bookingReference || p.id)} — ${esc(p.guestName || "Guest")}
                (${esc(p.checkin || "")})
            </option>`).join("");

        if (guestPacks.some(p => p.id === selectedPackId)) {
            $("dispatchGuestPack").value = selectedPackId;
        }

        renderDispatchLines();
        renderReturnOptions();
        renderReturnLines();
        renderHistory();

        status(`${items.length} active item(s), ${guestPacks.length} guest pack(s) In Use, ${dispatches.length} dispatch(es) and ${returns.length} return(s) found.`);
    }

        async function saveDispatch(event) {
        event.preventDefault();
        if (saving) return;

        const packId = $("dispatchGuestPack").value;
        const pack = guestPacks.find(p => p.id === packId);

        if (!pack) {
            status("Select a guest pack currently In Use.", true);
            return;
        }

        const provider = $("provider").value.trim();
        const dispatchDate = $("dispatchDate").value;
        const note = $("dispatchNote").value.trim();

        const lines = [...document.querySelectorAll("[data-dispatch-item]")]
            .map(input => ({
                itemId: input.dataset.dispatchItem,
                quantitySent: Number(input.value)
            }))
            .filter(line => line.quantitySent > 0);

        if (!provider || !dispatchDate || !lines.length) {
            status("Enter a provider, date and at least one positive dispatch quantity.", true);
            return;
        }

        if (lines.some(l => !Number.isInteger(l.quantitySent) || l.quantitySent < 0)) {
            status("Dispatch quantities must be non-negative whole numbers.", true);
            return;
        }

        const requirements = Array.isArray(pack.requirements) ? pack.requirements : [];
        const lineSnapshots = lines.map(line => {
            const item = items.find(i => i.id === line.itemId);
            if (!item) throw new Error(`Unknown linen item: ${line.itemId}`);

            const requirement = requirements.find(r =>
                String(r.name || "").trim().toLowerCase() ===
                String(item.itemName || "").trim().toLowerCase()
            );

            if (!requirement) {
                throw new Error(`${item.itemName} is not part of this guest pack.`);
            }

            return {
                ...line,
                itemName:item.itemName,
                size:item.size || "",
                requiredQuantity:number(requirement.quantity)
            };
        });

        const packRef = db.collection("housekeepingGuestPacks").doc(packId);
        const dispatchRef = db.collection(DISPATCHES).doc();
        const movementRefs = lines.map(() => db.collection(MOVEMENTS).doc());
        const balanceRefs = lines.map(l => db.collection(BALANCES).doc(l.itemId));

        saving = true;
        $("saveDispatch").disabled = true;

        try {
            await db.runTransaction(async tx => {
                const packSnap = await tx.get(packRef);
                if (!packSnap.exists) throw new Error("Guest preparation pack no longer exists.");

                const currentPack = packSnap.data();
                if (currentPack.allocationStatus !== "In Use") {
                    throw new Error("This guest pack is no longer In Use. Refresh and select an eligible pack.");
                }

                const snapshots = [];
                for (const ref of balanceRefs) {
                    snapshots.push(await tx.get(ref));
                }

                const currentDispatched = currentPack.laundryDispatched || {};
                const nextDispatched = {...currentDispatched};
                const currentInUseByItem = currentPack.inUseByItem || {};
                const nextInUseByItem = {...currentInUseByItem};
                const currentInLaundryByItem = currentPack.inLaundryByItem || {};
                const nextInLaundryByItem = {...currentInLaundryByItem};

                snapshots.forEach((snap,index) => {
                    const line = lineSnapshots[index];

                    if (!snap.exists) {
                        throw new Error(`${line.itemName}: stock balance has not been initialised.`);
                    }

                    const inUse = number(snap.data().inUse);
                    const packInUse = number(currentInUseByItem[line.itemId]);
                    if (packInUse < line.quantitySent) {
                        throw new Error(
                            `${line.itemName}: this guest pack has only ${packInUse} in-use item(s) available to dispatch.`
                        );
                    }
                    if (inUse < line.quantitySent) {
                        throw new Error(`Insufficient aggregate In Use stock for ${line.itemName}. In Use: ${inUse}.`);
                    }

                    nextInUseByItem[line.itemId] = packInUse - line.quantitySent;
                    nextInLaundryByItem[line.itemId] =
                        number(currentInLaundryByItem[line.itemId]) + line.quantitySent;

                    const alreadyDispatched = number(currentDispatched[line.itemId]);
                    const remainingForPack = line.requiredQuantity - alreadyDispatched;

                    if (remainingForPack < 0 || line.quantitySent > remainingForPack) {
                        throw new Error(`${line.itemName}: dispatch exceeds this guest pack's remaining requirement (${Math.max(0,remainingForPack)}).`);
                    }

                    nextDispatched[line.itemId] = alreadyDispatched + line.quantitySent;
                });

                const now = firebase.firestore.FieldValue.serverTimestamp();

                const dispatchItems = lineSnapshots.map(line => ({
                    ...line,
                    quantityReturnedClean:0,
                    quantityReturnedDamaged:0,
                    outstanding:line.quantitySent
                }));

                tx.set(dispatchRef, {
                    reference:`LD-${dispatchRef.id.slice(0,8).toUpperCase()}`,
                    dispatchDate,
                    provider,
                    note,
                    status:"Open",
                    guestPackId:packId,
                    bookingId:currentPack.bookingId || "",
                    bookingReference:currentPack.bookingReference || "",
                    guestName:currentPack.guestName || "",
                    checkin:currentPack.checkin || "",
                    checkout:currentPack.checkout || "",
                    items:dispatchItems,
                    actorUid:user.uid,
                    actorEmail:user.email || "",
                    createdAt:now,
                    updatedAt:now
                });

                snapshots.forEach((snap,index) => {
                    const line = lineSnapshots[index];

                    tx.update(balanceRefs[index], {
                        inUse:number(snap.data().inUse)-line.quantitySent,
                        inLaundry:number(snap.data().inLaundry)+line.quantitySent,
                        updatedAt:now
                    });

                    tx.set(movementRefs[index], {
                        itemId:line.itemId,
                        itemName:line.itemName,
                        quantity:line.quantitySent,
                        fromStatus:"inUse",
                        toStatus:"inLaundry",
                        bookingId:currentPack.bookingId || "",
                        guestPackId:packId,
                        bookingReference:currentPack.bookingReference || "",
                        note:`Laundry dispatch ${dispatchRef.id} — ${provider}`,
                        actorUid:user.uid,
                        actorEmail:user.email || "",
                        createdAt:now
                    });
                });

                const allRequirementsDispatched = requirements.every(requirement => {
                    const item = items.find(i =>
                        String(i.itemName || "").trim().toLowerCase() ===
                        String(requirement.name || "").trim().toLowerCase()
                    );
                    if (!item) return false;

                    const total = number(nextDispatched[item.id]);
                    return total >= number(requirement.quantity);
                });

                tx.update(packRef, {
                    inUseByItem:nextInUseByItem,
                    inLaundryByItem:nextInLaundryByItem,
                    laundryDispatched:nextDispatched,
                    laundryStatus:allRequirementsDispatched ? "Dispatched" : "Partially Dispatched",
                    ...(allRequirementsDispatched ? {
                        allocationStatus:"In Laundry",
                        dispatchedAt:now,
                        dispatchedBy:user.uid
                    } : {}),
                    updatedAt:now
                });
            });

            $("dispatchForm").reset();
            $("dispatchDate").value = localDate();
            $("dispatchGuestPack").value = "";
            status("Laundry dispatch recorded. In Use stock moved to In Laundry and linked to the guest booking.");
            await loadAll();
        } catch (error) {
            console.error("Laundry dispatch failed:",error);
            status(`Dispatch was not saved: ${error.message}`,true);
        } finally {
            saving = false;
            $("saveDispatch").disabled = false;
        }
    }

        async function saveReturn(event) {
        event.preventDefault();
        if (saving) return;

        const dispatch = dispatches.find(d => d.id === $("returnDispatch").value);
        if (!dispatch) {
            status("Select an open laundry dispatch.",true);
            return;
        }

        const lines = (dispatch.items || []).map(line => ({
            ...line,
            clean:Number(document.querySelector(`[data-clean="${CSS.escape(line.itemId)}"]`)?.value || 0),
            damaged:Number(document.querySelector(`[data-damaged="${CSS.escape(line.itemId)}"]`)?.value || 0)
        })).filter(line => line.clean > 0 || line.damaged > 0);

        if (!lines.length) {
            status("Enter at least one clean or damaged return quantity.",true);
            return;
        }

        for (const line of lines) {
            if (!Number.isInteger(line.clean) || !Number.isInteger(line.damaged) ||
                line.clean < 0 || line.damaged < 0 ||
                line.clean + line.damaged > number(line.outstanding)) {
                status(`Invalid return quantity for ${line.itemName}. Maximum outstanding: ${line.outstanding}.`,true);
                return;
            }
        }

        const returnRef = db.collection(RETURNS).doc();
        const dispatchRef = db.collection(DISPATCHES).doc(dispatch.id);
        const packRef = dispatch.guestPackId
            ? db.collection("housekeepingGuestPacks").doc(dispatch.guestPackId)
            : null;
        const balanceRefs = lines.map(l => db.collection(BALANCES).doc(l.itemId));
        const movementRefs = [];
        lines.forEach(line => {
            if (line.clean > 0) movementRefs.push({line,from:"inLaundry",to:"available",quantity:line.clean,ref:db.collection(MOVEMENTS).doc()});
            if (line.damaged > 0) movementRefs.push({line,from:"inLaundry",to:"damaged",quantity:line.damaged,ref:db.collection(MOVEMENTS).doc()});
        });

        saving = true;
        $("saveReturn").disabled = true;

        try {
            await db.runTransaction(async tx => {
                const dispatchSnap = await tx.get(dispatchRef);
                if (!dispatchSnap.exists) throw new Error("Dispatch no longer exists.");

                const current = dispatchSnap.data();
                const currentLines = current.items || [];
                if (!packRef || !current.guestPackId) {
                    throw new Error("This dispatch is not linked to a guest pack. Return stopped to protect booking-level stock.");
                }

                const packSnap = await tx.get(packRef);
                if (!packSnap.exists) throw new Error("The linked guest pack no longer exists.");
                const currentPack = packSnap.data();
                const currentInLaundryByItem = currentPack.inLaundryByItem || {};
                const nextInLaundryByItem = {...currentInLaundryByItem};
                const currentInUseByItem = currentPack.inUseByItem || {};

                const balanceSnaps = [];
                for (const ref of balanceRefs) balanceSnaps.push(await tx.get(ref));

                const updates = [];
                for (const line of lines) {
                    const original = currentLines.find(x => x.itemId === line.itemId);
                    if (!original) throw new Error("Item is not part of this dispatch.");
                    if (line.clean + line.damaged > number(original.outstanding)) {
                        throw new Error(`Return exceeds current outstanding quantity for ${line.itemName}.`);
                    }
                    const index = lines.indexOf(line);
                    const snap = balanceSnaps[index];
                    if (!snap.exists) throw new Error(`Stock balance missing for ${line.itemName}.`);
                    const returnQuantity = line.clean + line.damaged;
                    const packInLaundry = number(currentInLaundryByItem[line.itemId]);
                    if (packInLaundry < returnQuantity) {
                        throw new Error(
                            `${line.itemName}: this guest pack has only ${packInLaundry} item(s) recorded at the laundry.`
                        );
                    }
                    if (number(snap.data().inLaundry) < returnQuantity) {
                        throw new Error(`Insufficient aggregate in-laundry balance for ${line.itemName}.`);
                    }
                    nextInLaundryByItem[line.itemId] = packInLaundry - returnQuantity;
                    updates.push({original,line,snap});
                }

                const now = firebase.firestore.FieldValue.serverTimestamp();
                const newItems = currentLines.map(original => {
                    const update = updates.find(x => x.original.itemId === original.itemId);
                    if (!update) return original;
                    return {
                        ...original,
                        quantityReturnedClean:number(original.quantityReturnedClean)+update.line.clean,
                        quantityReturnedDamaged:number(original.quantityReturnedDamaged)+update.line.damaged,
                        outstanding:number(original.outstanding)-update.line.clean-update.line.damaged
                    };
                });

                const totalOutstanding = newItems.reduce((s,l)=>s+number(l.outstanding),0);
                const nextStatus = totalOutstanding === 0 ? "Completed" : "Partially Returned";

                tx.update(dispatchRef,{items:newItems,status:nextStatus,updatedAt:now});

                const requirements = Array.isArray(currentPack.requirements) ? currentPack.requirements : [];
                const dispatchedByItem = currentPack.laundryDispatched || {};
                const allRequirementsDispatched = requirements.length > 0 && requirements.every(requirement => {
                    const item = items.find(i =>
                        String(i.itemName || "").trim().toLowerCase() ===
                        String(requirement.name || "").trim().toLowerCase()
                    );
                    return item && number(dispatchedByItem[item.id]) >= number(requirement.quantity);
                });
                const noPackStockInUse = Object.values(currentInUseByItem)
                    .every(quantity => number(quantity) === 0);
                const noPackStockAtLaundry = Object.values(nextInLaundryByItem)
                    .every(quantity => number(quantity) === 0);
                const packLaundryComplete =
                    allRequirementsDispatched && noPackStockInUse && noPackStockAtLaundry;

                tx.update(packRef, {
                    inLaundryByItem:nextInLaundryByItem,
                    ...(packLaundryComplete ? {
                        allocationStatus:"Returned",
                        laundryStatus:"Returned",
                        returnedAt:now,
                        returnedBy:user.uid
                    } : {
                        laundryStatus:allRequirementsDispatched ? "Partially Returned" : "Partially Dispatched"
                    }),
                    updatedAt:now
                });

                updates.forEach(({line,snap}) => {
                    tx.update(db.collection(BALANCES).doc(line.itemId),{
                        inLaundry:number(snap.data().inLaundry)-line.clean-line.damaged,
                        available:number(snap.data().available)+line.clean,
                        damaged:number(snap.data().damaged)+line.damaged,
                        updatedAt:now
                    });
                });

                movementRefs.forEach(m => tx.set(m.ref,{
                    itemId:m.line.itemId,
                    itemName:m.line.itemName,
                    quantity:m.quantity,
                    fromStatus:m.from,
                    toStatus:m.to,
                    bookingId:dispatch.bookingId || "",
                    guestPackId:dispatch.guestPackId || "",
                    bookingReference:dispatch.bookingReference || "",
                    note:`Laundry return ${returnRef.id} — dispatch ${dispatch.reference}`,
                    actorUid:user.uid,
                    actorEmail:user.email || "",
                    createdAt:now
                }));

                tx.set(returnRef,{
                    dispatchId:dispatch.id,
                    dispatchReference:dispatch.reference,
                    bookingId:dispatch.bookingId || "",
                    guestPackId:dispatch.guestPackId || "",
                    bookingReference:dispatch.bookingReference || "",
                    items:lines.map(l=>({
                        itemId:l.itemId,itemName:l.itemName,
                        quantityClean:l.clean,quantityDamaged:l.damaged
                    })),
                    totalClean:lines.reduce((s,l)=>s+l.clean,0),
                    totalDamaged:lines.reduce((s,l)=>s+l.damaged,0),
                    note:$("returnNote").value.trim(),
                    actorUid:user.uid,
                    actorEmail:user.email || "",
                    createdAt:now
                });
            });

            $("returnForm").reset();
            $("returnDispatch").value = "";
            $("returnPanel").hidden = true;
            status("Laundry return recorded. Stock balances and movement history updated.");
            await loadAll();
        } catch (error) {
            console.error("Laundry return failed:",error);
            status(`Return was not saved: ${error.message}`,true);
        } finally {
            saving = false;
            $("saveReturn").disabled = false;
        }
    }

    $("dispatchGuestPack").addEventListener("change",renderDispatchLines);
    $("dispatchForm").addEventListener("submit",saveDispatch);
    $("returnForm").addEventListener("submit",saveReturn);
    $("returnDispatch").addEventListener("change",renderReturnLines);
    $("expectedReturnForm").addEventListener("submit",saveExpectedReturn);
    $("expectedReturnRows").addEventListener("click", event => { const button = event.target.closest("[data-receive-expected]"); if (button) receiveExpectedReturn(button.dataset.receiveExpected); });
    $("expectedDate").value = localDate();

    $("dispatchDate").value = localDate();

    firebase.auth().onAuthStateChanged(async currentUser => {
        if (!currentUser) return;
        user = currentUser;
        try {
            await loadAll();
        } catch (error) {
            console.error("Laundry initialisation failed:",error);
            status(`Unable to load laundry records: ${error.message}`,true);
        }
    });
})();