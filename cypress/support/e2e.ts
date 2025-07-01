// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    // currently flaky pages e.g. 
    /*
        The following error originated from your application code, not from Cypress.
        > Minified React error #421; visit https://reactjs.org/docs/error-decoder.html?invariant=421 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
        When Cypress detects uncaught errors originating from your application it will automatically fail the current test.
    */

    return false
})