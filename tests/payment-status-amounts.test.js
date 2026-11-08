"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const bookingsSource = fs.readFileSync(
    path.join(__dirname, "..", "admin", "accounts", "accounts-bookings.js"),
    "utf8"
);

const dashboardSource = fs.readFileSync(
    path.join(__dirname, "..", "admin", "accounts", "accounts-dashboard.js"),
    "utf8"
);

const statusFunctionMatch = bookingsSource.match(
    /function calculateOverallPaymentStatus\([\s\S]*?\n\}/
);

assert.ok(
    statusFunctionMatch,
    "calculateOverallPaymentStatus must exist in the booking source."
);

const calculateOverallPaymentStatus = new Function(
    `${statusFunctionMatch[0]}; return calculateOverallPaymentStatus;`
)();

const dashboardFunctionStart = dashboardSource.indexOf(
    "function calculatePayments("
);
const dashboardFunctionEnd = dashboardSource.indexOf(
    "function calculateRevenueByGuestCount(",
    dashboardFunctionStart
);

assert.ok(
    dashboardFunctionStart >= 0 && dashboardFunctionEnd > dashboardFunctionStart,
    "calculatePayments must exist in the dashboard source."
);

const calculatePaymentsSource = dashboardSource.slice(
    dashboardFunctionStart,
    dashboardFunctionEnd
).trim();

const calculatePayments = new Function(
    `${calculatePaymentsSource}; return calculatePayments;`
)();

test("partial deposit and balance receipts remain Balance Due", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 5000, 10000),
        "Balance Due"
    );
});

test("full payment is Paid", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 5000, 22000),
        "Paid"
    );
});

test("a deposit-only receipt retains Deposit Paid", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 8100, 0),
        "Deposit Paid"
    );
});

test("a partial balance receipt is Balance Due", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 0, 10000),
        "Balance Due"
    );
});

test("no receipts remain Deposit Required", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 0, 0),
        "Deposit Required"
    );
});

test("overpayment is treated as Paid", () => {
    assert.equal(
        calculateOverallPaymentStatus(27000, 10000, 18000),
        "Paid"
    );
});

test("one-cent rounding tolerance prevents floating-point residue", () => {
    assert.equal(
        calculateOverallPaymentStatus(1000, 499.995, 500),
        "Paid"
    );
});

test("an outstanding amount greater than one cent remains Balance Due", () => {
    assert.equal(
        calculateOverallPaymentStatus(1000, 499.98, 500),
        "Balance Due"
    );
});

test("dashboard uses actual partial LKR payment amounts, not scheduled amounts", () => {
    const booking = {
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        paymentStatus: "Paid",
        depositPaid: true,
        balancePaid: true,
        depositPaymentStatus: "Paid",
        depositPaymentAmount: 5000,
        depositPaymentCurrency: "LKR",
        depositPaymentExchangeRateToLkr: 1,
        depositPaymentAmountLkr: 5000,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10000,
        balancePaymentCurrency: "LKR",
        balancePaymentExchangeRateToLkr: 1,
        balancePaymentAmountLkr: 10000
    };

    assert.deepEqual(
        calculatePayments([booking]),
        {
            depositsReceived: 5000,
            balancesReceived: 10000,
            totalReceived: 15000,
            outstanding: 12000
        }
    );
});

test("dashboard converts actual AUD and USD receipts through their payment rates", () => {
    const booking = {
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        depositPaid: true,
        balancePaid: true,
        depositPaymentStatus: "Paid",
        depositPaymentAmount: 100,
        depositPaymentCurrency: "AUD",
        depositPaymentExchangeRateToLkr: 225,
        depositPaymentAmountLkr: 22500,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10,
        balancePaymentCurrency: "USD",
        balancePaymentExchangeRateToLkr: 330,
        balancePaymentAmountLkr: 3300
    };

    assert.deepEqual(
        calculatePayments([booking]),
        {
            depositsReceived: 22500,
            balancesReceived: 3300,
            totalReceived: 25800,
            outstanding: 1200
        }
    );
});

test("dashboard does not count scheduled amounts when actual payments are Not Paid", () => {
    const booking = {
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        depositPaid: false,
        balancePaid: false,
        paymentStatus: "Deposit Required",
        depositPaymentStatus: "Not Paid",
        depositPaymentAmount: 0,
        depositPaymentAmountLkr: 0,
        balancePaymentStatus: "Not Paid",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    };

    assert.deepEqual(
        calculatePayments([booking]),
        {
            depositsReceived: 0,
            balancesReceived: 0,
            totalReceived: 0,
            outstanding: 27000
        }
    );
});

test("dashboard retains scheduled-value fallback for legacy bookings", () => {
    const legacyBooking = {
        currency: "AUD",
        total: 120,
        totalLkr: 27000,
        exchangeRateToLkr: 225,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        depositPaid: true,
        balancePaid: false,
        paymentStatus: "Deposit Paid"
    };

    assert.deepEqual(
        calculatePayments([legacyBooking]),
        {
            depositsReceived: 8100,
            balancesReceived: 0,
            totalReceived: 8100,
            outstanding: 18900
        }
    );
});

test("actual Not Paid fields do not fall back to scheduled payment amounts", () => {
    const helperSource = bookingsSource.slice(
        bookingsSource.indexOf("const hasActualPaymentAmounts ="),
        bookingsSource.indexOf("const getTotalLkr =")
    );
    const extracted = new Function(
        "parseFiniteNonNegativeNumber",
        "calculateLkrEquivalent",
        "number",
        "getActualPaymentInBookingCurrency",
        `${helperSource}; return { getDepositPaid, getBalancePaid, getDepositPaidLkr, getBalancePaidLkr };`
    )(
        value => {
            if (value === null || value === undefined || String(value).trim() === "") return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        },
        (amount, rate) => amount * rate,
        value => Number(value) || 0,
        () => null
    );

    const booking = {
        depositPaid: true,
        balancePaid: true,
        depositAmount: 30,
        balanceAmount: 70,
        depositAmountLkr: 6750,
        balanceAmountLkr: 15750,
        depositPaymentStatus: "Not Paid",
        depositPaymentAmount: 0,
        depositPaymentAmountLkr: 0,
        balancePaymentStatus: "Not Paid",
        balancePaymentAmount: 0,
        balancePaymentAmountLkr: 0
    };

    assert.equal(helperSource.includes("const getDepositPaid ="), true);
    assert.equal(extracted.getDepositPaid(booking), 0);
    assert.equal(extracted.getBalancePaid(booking), 0);
    assert.equal(extracted.getDepositPaidLkr(booking), 0);
    assert.equal(extracted.getBalancePaidLkr(booking), 0);
});

test("actual paid LKR amount is authoritative even when scheduled amount is larger", () => {
    const helperSource = bookingsSource.slice(
        bookingsSource.indexOf("const hasActualPaymentAmounts ="),
        bookingsSource.indexOf("const getTotalLkr =")
    );
    const extracted = new Function(
        "parseFiniteNonNegativeNumber",
        "calculateLkrEquivalent",
        "number",
        "getActualPaymentInBookingCurrency",
        `${helperSource}; return { getDepositPaidLkr, getBalancePaidLkr };`
    )(
        value => {
            if (value === null || value === undefined || String(value).trim() === "") return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        },
        (amount, rate) => amount * rate,
        value => Number(value) || 0,
        () => null
    );

    const booking = {
        depositPaid: true,
        balancePaid: true,
        depositAmountLkr: 8100,
        balanceAmountLkr: 18900,
        depositPaymentStatus: "Paid",
        depositPaymentAmount: 5000,
        depositPaymentCurrency: "LKR",
        depositPaymentAmountLkr: 5000,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10000,
        balancePaymentCurrency: "LKR",
        balancePaymentAmountLkr: 10000
    };

    assert.equal(extracted.getDepositPaidLkr(booking), 5000);
    assert.equal(extracted.getBalancePaidLkr(booking), 10000);
});

test("booking list and detail status are derived from actual paid amounts", () => {
    const statusStart = bookingsSource.indexOf("const getPaymentStatus =");
    const statusEnd = bookingsSource.indexOf(
        "const getActualPaymentInBookingCurrency =",
        statusStart
    );
    assert.ok(statusStart >= 0 && statusEnd > statusStart);

    const statusSource = bookingsSource.slice(statusStart, statusEnd);
    const helpers = new Function(
        "calculateOverallPaymentStatus",
        "hasActualPaymentAmounts",
        "getTotalLkr",
        "getDepositPaidLkr",
        "getBalancePaidLkr",
        `${statusSource}; return getPaymentStatus;`
    )(
        calculateOverallPaymentStatus,
        (booking, prefix) =>
            Object.prototype.hasOwnProperty.call(booking, `${prefix}PaymentAmount`) ||
            Object.prototype.hasOwnProperty.call(booking, `${prefix}PaymentAmountLkr`),
        booking => Number(booking.totalLkr) || 0,
        booking =>
            booking.depositPaymentStatus === "Paid"
                ? Number(booking.depositPaymentAmountLkr) || 0
                : 0,
        booking =>
            booking.balancePaymentStatus === "Paid"
                ? Number(booking.balancePaymentAmountLkr) || 0
                : 0
    );

    const partialBooking = {
        paymentStatus: "Paid",
        totalLkr: 27000,
        depositPaymentStatus: "Paid",
        depositPaymentAmount: 5000,
        depositPaymentAmountLkr: 5000,
        balancePaymentStatus: "Paid",
        balancePaymentAmount: 10000,
        balancePaymentAmountLkr: 10000
    };

    assert.equal(helpers(partialBooking), "Balance Due");

    const fullyPaidBooking = {
        ...partialBooking,
        balancePaymentAmount: 22000,
        balancePaymentAmountLkr: 22000
    };

    assert.equal(helpers(fullyPaidBooking), "Paid");
});

test("legacy booking without actual payment amount fields keeps its stored status", () => {
    const statusStart = bookingsSource.indexOf("const getPaymentStatus =");
    const statusEnd = bookingsSource.indexOf(
        "const getActualPaymentInBookingCurrency =",
        statusStart
    );
    const statusSource = bookingsSource.slice(statusStart, statusEnd);
    const helpers = new Function(
        "calculateOverallPaymentStatus",
        "hasActualPaymentAmounts",
        "getTotalLkr",
        "getDepositPaidLkr",
        "getBalancePaidLkr",
        `${statusSource}; return getPaymentStatus;`
    )(
        calculateOverallPaymentStatus,
        () => false,
        () => 0,
        () => 0,
        () => 0
    );

    assert.equal(
        helpers({ paymentStatus: "Paid" }),
        "Paid"
    );
});
