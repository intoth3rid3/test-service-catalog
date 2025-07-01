/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }


import { registerCommand } from 'cypress-wait-for-stable-dom'
registerCommand()


Cypress.Commands.add('loginWithSession', (): void => {
    const username = Cypress.env('username');
    const password = Cypress.env('password');

    cy.session([username], () => {
        cy.visit('/');

        cy.origin('https://signin.cloud.konghq.com', { args: { username, password } }, ({ username, password }) => {

            // pausing for manual MFA & Captcha
            cy.pause();

            cy.get('form #username').type(`${username}{enter}`);
            cy.get('form #password').type(`${password}{enter}`, { log: false }); // hide in log
        });

        cy.get('[data-testid="select-label"]').click();
        cy.get('button').contains('EU (Europe)').click();
        cy.contains('button', 'Continue').click();

        cy.get('[title="Welcome to Konnect 👋"]', { timeout: 15000 }).should('be.visible');
    }, {
        validate() {
            cy.visit('/');
            cy.waitForStableDOM()
            cy.get('[title="Welcome to Konnect 👋"]').should('be.visible');
        },
        cacheAcrossSpecs: true
    });
});
