(() => {
    "use strict";

    const db = firebase.firestore();
    const staffCollection = db.collection("housekeepingStaff");
    const roleCollection = db.collection("housekeepingStaffRoles");
    const auditCollection = db.collection("housekeepingAuditLogs");

    let records = [];
    let roles = [];
    let currentId = null;
    let saving = false;
    let originalMobile = null;

    const $ = id => document.getElementById(id);

    function setStatus(message, isError = false) {
        $("staffStatus").textContent = message;
        $("staffStatus").style.color = isError ? "#a93226" : "#203030";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#39;"
        })[char]);
    }

    function normaliseMobile(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function splitStoredMobile(value) {
        const raw = String(value || "").trim();
        const digits = normaliseMobile(raw);

        const codes = ["+971", "+61", "+94", "+44", "+91", "+1"];

        if (raw.startsWith("+")) {
            const code = codes.find(item => digits.startsWith(item.replace(/\D/g, "")));
            if (code) {
                return {
                    countryCode: code,
                    nationalNumber: digits.slice(code.replace(/\D/g, "").length),
                    legacy: false
                };
            }
        }

        return {
            countryCode: "legacy",
            nationalNumber: raw,
            legacy: true
        };
    }

    function buildInternationalMobile(countryCode, input) {
        let digits = normaliseMobile(input);

        if (countryCode === "legacy") {
            return null;
        }

        if (digits.startsWith("00")) {
            digits = digits.slice(2);
        }

        if (digits.startsWith("0")) {
            digits = digits.slice(1);
        }

        if (digits.length < 7 || digits.length > 12) {
            throw new Error("Enter a valid national mobile number.");
        }

        if (countryCode === "+94") {
            if (digits.length !== 9 || !digits.startsWith("7")) {
                throw new Error("Sri Lankan mobile numbers must contain 9 digits after +94 and start with 7.");
            }
        }

        if (countryCode === "+61") {
            if (digits.length !== 9 || !digits.startsWith("4")) {
                throw new Error("Australian mobile numbers must contain 9 digits after +61 and start with 4.");
            }
        }

        return `${countryCode}${digits}`;
    }

    function currentActor() {
        const user = firebase.auth().currentUser;
        return {
            actorUid: user ? user.uid : "",
            actorEmail: user ? (user.email || "") : ""
        };
    }

    function auditRecord(batch, entityType, entityId, action, summary) {
        const actor = currentActor();
        const ref = auditCollection.doc();

        batch.set(ref, {
            entityType,
            entityId,
            action,
            summary,
            ...actor,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function loadRoles() {
        const snapshot = await roleCollection.where("active", "==", true).get();
        roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        roles.sort((a, b) => String(a.name).localeCompare(String(b.name)));

        const select = $("staffForm").elements.role;
        const previous = select.value;

        select.innerHTML = '<option value="">Select role...</option>' +
            roles.map(role =>
                `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name)}</option>`
            ).join("");

        if (roles.some(role => role.id === previous)) {
            select.value = previous;
        }
    }

    function renderTable() {
        const body = $("staffTableBody");

        if (!records.length) {
            body.innerHTML = '<tr><td colspan="5">No staff records found.</td></tr>';
            return;
        }

        body.innerHTML = records.map(record => {
            const active = record.active !== false;
            return `<tr>
                <td>${escapeHtml(record.fullName)}</td>
                <td>${escapeHtml(record.mobile)}</td>
                <td>${escapeHtml(record.role)}</td>
                <td>${active ? "Active" : "Inactive"}</td>
                <td>
                    <button type="button" class="staff-button"
                        data-edit="${escapeHtml(record.id)}">Edit</button>
                    <button type="button" class="staff-button"
                        data-toggle="${escapeHtml(record.id)}">
                        ${active ? "Deactivate" : "Activate"}
                    </button>
                </td>
            </tr>`;
        }).join("");
    }

    async function loadStaff() {
        setStatus("Loading staff records...");
        try {
            const snapshot = await staffCollection.get();
            records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            records.sort((a, b) =>
                String(a.fullName || "").localeCompare(String(b.fullName || ""))
            );
            renderTable();
            setStatus(`${records.length} staff record(s) loaded.`);
        } catch (error) {
            console.error("Staff records could not be loaded:", error);
            setStatus(`Unable to load staff records: ${error.message}`, true);
        }
    }

    function openEditor(record = null) {
        currentId = record?.id || null;
        $("editorTitle").textContent = currentId
            ? "Edit Staff Member"
            : "Add Staff Member";

        const form = $("staffForm");
        form.reset();

        originalMobile = record ? String(record.mobile || "") : null;

        if (record) {
            form.elements.fullName.value = record.fullName || "";
            form.elements.notes.value = record.notes || "";

            const storedMobile = splitStoredMobile(record.mobile || "");
            form.elements.countryCode.value = storedMobile.countryCode;
            form.elements.mobile.value = storedMobile.nationalNumber;

            const matchingRole = roles.find(role =>
                role.id === record.roleId ||
                role.name.toLowerCase() === String(record.role || "").toLowerCase()
            );
            form.elements.role.value = matchingRole ? matchingRole.id : "";
        } else {
            form.elements.countryCode.value = "+94";
            form.elements.mobile.value = "";
        }

        $("staffEditor").hidden = false;
        $("staffEditor").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeEditor() {
        currentId = null;
        originalMobile = null;
        $("staffForm").reset();
        $("staffForm").elements.countryCode.value = "+94";
        $("staffEditor").hidden = true;
    }

    async function saveStaff(event) {
        event.preventDefault();
        if (saving) return;

        const form = event.currentTarget;
        const fullName = form.elements.fullName.value.trim();
        const mobileInput = form.elements.mobile.value.trim();
        const countryCode = form.elements.countryCode.value;
        const roleId = form.elements.role.value;
        const notes = form.elements.notes.value.trim();

        if (!fullName || !mobileInput || !roleId) {
            setStatus("Please complete the name, mobile number and role.", true);
            return;
        }

        let mobile;

        try {
            if (
                countryCode === "legacy" &&
                currentId &&
                mobileInput === splitStoredMobile(originalMobile).nationalNumber
            ) {
                // Preserve an existing legacy-format number if it has not changed.
                mobile = originalMobile;
            } else {
                if (!/^[+0-9\s().-]+$/.test(mobileInput)) {
                    throw new Error("Enter a valid mobile number using digits only.");
                }

                mobile = buildInternationalMobile(countryCode, mobileInput);

                if (!mobile) {
                    throw new Error("Select a country code for the new mobile number.");
                }
            }
        } catch (error) {
            setStatus(error.message, true);
            return;
        }

        const mobileDigits = normaliseMobile(mobile);

        const duplicate = records.find(record =>
            record.id !== currentId &&
            normaliseMobile(record.mobile) === mobileDigits
        );

        if (duplicate) {
            setStatus(`This mobile number is already assigned to ${duplicate.fullName}.`, true);
            return;
        }

        const selectedRole = roles.find(role => role.id === roleId);
        if (!selectedRole) {
            setStatus("Select an active role. Refresh the page if the role list is out of date.", true);
            return;
        }

        saving = true;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            const batch = db.batch();
            const now = firebase.firestore.FieldValue.serverTimestamp();

            const data = {
                fullName,
                mobile,
                role: selectedRole.name,
                roleId: selectedRole.id,
                notes,
                updatedAt: now
            };

            let staffRef;
            let action;

            if (currentId) {
                staffRef = staffCollection.doc(currentId);
                batch.update(staffRef, data);
                action = "staff_updated";
            } else {
                staffRef = staffCollection.doc();
                data.active = true;
                data.createdAt = now;
                batch.set(staffRef, data);
                action = "staff_created";
            }

            auditRecord(
                batch,
                "staff",
                staffRef.id,
                action,
                `${action === "staff_created" ? "Created" : "Updated"} staff member: ${fullName}`
            );

            await batch.commit();

            closeEditor();
            await loadStaff();
            setStatus("Staff record saved successfully.");
        } catch (error) {
            console.error("Staff record save failed:", error);
            setStatus(`Unable to save staff record: ${error.message}`, true);
        } finally {
            saving = false;
            submitButton.disabled = false;
        }
    }

    async function toggleStaff(id) {
        const record = records.find(item => item.id === id);
        if (!record) return;

        const nextActive = record.active === false;
        const action = nextActive ? "activate" : "deactivate";

        if (!confirm(`Are you sure you want to ${action} ${record.fullName}?`)) return;

        try {
            const batch = db.batch();
            batch.update(staffCollection.doc(id), {
                active: nextActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            auditRecord(
                batch, "staff", id,
                nextActive ? "staff_activated" : "staff_deactivated",
                `${action}d staff member: ${record.fullName}`
            );

            await batch.commit();
            await loadStaff();
            setStatus(`Staff member ${action}d successfully.`);
        } catch (error) {
            console.error("Staff status update failed:", error);
            setStatus(`Unable to update staff status: ${error.message}`, true);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        $("addStaff").addEventListener("click", () => openEditor());
        $("cancelStaff").addEventListener("click", closeEditor);
        $("staffForm").addEventListener("submit", saveStaff);

        $("staffTableBody").addEventListener("click", event => {
            const editId = event.target.dataset.edit;
            const toggleId = event.target.dataset.toggle;

            if (editId) openEditor(records.find(item => item.id === editId));
            if (toggleId) toggleStaff(toggleId);
        });

        try {
            await loadRoles();
            await loadStaff();
            if (!roles.length) {
                setStatus("No active roles configured. Open Manage Staff Roles and load the initial roles.", true);
            }
        } catch (error) {
            console.error("Staff page initialisation failed:", error);
            setStatus(`Unable to initialise staff page: ${error.message}`, true);
        }
    });
})();
