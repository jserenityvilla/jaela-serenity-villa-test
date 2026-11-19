(() => {
    "use strict";

    const db = firebase.firestore();

    const definitions = {
        rooms: {
            collection: "housekeepingRooms",
            title: "Room Configuration",
            description: "Manage bedrooms, floors and bed arrangements.",
            fields: [
                ["roomName", "Room name", "text", true],
                ["floor", "Floor", "select", true, ["Ground floor", "Upper floor"]],
                ["bedConfiguration", "Bed configuration", "text", true],
                ["notes", "Notes", "textarea", false]
            ],
            columns: ["roomName", "floor", "bedConfiguration", "active"]
        },
        items: {
            collection: "housekeepingLinenItems",
            title: "Linen & Towel Inventory",
            description: "Manage item types, quantities and replacement intervals.",
            fields: [
                ["itemName", "Item name", "text", true],
                ["category", "Category", "select", true, ["Bed linen", "Pillows", "Towels", "Bathroom", "Other"]],
                ["size", "Size / type", "text", false],
                ["quantity", "Quantity", "number", true],
                ["replacementIntervalDays", "Replacement interval (days)", "number", false],
                ["notes", "Notes", "textarea", false]
            ],
            columns: ["itemName", "category", "size", "quantity", "replacementIntervalDays", "active"]
        },
        rules: {
            collection: "housekeepingPackRules",
            title: "Guest Pack Rules",
            description: "Configure linen, towel and bath mat quantities by stay duration.",
            fields: [
                ["ruleName", "Rule name", "text", true],
                ["minNights", "Minimum nights", "number", true],
                ["maxNights", "Maximum nights", "number", true],
                ["linenSets", "Linen sets", "number", true],
                ["towelSets", "Towel sets", "number", true],
                ["bathMats", "Bath mats", "number", true],
                ["notes", "Notes", "textarea", false]
            ],
            columns: ["ruleName", "minNights", "maxNights", "linenSets", "towelSets", "bathMats", "active"]
        }
    };

    let currentTab = "rooms";
    let currentId = null;
    let records = [];

    const $ = id => document.getElementById(id);

    function status(message, isError = false) {
        $("statusMessage").textContent = message;
        $("statusMessage").style.color = isError ? "#a93226" : "#203030";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#39;"
        })[char]);
    }

    function definition() {
        return definitions[currentTab];
    }

    function renderFields(data = {}) {
        const fields = definition().fields;
        $("formFields").innerHTML = fields.map(([key, label, type, required, options]) => {
            const value = data[key] ?? "";
            let control;

            if (type === "select") {
                control = `<select name="${key}" ${required ? "required" : ""}>
                    <option value="">Select...</option>
                    ${options.map(option => `<option ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
                </select>`;
            } else if (type === "textarea") {
                control = `<textarea name="${key}">${escapeHtml(value)}</textarea>`;
            } else {
                control = `<input name="${key}" type="${type}" value="${escapeHtml(value)}"
                    ${required ? "required" : ""}
                    ${type === "number" ? 'min="0" step="1"' : ""}>`;
            }

            return `<label>${escapeHtml(label)}${control}</label>`;
        }).join("");
    }

    function renderTable() {
        const columns = definition().columns;
        $("tableHead").innerHTML = `<tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}<th>Actions</th></tr>`;

        if (!records.length) {
            $("tableBody").innerHTML = `<tr><td colspan="${columns.length + 1}">No records found.</td></tr>`;
            return;
        }

        $("tableBody").innerHTML = records.map(record => {
            const cells = columns.map(key => `<td>${escapeHtml(
                key === "active" ? (record.active === false ? "Inactive" : "Active") : record[key]
            )}</td>`).join("");

            return `<tr>${cells}<td>
                <button type="button" data-edit="${escapeHtml(record.id)}">Edit</button>
                <button type="button" data-toggle="${escapeHtml(record.id)}">${record.active === false ? "Activate" : "Deactivate"}</button>
            </td></tr>`;
        }).join("");
    }

    async function loadRecords() {
        status("Loading records...");
        try {
            const snapshot = await db.collection(definition().collection).get();
            records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            records.sort((a, b) => String(a.roomName || a.itemName || a.ruleName || "")
                .localeCompare(String(b.roomName || b.itemName || b.ruleName || "")));
            renderTable();
            status(`${records.length} record(s) loaded.`);
        } catch (error) {
            console.error("Housekeeping configuration read failed:", error);
            status(`Unable to load records: ${error.message}`, true);
        }
    }

    function openEditor(record = null) {
        currentId = record?.id || null;
        $("formTitle").textContent = currentId ? "Edit Record" : "Add Record";
        renderFields(record || {});
        $("editor").hidden = false;
        $("editor").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeEditor() {
        currentId = null;
        $("editor").hidden = true;
        $("recordForm").reset();
    }

    async function saveRecord(event) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const data = {};

        for (const [key, value] of formData.entries()) {
            const field = definition().fields.find(item => item[0] === key);
            data[key] = field?.[2] === "number"
                ? (value === "" ? null : Number(value))
                : value.trim();
        }

        if (currentTab === "rooms" && !data.bedConfiguration) {
            status("Please enter the bed configuration.", true);
            return;
        }

        if (currentTab === "rules" &&
            (data.maxNights < data.minNights || data.minNights < 1)) {
            status("Please check the stay duration range.", true);
            return;
        }

        data.active = records.find(r => r.id === currentId)?.active !== false;
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        try {
            if (currentId) {
                await db.collection(definition().collection).doc(currentId).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection(definition().collection).add(data);
            }

            closeEditor();
            status("Record saved successfully.");
            await loadRecords();
        } catch (error) {
            console.error("Housekeeping save failed:", error);
            status(`Unable to save record: ${error.message}`, true);
        }
    }

    async function toggleRecord(id) {
        const record = records.find(r => r.id === id);
        if (!record) return;

        const nextActive = record.active === false;

        if (!confirm(`${nextActive ? "Activate" : "Deactivate"} this record?`)) return;

        try {
            await db.collection(definition().collection).doc(id).update({
                active: nextActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            status("Record status updated.");
            await loadRecords();
        } catch (error) {
            console.error("Housekeeping status update failed:", error);
            status(`Unable to update record: ${error.message}`, true);
        }
    }

    async function seedInitialSetup() {
        if (!confirm("Load the initial Ja-Ela Serenity Villa rooms, linen quantities and pack rules? Existing records will not be overwritten.")) return;

        const initialData = {
            rooms: [
                { roomName: "Room 1", floor: "Ground floor", bedConfiguration: "1 Single Bed, 1 Double Bed", notes: "Ground floor bedroom" },
                { roomName: "Room 2", floor: "Ground floor", bedConfiguration: "1 Double Bed", notes: "Ground floor bedroom" },
                { roomName: "Room 3", floor: "Upper floor", bedConfiguration: "1 Queen Bed", notes: "Upper floor bedroom" },
                { roomName: "Room 4", floor: "Upper floor", bedConfiguration: "1 Queen Bed", notes: "Upper floor bedroom" }
            ],
            items: [
                { itemName: "Mattress Protector", category: "Bed linen", size: "Single, Double and Queen", quantity: 5, replacementIntervalDays: 30, notes: "30-day replacement interval" },
                { itemName: "Top Sheet", category: "Bed linen", size: "Single, Double and Queen", quantity: 5, replacementIntervalDays: null, notes: "" },
                { itemName: "Fitted Sheet", category: "Bed linen", size: "Single, Double and Queen", quantity: 5, replacementIntervalDays: null, notes: "" },
                { itemName: "Pillow", category: "Bed linen", size: "Single, Double and Queen", quantity: 9, replacementIntervalDays: null, notes: "" },
                { itemName: "Pillowcase", category: "Bed linen", size: "Single, Double and Queen", quantity: 9, replacementIntervalDays: null, notes: "" },
                { itemName: "Hand Towel", category: "Towels", size: "Bathroom sets", quantity: 4, replacementIntervalDays: null, notes: "Hand towels for the two bathrooms, with two spare" },
                { itemName: "Bath Towel", category: "Towels", size: "Guest towels", quantity: 18, replacementIntervalDays: null, notes: "Two sets of nine" },
                { itemName: "Bath Mat", category: "Towels", size: "Bathroom", quantity: 4, replacementIntervalDays: null, notes: "Two bathrooms and two spare" }
            ],
            rules: [
                { ruleName: "Standard Stay", minNights: 1, maxNights: 4, linenSets: 1, towelSets: 1, bathMats: 4, notes: "Standard stay: one linen set and one towel set for 1 to 4 nights" },
                { ruleName: "Extended Stay", minNights: 5, maxNights: 60, linenSets: 2, towelSets: 2, bathMats: 4, notes: "Extended stay: second clean linen and towel set for guest use for 5 to 60 nights" }
            ]
        };

        try {
            let created = 0;
            let skipped = 0;

            for (const tab of Object.keys(initialData)) {
                const collection = db.collection(definitions[tab].collection);
                const existing = await collection.limit(1).get();

                if (!existing.empty) {
                    skipped++;
                    continue;
                }

                for (const record of initialData[tab]) {
                    await collection.add({
                        ...record,
                        active: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    created++;
                }
            }

            status(`Initial setup finished. ${created} records created; ${skipped} collection(s) skipped because they already contain data.`);
            await loadRecords();
        } catch (error) {
            console.error("Initial setup failed:", error);
            status(`Initial setup failed: ${error.message}`, true);
        }
    }

    function changeTab(tab) {
        if (!definitions[tab]) return;
        currentTab = tab;
        closeEditor();

        document.querySelectorAll("[data-tab]").forEach(button => {
            button.classList.toggle("active", button.dataset.tab === tab);
        });

        $("sectionTitle").textContent = definition().title;
        $("sectionDescription").textContent = definition().description;
        loadRecords();
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-tab]").forEach(button =>
            button.addEventListener("click", () => changeTab(button.dataset.tab))
        );

        $("newRecord").addEventListener("click", () => openEditor());
        $("cancelEdit").addEventListener("click", closeEditor);
        $("recordForm").addEventListener("submit", saveRecord);
        $("seedDefaults").addEventListener("click", seedInitialSetup);

        $("tableBody").addEventListener("click", event => {
            const editId = event.target.dataset.edit;
            const toggleId = event.target.dataset.toggle;

            if (editId) {
                const record = records.find(r => r.id === editId);
                if (record) openEditor(record);
            }

            if (toggleId) toggleRecord(toggleId);
        });

        changeTab("rooms");
    });
})();