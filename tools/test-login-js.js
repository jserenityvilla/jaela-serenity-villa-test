const { chromium } = require("playwright");

const CHROME =
    "C:\\Users\\surek\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

const URL =
    "https://ja-ela-serenity-villa-test.web.app/admin/login.html";

const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;

(async () => {

    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true
    });

    const page = await browser.newPage();

    console.log("==============================================");
    console.log(" ADMIN LOGIN JAVASCRIPT EXECUTION TEST");
    console.log("==============================================");

    page.on("console", msg => {
        console.log("BROWSER:", msg.type(), msg.text());
    });

    page.on("pageerror", error => {
        console.log("PAGE ERROR:", error.message);
    });

    page.on("request", request => {

        const url = request.url();

        if (
            url.includes("identitytoolkit") ||
            url.includes("securetoken") ||
            url.includes("googleapis")
        ) {
            console.log("AUTH REQUEST:", request.method(), url);
        }

    });

    page.on("response", response => {

        const url = response.url();

        if (
            url.includes("identitytoolkit") ||
            url.includes("securetoken")
        ) {
            console.log(
                "AUTH RESPONSE:",
                response.status(),
                url
            );
        }

    });

    await page.goto(URL, {
        waitUntil: "networkidle",
        timeout: 30000
    });

    await page.waitForTimeout(1000);

    console.log("");
    console.log("PAGE:", page.url());

    const scriptState = await page.evaluate(() => {

        const form = document.getElementById("adminLoginForm");
        const button = document.getElementById("adminLoginButton");

        return {
            firebaseDefined: typeof firebase !== "undefined",
            firebaseAuth:
                typeof firebase !== "undefined" &&
                typeof firebase.auth === "function",

            firebaseApps:
                typeof firebase !== "undefined"
                    ? firebase.apps.length
                    : -1,

            formExists: !!form,
            buttonExists: !!button,

            formSubmitListenersPossible:
                !!form,

            buttonText:
                button ? button.innerText : null,

            loginScriptLoaded:
                Array.from(document.scripts)
                    .some(s => s.src.includes("admin-login.js"))
        };

    });

    console.log("");
    console.log("SCRIPT STATE:");
    console.log(JSON.stringify(scriptState, null, 2));

    console.log("");
    console.log("ADDING TEST SUBMIT LISTENER...");

    await page.evaluate(() => {

        const form =
            document.getElementById("adminLoginForm");

        form.addEventListener("submit", () => {
            console.log("TEST LISTENER: FORM SUBMIT EVENT FIRED");
        });

    });

    await page.locator("#adminEmail").fill(EMAIL);
    await page.locator("#adminPassword").fill(PASSWORD);

    console.log("Credentials entered");

    await page.locator("#adminLoginButton").click();

    console.log("Sign In clicked");

    await page.waitForTimeout(7000);

    console.log("");
    console.log("==============================================");
    console.log("RESULT");
    console.log("==============================================");

    console.log("URL:", page.url());

    const message =
        await page.locator("#adminLoginMessage").innerText();

    console.log(
        "LOGIN MESSAGE:",
        JSON.stringify(message)
    );

    console.log(
        "BUTTON:",
        await page.locator("#adminLoginButton").innerText()
    );

    await browser.close();

})();
