(() => {
    "use strict";

    const db = firebase.firestore();
    const rolesCollection = db.collection("housekeepingStaffRoles");
    const staffCollection = db.collection("housekeepingStaff");
    const auditCollection = db.collection("housekeepingAuditLogs");

    let roles = [];
    let currentId = null;
    let saving = false;

    const $ = id => document.getElementById(id);

    function setStatus(message, isError = false) {
        $("rolesStatus").textContent = message;
        $("rolesStatus").style.color = isError ? "#a93226" : "#203030";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#39;"
        })[char]);
    }

    function normaliseName(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function auditRecord(batch, id, action, summary) {
        const user = firebase.auth().currentUser;
        const ref = auditCollection.doc();

        batch.set(ref, {
            entityType: "staff_role",
            entityId: id,
            action,
            summary,
            actorUid: user ? user.uid : "",
            actorEmail: user ? (user.email || "") : "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async function loadRoles() {
        const snapshot = await rolesCollection.get();
        roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        roles.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        renderRoles();
        setStatus(`${roles.length} role record(s) loaded.`);
    }

    function renderRoles() {
        const body = $("rolesTableBody");

        if (!roles.length) {
            body.innerHTML = '<tr><td colspan="4">No roles configured. Select Load Initial Roles to create the defaults.</td></tr>';
            return;
        }

        body.innerHTML = roles.map(role => {
            const active = role.active !== false;
            return `<tr>
                <td>${escapeHtml(role.name)}</td>
                <td>${escapeHtml(role.description || "")}</td>
                <td>${active ? "Active" : "Inactive"}</td>
                <td>
                    <button type="button" class="roles-button"
                        data-edit="${escapeHtml(role.id)}">Edit</button>
                    <button type="button" class="roles-button"
                        data-toggle="${escapeHtml(role.id)}">
                        ${active ? "Deactivate" : "Activate"}
                    </button>
                </td>
            </tr>`;
        }).join("");
    }

    function openEditor(role = null) {
        currentId = role?.id || null;
        $("roleEditorTitle").textContent = currentId ? "Edit Role" : "Add Role";
        $("roleForm").reset();

        if (role) {
            $("roleForm").elements.name.value = role.name || "";
            $("roleForm").elements.description.value = role.description || "";
        }

        $("roleEditor").hidden = false;
        $("roleEditor").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeEditor() {
        currentId = null;
        $("roleForm").reset();
        $("roleEditor").hidden = true;
    }

    async function seedRoles() {
        const snapshot = await rolesCollection.get();
        if (!snapshot.empty) {
            setStatus("Initial roles were not loaded because role records already exist. Existing records were preserved.", true);
            return;
        }

        if (!confirm("Create the four initial staff roles?")) return;

        const defaults = [
            { name: "Housekeeper", description: "Responsible for room cleaning and preparation." },
            { name: "Laundry Staff", description: "Responsible for linen and laundry operations." },
            { name: "Supervisor", description: "Supervises housekeeping and laundry activities." },
            { name: "Other", description: "Other approved housekeeping role." }
        ];

        const batch = db.batch();
        const now = firebase.firestore.FieldValue.serverTimestamp();

        defaults.forEach(item => {
            const ref = rolesCollection.doc();
            batch.set(ref, {
                ...item,
                normalizedName: normaliseName(item.name),
                active: true,
                createdAt: now,
                updatedAt: now
            });

            auditRecord(batch, ref.id, "role_created", `Initial role created: ${item.name}`);
        });

        try {
            await batch.commit();
            await loadRoles();
            setStatus("Initial roles created successfully.");
        } catch (error) {
            console.error("Initial role creation failed:", error);
            setStatus(`Unable to create initial roles: ${error.message}`, true);
        }
    }

    async function saveRole(event) {
        event.preventDefault();
        if (saving) return;

        const name = $("roleForm").elements.name.value.trim();
        const description = $("roleForm").elements.description.value.trim();
        const normalizedName = normaliseName(name);

        if (!name) {
            setStatus("Enter a role name.", true);
            return;
        }

        const duplicate = roles.find(role =>
            role.id !== currentId &&
            normaliseName(role.name) === normalizedName
        );

        if (duplicate) {
            setStatus("A role with this name already exists.", true);
            return;
        }

        saving = true;
        const batch = db.batch();
        const now = firebase.firestore.FieldValue.serverTimestamp();

        try {
            let ref;
            let action;

            const data = {
                name,
                description,
                normalizedName,
                updatedAt: now
            };

            if (currentId) {
                ref = rolesCollection.doc(currentId);
                batch.update(ref, data);
                action = "role_updated";
            } else {
                ref = rolesCollection.doc();
                batch.set(ref, {
                    ...data,
                    active: true,
                    createdAt: now
                });
                action = "role_created";
            }

            auditRecord(batch, ref.id, action, `${action}: ${name}`);
            await batch.commit();

            closeEditor();
            await loadRoles();
            setStatus("Role saved successfully.");
        } catch (error) {
            console.error("Role save failed:", error);
            setStatus(`Unable to save role: ${error.message}`, true);
        } finally {
            saving = false;
        }
    }

    async function toggleRole(id) {
        const role = roles.find(item => item.id === id);
        if (!role) return;

        const nextActive = role.active === false;
        const action = nextActive ? "activate" : "deactivate";

        if (!nextActive) {
            try {
                const staffSnapshot = await staffCollection.get();
                const assigned = staffSnapshot.docs.some(doc => {
                    const staff = doc.data();
                    return staff.roleId === id ||
                        normaliseName(staff.role) === normaliseName(role.name);
                });

                if (assigned) {
                    setStatus(
                        "This role is assigned to a staff record. Reassign those staff records before deactivating this role.",
                        true
                    );
                    return;
                }
            } catch (error) {
                setStatus(`Unable to check staff assignments: ${error.message}`, true);
                return;
            }
        }

        if (!confirm(`Are you sure you want to ${action} the role "${role.name}"?`)) return;

        try {
            const batch = db.batch();
            batch.update(rolesCollection.doc(id), {
                active: nextActive,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            auditRecord(
                batch,
                id,
                nextActive ? "role_activated" : "role_deactivated",
                `${action} role: ${role.name}`
            );

            await batch.commit();
            await loadRoles();
            setStatus(`Role ${action}d successfully.`);
        } catch (error) {
            console.error("Role status update failed:", error);
            setStatus(`Unable to update role: ${error.message}`, true);
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        $("seedRoles").addEventListener("click", seedRoles);
        $("addRole").addEventListener("click", () => openEditor());
        $("cancelRole").addEventListener("click", closeEditor);
        $("roleForm").addEventListener("submit", saveRole);

        $("rolesTableBody").addEventListener("click", event => {
            const editId = event.target.dataset.edit;
            const toggleId = event.target.dataset.toggle;

            if (editId) openEditor(roles.find(item => item.id === editId));
            if (toggleId) toggleRole(toggleId);
        });

        try {
            await loadRoles();
        } catch (error) {
            console.error("Role configuration initialisation failed:", error);
            setStatus(`Unable to load roles: ${error.message}`, true);
        }
    });
})();
