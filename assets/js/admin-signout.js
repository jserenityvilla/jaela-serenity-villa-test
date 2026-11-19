window.adminSignOut = async function adminSignOut() {
    const buttons = document.querySelectorAll(
        'button[onclick="adminSignOut()"], #adminPortalLogout'
    );

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        if (!window.firebase || !firebase.auth) {
            throw new Error("Firebase Authentication is unavailable.");
        }

        await firebase.auth().signOut();

        window.location.replace("/admin/login.html");

    } catch (error) {
        console.error("Admin sign-out failed:", error);

        alert("Unable to sign out. Please try again.");

        buttons.forEach(button => {
            button.disabled = false;
        });
    }
};