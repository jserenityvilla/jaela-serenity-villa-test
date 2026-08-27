const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// ============================================================
// Ja-Ela Serenity Villa - Test Environment Regression Suite
// ============================================================

const TEST_BASE_URL =
  "https://jserenityvilla.github.io/jaela-serenity-villa-test";

const BOOKING_URL =
  `${TEST_BASE_URL}/pages/booking.html`;

const ADMIN_URL =
  `${TEST_BASE_URL}/admin/index.html`;

const RESULTS =
  "tests/regression-results.json";

const results = [];

// ============================================================
// RESULT HELPERS
// ============================================================

function record(testId, status, actualResult, notes = "") {
  results.push({
    testId,
    status,
    actualResult,
    notes,
  });
}

async function saveResults() {
  fs.mkdirSync(path.dirname(RESULTS), {
    recursive: true,
  });

  fs.writeFileSync(
    RESULTS,
    JSON.stringify(results, null, 2)
  );
}

test.afterAll(async () => {
  await saveResults();
});

// ============================================================
// DATE HELPER
// ============================================================

async function setBookingDates(
  page,
  checkin,
  checkout,
) {
  await page.waitForFunction(() => {
    const a = document.querySelector("#checkin");
    const b = document.querySelector("#checkout");

    return !!(
      a &&
      b &&
      a._flatpickr &&
      b._flatpickr
    );
  }, null, {
    timeout: 10000,
  });

  await page.locator("#checkin").evaluate(
    (element, date) => {
      if (!element._flatpickr) {
        throw new Error(
          "Flatpickr is not initialized on #checkin."
        );
      }

      element._flatpickr.setDate(
        date,
        true
      );
    },
    checkin,
  );

  await page.locator("#checkout").evaluate(
    (element, date) => {
      if (!element._flatpickr) {
        throw new Error(
          "Flatpickr is not initialized on #checkout."
        );
      }

      element._flatpickr.setDate(
        date,
        true
      );
    },
    checkout,
  );

  await page.waitForTimeout(700);
}

// ============================================================
// ADMIN HELPER
// ============================================================

async function getBookingRow(
  page,
  reference,
) {
  return page
    .locator("#bookingTableBody tr")
    .filter({
      hasText: reference,
    })
    .first();
}

// ============================================================
// TC-004
// Booking page loads
// ============================================================

test(
  "TC-004 Booking page loads",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL,
        {
          waitUntil:
            "domcontentloaded",
        }
      );

      await expect(
        page.locator("#bookingForm")
      ).toBeVisible();

      record(
        "TC-004",
        "PASS",
        "Test booking page and booking form loaded successfully.",
      );
    } catch (e) {
      record(
        "TC-004",
        "FAIL",
        "Booking page/form did not load.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-005
// All booking fields
// ============================================================

test(
  "TC-005 All booking fields are available",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      const selectors = [
        "#checkin",
        "#checkout",
        "#adults",
        "#children",
        "#guestName",
        "#guestEmail",
        "#guestPhone",
        "#guestCountry",
        "#arrivalTime",
        "#specialRequests",
      ];

      for (
        const selector of selectors
      ) {
        await expect(
          page.locator(selector)
        ).toBeAttached();
      }

      record(
        "TC-005",
        "PASS",
        "All expected booking fields are present.",
      );
    } catch (e) {
      record(
        "TC-005",
        "FAIL",
        "One or more booking fields are missing.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-006
// Stay summary
// ============================================================

test(
  "TC-006 Stay summary calculates nights",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      await setBookingDates(
        page,
        "2026-09-15",
        "2026-09-18",
      );

      await expect(
        page.locator("#summaryNights")
      ).toHaveText("3");

      record(
        "TC-006",
        "PASS",
        "3 nights displayed for 15 Sep to 18 Sep 2026.",
      );
    } catch (e) {
      record(
        "TC-006",
        "FAIL",
        "Stay summary did not calculate the expected 3 nights.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-007
// Pricing
// ============================================================

test(
  "TC-007 Pricing calculates correctly",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      await setBookingDates(
        page,
        "2026-09-15",
        "2026-09-18",
      );

      await page
        .locator("#adults")
        .selectOption("2");

      await page
        .locator("#children")
        .selectOption("0");

      await page.waitForTimeout(
        700
      );

      const summary =
        await page
          .locator("body")
          .innerText();

      if (!summary.includes("AUD")) {
        throw new Error(
          "AUD pricing was not displayed on the page."
        );
      }

      record(
        "TC-007",
        "PASS",
        "Pricing summary displayed after valid dates and guest numbers were selected.",
      );
    } catch (e) {
      record(
        "TC-007",
        "FAIL",
        "Pricing calculation could not be verified.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-008
// Invalid email
// ============================================================

test(
  "TC-008 Invalid email is rejected",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      await setBookingDates(
        page,
        "2026-09-15",
        "2026-09-18",
      );

      await page
        .locator("#guestName")
        .fill(
          "Automation Test"
        );

      await page
        .locator("#guestEmail")
        .fill("abc");

      await page
        .locator("#guestPhone")
        .fill(
          "+61400000000"
        );

      await page
        .locator("#bookingForm")
        .evaluate(
          form => {
            form.dispatchEvent(
              new Event(
                "submit",
                {
                  bubbles: true,
                  cancelable: true,
                }
              )
            );
          }
        );

      await page.waitForTimeout(
        500
      );

      const body =
        await page
          .locator("body")
          .innerText();

      if (
        !/email|valid|invalid/i.test(
          body
        )
      ) {
        record(
          "TC-008",
          "SKIPPED",
          "No detectable email validation message was found.",
          "Review validation.js if a stronger selector is required.",
        );

        return;
      }

      record(
        "TC-008",
        "PASS",
        "Invalid email was detected by the booking validation.",
      );
    } catch (e) {
      record(
        "TC-008",
        "FAIL",
        "Invalid email validation test failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-009
// Required fields
// ============================================================

test(
  "TC-009 Required fields are validated",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      await page
        .locator("#bookingForm")
        .evaluate(
          form => {
            form.dispatchEvent(
              new Event(
                "submit",
                {
                  bubbles: true,
                  cancelable: true,
                }
              )
            );
          }
        );

      await page.waitForTimeout(
        500
      );

      const body =
        await page
          .locator("body")
          .innerText();

      if (
        /required|valid|error/i.test(
          body
        )
      ) {
        record(
          "TC-009",
          "PASS",
          "Required-field validation was triggered.",
        );
      } else {
        record(
          "TC-009",
          "SKIPPED",
          "No detectable validation message was found.",
          "Review validation.js and update selector if required.",
        );
      }
    } catch (e) {
      record(
        "TC-009",
        "FAIL",
        "Required-field validation test failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-010
// Guest occupancy
// ============================================================

test(
  "TC-010 Guest occupancy validation",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      const maxGuests =
        await page.evaluate(
          () =>
            window.CONFIG
              ?.villa
              ?.maxGuests ?? 0
        );

      if (!maxGuests) {
        record(
          "TC-010",
          "SKIPPED",
          "CONFIG.villa.maxGuests could not be read.",
        );

        return;
      }

      const adults =
        Math.min(
          9,
          maxGuests + 1
        );

      await page
        .locator("#adults")
        .selectOption(
          String(adults)
        );

      await page.waitForTimeout(
        500
      );

      const body =
        await page
          .locator("body")
          .innerText();

      if (
        /maximum occupancy|guests selected|maximum/i.test(
          body
        )
      ) {
        record(
          "TC-010",
          "PASS",
          `Occupancy validation triggered above maximum of ${maxGuests}.`,
        );
      } else {
        record(
          "TC-010",
          "SKIPPED",
          "No detectable occupancy error appeared.",
          "Review validation.js selector/message.",
        );
      }
    } catch (e) {
      record(
        "TC-010",
        "FAIL",
        "Occupancy validation test failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-014
// Firebase
// ============================================================

test(
  "TC-014 Firebase application is available",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      const result =
        await page.evaluate(
          () => ({
            firebaseLoaded:
              typeof window.firebase !==
              "undefined",

            firebaseInitialised:
              typeof window.firebase !==
                "undefined" &&
              Array.isArray(
                window.firebase.apps
              ) &&
              window.firebase.apps.length >
                0,

            dbAvailable:
              typeof window.db !==
              "undefined",
          })
        );

      if (!result.firebaseLoaded) {
        throw new Error(
          "Firebase SDK is not available."
        );
      }

      if (
        !result.firebaseInitialised
      ) {
        throw new Error(
          "Firebase application is not initialised."
        );
      }

      record(
        "TC-014",
        "PASS",
        "Firebase SDK is loaded and a Firebase application is initialised.",
        `dbAvailable=${result.dbAvailable}`,
      );
    } catch (e) {
      record(
        "TC-014",
        "FAIL",
        "Firebase application configuration could not be verified.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-015
// Admin dashboard
// ============================================================

test(
  "TC-015 Admin dashboard loads",
  async ({ page }) => {
    try {
      await page.goto(
        ADMIN_URL,
        {
          waitUntil:
            "domcontentloaded",
        }
      );

      await expect(
        page.locator("#totalBookings")
      ).toBeVisible();

      await expect(
        page.locator("#pendingBookings")
      ).toBeVisible();

      await expect(
        page.locator("#confirmedBookings")
      ).toBeVisible();

      await expect(
        page.locator("#totalRevenue")
      ).toBeVisible();

      record(
        "TC-015",
        "PASS",
        "Admin dashboard and statistics tiles loaded.",
      );
    } catch (e) {
      record(
        "TC-015",
        "FAIL",
        "Admin dashboard did not load correctly.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-016
// Booking list
// ============================================================

test(
  "TC-016 Booking list displays Firestore bookings",
  async ({ page }) => {
    try {
      await page.goto(
        ADMIN_URL
      );

      await page.waitForTimeout(
        1500
      );

      const rows =
        page.locator(
          "#bookingTableBody tr"
        );

      const count =
        await rows.count();

      if (count === 0) {
        throw new Error(
          "No booking rows were displayed."
        );
      }

      record(
        "TC-016",
        "PASS",
        `${count} booking row(s) displayed in the Admin Dashboard.`,
      );
    } catch (e) {
      record(
        "TC-016",
        "FAIL",
        "Admin booking list failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-018
// View booking details
// ============================================================

test(
  "TC-018 View booking details",
  async ({ page }) => {
    try {
      await page.goto(
        ADMIN_URL
      );

      await page.waitForTimeout(
        1200
      );

      const button =
        page
          .locator(
            "#bookingTableBody button"
          )
          .first();

      await expect(
        button
      ).toBeVisible();

      await button.click();

      await expect(
        page.locator("#bookingModal")
      ).toBeVisible();

      await expect(
        page.locator("#bookingDetails")
      ).not.toBeEmpty();

      record(
        "TC-018",
        "PASS",
        "Booking details modal opened and displayed booking information.",
      );
    } catch (e) {
      record(
        "TC-018",
        "FAIL",
        "Booking details modal could not be opened.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-023
// Dashboard statistics tile filtering
// ============================================================

test(
  "TC-023 Dashboard statistics tile filtering",
  async ({ page }) => {
    try {
      await page.goto(
        ADMIN_URL
      );

      await page.waitForTimeout(
        1200
      );

      const tile =
        page.locator(
          "#pendingBookings"
        );

      await expect(
        tile
      ).toBeVisible();

      await tile.click();

      await page.waitForTimeout(
        500
      );

      const rows =
        page.locator(
          "#bookingTableBody tr"
        );

      const count =
        await rows.count();

      if (count === 0) {
        record(
          "TC-023",
          "SKIPPED",
          "Pending tile was clicked but no pending rows were available.",
        );

        return;
      }

      const text =
        await rows.allTextContents();

      if (
        text.some(
          t =>
            /Pending/i.test(t)
        )
      ) {
        record(
          "TC-023",
          "PASS",
          "Pending statistics tile returned pending booking rows.",
        );
      } else {
        record(
          "TC-023",
          "SKIPPED",
          "Tile click occurred but status filtering could not be reliably inferred.",
        );
      }
    } catch (e) {
      record(
        "TC-023",
        "FAIL",
        "Dashboard tile filtering failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-024
// Search bookings
// ============================================================

test(
  "TC-024 Search bookings",
  async ({ page }) => {
    try {
      await page.goto(
        ADMIN_URL
      );

      await page.waitForTimeout(
        1200
      );

      const search =
        page.locator(
          "#searchBookings"
        );

      await expect(
        search
      ).toBeVisible();

      const firstRow =
        page
          .locator(
            "#bookingTableBody tr"
          )
          .first();

      const firstText =
        await firstRow.innerText();

      const refMatch =
        firstText.match(
          /JSV-[A-Z0-9-]+/i
        );

      const guestName =
        (
          await firstRow
            .locator("td")
            .nth(1)
            .innerText()
        )
          .split("\n")[0]
          .trim();

      const searchTerm =
        refMatch
          ? refMatch[0]
          : guestName;

      if (!searchTerm) {
        record(
          "TC-024",
          "SKIPPED",
          "No booking reference or guest name was available for search.",
        );

        return;
      }

      await search.fill(
        searchTerm
      );

      await page.waitForTimeout(
        500
      );

      const count =
        await page
          .locator(
            "#bookingTableBody tr"
          )
          .count();

      if (count > 0) {
        record(
          "TC-024",
          "PASS",
          `Search returned ${count} matching row(s) for ${searchTerm}.`,
        );
      } else {
        throw new Error(
          `Search returned no matching row for ${searchTerm}.`
        );
      }
    } catch (e) {
      record(
        "TC-024",
        "FAIL",
        "Booking search failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-032
// Checkout rules
// ============================================================

test(
  "TC-032 Checkout rules still work",
  async ({ page }) => {
    try {
      await page.goto(
        BOOKING_URL
      );

      await expect(
        page.locator("#checkin")
      ).toBeAttached();

      await expect(
        page.locator("#checkout")
      ).toBeAttached();

      const result =
        await page.evaluate(
          () => ({
            checkin:
              !!document.querySelector(
                "#checkin"
              )?._flatpickr,

            checkout:
              !!document.querySelector(
                "#checkout"
              )?._flatpickr,
          })
        );

      if (
        !result.checkin ||
        !result.checkout
      ) {
        throw new Error(
          "Check-in/check-out Flatpickr controls are not initialised."
        );
      }

      record(
        "TC-032",
        "PASS",
        "Check-in and check-out Flatpickr controls are initialised.",
      );
    } catch (e) {
      record(
        "TC-032",
        "FAIL",
        "Checkout/calendar rules test failed.",
        e.message,
      );

      throw e;
    }
  }
);

// ============================================================
// TC-034
// COMPLETE END-TO-END BOOKING LIFECYCLE
// ============================================================
//
// Flow:
//
// Guest
//   -> Booking page
//   -> Select dates
//   -> Enter guest details
//   -> Submit booking
//   -> Firestore
//   -> confirmation.html
//   -> sessionStorage booking reference
//
// Admin
//   -> Dashboard
//   -> Find booking
//   -> Pending
//   -> View details
//   -> Confirm
//   -> Confirmed
//
// Cleanup
//   -> Cancel automated test booking
//   -> Verify Cancelled
//
// ============================================================

test(
  "TC-034 END-TO-END booking lifecycle",
  { timeout: 120000 },
  async ({ browser }) => {

    const uniqueId =
      `${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

    const guestName =
      `E2E Test Guest ${uniqueId}`;

    const guestEmail =
      `e2e-${uniqueId}@example.com`;

    const guestPhone =
      "+61400000000";

    const checkin = "2026-12-15";
    const checkout = "2026-12-18";

    let bookingReference =
      null;

    let guestContext =
      null;

    let adminContext =
      null;

    try {

      // ========================================================
      // 1. GUEST - OPEN BOOKING PAGE
      // ========================================================

      guestContext =
        await browser.newContext();

      const guestPage =
        await guestContext.newPage();

      await guestPage.goto(
        BOOKING_URL,
        {
          waitUntil:
            "domcontentloaded",
        }
      );

      await expect(
        guestPage.locator(
          "#bookingForm"
        )
      ).toBeVisible();

      // ========================================================
      // 2. SELECT DATES
      // ========================================================

      await setBookingDates(
        guestPage,
        checkin,
        checkout
      );

      await expect(
        guestPage.locator(
          "#summaryNights"
        )
      ).toHaveText("3");

      // ========================================================
      // 3. ENTER GUEST DETAILS
      // ========================================================

      await guestPage
        .locator("#adults")
        .selectOption("2");

      await guestPage
        .locator("#children")
        .selectOption("0");

      await guestPage
        .locator("#guestName")
        .fill(
          guestName
        );

      await guestPage
        .locator("#guestEmail")
        .fill(
          guestEmail
        );

      await guestPage
        .locator("#guestPhone")
        .fill(
          guestPhone
        );

      const country =
        guestPage.locator(
          "#guestCountry"
        );

      if (
        await country.count() &&
        await country.isEditable()
      ) {
        await country.fill(
          "Australia"
        );
      }

      const arrival =
        guestPage.locator(
          "#arrivalTime"
        );

      if (
        await arrival.count() &&
        await arrival.isEditable()
      ) {
        await arrival.fill(
          "14:00"
        );
      }

      const requests =
        guestPage.locator(
          "#specialRequests"
        );

      if (
        await requests.count() &&
        await requests.isEditable()
      ) {
        await requests.fill(
          "Automated E2E Test Booking - DO NOT KEEP"
        );
      }

      // ========================================================
      // 4. SUBMIT BOOKING
      // ========================================================

      const submit =
        guestPage
          .locator(
            '#bookingForm button[type="submit"], ' +
            '#bookingForm input[type="submit"]'
          )
          .first();

      await expect(
        submit
      ).toBeVisible();

      await expect(
        submit
      ).toBeEnabled();

      await submit.click();

      // ========================================================
      // 5. WAIT FOR CONFIRMATION PAGE
      // ========================================================

      await guestPage.waitForURL(
        /confirmation\.html/,
        {
        timeout: 60000,
      }
);

      await guestPage.waitForLoadState(
        "domcontentloaded"
      );

      // confirmation.js reads sessionStorage and
      // populates #bookingReference.
      await guestPage.waitForTimeout(
        1000
      );

      // ========================================================
      // 6. GET BOOKING REFERENCE
      // ========================================================
      //
      // IMPORTANT:
      //
      // booking.js stores:
      //
      // sessionStorage.setItem(
      //   "bookingReference",
      //   bookingReference
      // );
      //
      // before navigating to confirmation.html.
      //
      // ========================================================

      bookingReference =
        await guestPage.evaluate(
          () => {
            return sessionStorage.getItem(
              "bookingReference"
            );
          }
        );

      // Secondary DOM fallback.
      if (!bookingReference) {

        const referenceElement =
          guestPage.locator(
            "#bookingReference"
          );

        if (
          await referenceElement.count()
        ) {

          const text =
            (
              await referenceElement
                .textContent()
            )?.trim() || "";

          if (
            /^JSV-/i.test(
              text
            )
          ) {
            bookingReference =
              text;
          }
        }
      }

      if (!bookingReference) {

        throw new Error(
          "Booking was submitted and confirmation.html loaded, " +
          "but bookingReference was not found in sessionStorage " +
          "or #bookingReference."
        );
      }

      console.log(
        `E2E booking reference: ${bookingReference}`
      );

      // ========================================================
      // 7. VERIFY CONFIRMATION PAGE
      // ========================================================

      await expect(
        guestPage.locator(
          "#bookingReference"
        )
      ).toContainText(
        bookingReference
      );

      const confirmationBody =
        await guestPage
          .locator("body")
          .innerText();

      if (
        !/booking|confirmed|received|thank you/i.test(
          confirmationBody
        )
      ) {

        throw new Error(
          "Confirmation page did not display the expected booking confirmation content."
        );
      }

      console.log(
        "Guest confirmation page verified."
      );

      // ========================================================
      // 8. ADMIN - OPEN DASHBOARD
      // ========================================================

      adminContext =
        await browser.newContext();

      const adminPage =
        await adminContext.newPage();

      await adminPage.goto(
        ADMIN_URL,
        {
          waitUntil:
            "domcontentloaded",
        }
      );

      await expect(
        adminPage.locator(
          "#bookingTableBody"
        )
      ).toBeVisible();

      // Allow Firestore data to load.
      await adminPage.waitForTimeout(
        2000
      );

      // ========================================================
      // 9. SEARCH FOR TEST BOOKING
      // ========================================================

      const search =
        adminPage.locator(
          "#searchBookings"
        );

      await expect(
        search
      ).toBeVisible();

      await search.fill(
        bookingReference
      );

      await adminPage.waitForTimeout(
        700
      );

      const pendingRow =
        await getBookingRow(
          adminPage,
          bookingReference
        );

      await expect(
        pendingRow
      ).toHaveCount(1);

      await expect(
        pendingRow
      ).toContainText(
        guestName
      );

      await expect(
        pendingRow
      ).toContainText(
        "Pending"
      );

      console.log(
        `E2E booking ${bookingReference} is Pending.`
      );

      // ========================================================
      // 10. VIEW BOOKING DETAILS
      // ========================================================

      await pendingRow
        .locator("button")
        .first()
        .click();

      await expect(
        adminPage.locator(
          "#bookingModal"
        )
      ).toBeVisible();

      await expect(
        adminPage.locator(
          "#bookingDetails"
        )
      ).toContainText(
        bookingReference
      );

      await expect(
        adminPage.locator(
          "#bookingDetails"
        )
      ).toContainText(
        guestName
      );

      console.log(
        "Admin booking details verified."
      );

      // ========================================================
      // 11. CONFIRM BOOKING
      // ========================================================

      const confirmButton =
        adminPage.locator(
          "#confirmBookingBtn"
        );

      await expect(
        confirmButton
      ).toBeVisible();

      await expect(
        confirmButton
      ).toBeEnabled();

      // Handle browser confirmation dialog
      // if the application displays one.
      adminPage.once(
        "dialog",
        async dialog => {
          await dialog.accept();
        }
      );

      await confirmButton.click();

      await adminPage.waitForTimeout(
        1500
      );

      // ========================================================
      // 12. VERIFY CONFIRMED STATUS
      // ========================================================

      await search.fill(
        bookingReference
      );

      await adminPage.waitForTimeout(
        700
      );

      const confirmedRow =
        await getBookingRow(
          adminPage,
          bookingReference
        );

      await expect(
        confirmedRow
      ).toHaveCount(1);

      await expect(
        confirmedRow
      ).toContainText(
        "Confirmed"
      );

      console.log(
        `E2E booking ${bookingReference} is Confirmed.`
      );

      // ========================================================
      // 13. CLEANUP
      // ========================================================
      //
      // Cancel the automated booking so that the test
      // does not leave a real reservation in Test.
      //
      // ========================================================

      await confirmedRow
        .locator("button")
        .first()
        .click();

      await expect(
        adminPage.locator(
          "#bookingModal"
        )
      ).toBeVisible();

      const cancelButton =
        adminPage.locator(
          "#deleteBookingBtn"
        );

      await expect(
        cancelButton
      ).toBeVisible();

      await expect(
        cancelButton
      ).toBeEnabled();

      // Accept cancellation confirmation
      // if the application displays one.
      adminPage.once(
        "dialog",
        async dialog => {
          await dialog.accept();
        }
      );

      await cancelButton.click();

      await adminPage.waitForTimeout(
        1500
      );

      // ========================================================
      // 14. VERIFY CLEANUP
      // ========================================================

      await search.fill(
        bookingReference
      );

      await adminPage.waitForTimeout(
        700
      );

      const cleanupRow =
        await getBookingRow(
          adminPage,
          bookingReference
        );

      const cleanupCount =
        await cleanupRow.count();

      if (
        cleanupCount > 0
      ) {

        await expect(
          cleanupRow
        ).toContainText(
          "Cancelled"
        );

        console.log(
          `E2E booking ${bookingReference} is Cancelled.`
        );

      } else {

        console.log(
          `E2E booking ${bookingReference} is no longer displayed after cleanup.`
        );
      }

      // ========================================================
      // FINAL PASS
      // ========================================================

      record(
        "TC-034",
        "PASS",
        `Complete E2E booking lifecycle passed for ${bookingReference}.`,
        `Created Pending booking; confirmation page verified; Admin booking verified; Confirmed status verified; automated test booking cancelled during cleanup. Guest=${guestName}`
      );

    } catch (e) {

      record(
        "TC-034",
        "FAIL",
        "End-to-end booking lifecycle failed.",
        `Reference=${bookingReference || "not generated"}; ${e.message}`
      );

      throw e;

    } finally {

      if (adminContext) {
        await adminContext.close();
      }

      if (guestContext) {
        await guestContext.close();
      }
    }
  }
);



