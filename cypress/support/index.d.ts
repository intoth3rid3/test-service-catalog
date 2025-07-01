declare namespace Cypress {
    interface Chainable<Subject = any> {
        loginWithSession(): Chainable<void>;
    }
}