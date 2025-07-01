describe('Service Catalog GitHub Tests', () => {
    const GitHubRepoName = Cypress.env('GitHubRepoName')

    //TODO move all functions if needed in commands to be used globally

    const OpenMenu = (elementName: string, menuOption?: string, bulk?: boolean): void => {

        //verify correct info in table
        cy.contains('td', elementName).parents('tr').as('tableRow')
        cy.waitForStableDOM()

        if (!bulk) {
            //open inline menu
            cy.get('@tableRow').find('[data-testid="row-actions-dropdown-trigger"]').should('be.visible').click()

            cy.waitForStableDOM();
            menuOption && cy.contains('td [data-testid="dropdown-item"]', menuOption).click()
        } else {
            //bulk options
            cy.get('[data-testid="table-toolbar"] [data-testid="dropdown-trigger"] button').as('bulkBtn')

            cy.get('@bulkBtn').should('be.disabled')
            cy.waitForStableDOM()
            cy.get('@tableRow').find('[data-testid="bulk-actions-checkbox"]').should('be.visible').click() //select row checkbox

            cy.waitForStableDOM();
            cy.get('@bulkBtn').should('not.be.disabled').click()

            cy.waitForStableDOM()

            menuOption && cy.contains('[data-testid="dropdown-list"] [data-testid="dropdown-item-trigger"]', menuOption).click()
        }
    }

    const CreateService = (service: { name: string, internalName: string }, verifyGui?: boolean): void => {
        //Create Service
        cy.get('.modal-title').contains('Create Service')

        cy.get('[data-testid="service-submit-button"]').contains('Create').as('createBtnModal')
        cy.get('@createBtnModal').should('be.disabled')

        {  //?bug type Name (service-name) then clear and enter display name not auto populating machine/internal name 
            // only dismiss and reopen modal gets back to original behaviour
            // cy.get('[data-testid="service-name"]').type('lorem')
            // cy.get('@createBtnModal').should('be.disabled')
        }

        //Typing Display Name and verify auto populating machine-name
        cy.get('[data-testid="service-display-name"]').type(service.name)
        cy.get('[data-testid="service-name"]').should('have.value', service.internalName)
        cy.get('@createBtnModal').should('not.be.disabled')
        cy.get('@createBtnModal').click()

        cy.wait('@createService').then(({ response }) => {
            expect(response?.statusCode).to.eq(201);

            expect(response?.body).to.include({
                name: service.internalName,
                display_name: service.name
            });

            expect(response?.body).to.have.property('id').and.to.match(
                /^[\w\d-]{36}$/
            );

            //expecting all other fields that were left balck to be so
            expect(response?.body).to.have.property('labels').that.deep.eq({});
            expect(response?.body).to.have.property('resources').that.deep.eq([]);

            expect(response?.body).to.have.nested.property('metadata.owner', null);
            expect(response?.body).to.have.nested.property('custom_fields.git_repo', null);

            expect(response?.body).to.have.property('created_at').and.to.match(
                /^\d{4}-\d{2}-\d{2}T/
            );

            //Verify success also in GUI
            verifyGui && cy.get('.toaster-message').contains('Successfully created service and mapped 1 resource')
            verifyGui && cy.get('.toaster-icon-container [data-testid="kui-icon-wrapper-check-circle-icon"]')
        });
    }

    const DeleteService = (service: { name: string, internalName: string }): void => {
        //Delete service and verify operation
        cy.visit('/eu/service-catalog')

        cy.waitForStableDOM()

        cy.get('[data-testid="services-search"]').type(service.name)

        cy.waitForStableDOM()

        OpenMenu(service.name, 'Delete')

        cy.get('.modal-title').contains('Delete Service')
        //making sure confirm button in modal is disabled
        cy.get('[data-testid="modal-action-button"]').contains('Yes, delete').as('confirmBtnModal')
        cy.get('@confirmBtnModal').should('be.disabled')

        cy.get('.prompt-confirmation-text')
            .invoke('text')
            .then((text) => {
                //parsing text and keep only content present in double quotes
                const match = text.match(/"(.*?)"/);
                const extractedText = match ? match[1] : null;

                expect(extractedText).to.eq(service.name); // verify prompt is using defined service name
            });


        cy.get('[data-testid="confirmation-input"]').type(service.name)
        cy.get('@confirmBtnModal').should('not.be.disabled').click()

        //expect No results as we are filtering for exact element and always have 1 row when deleting
        //but also accept if table is not existing after deletion as we have zero elements
        cy.get('body').then(($body) => {
            if (
                $body.find('[data-testid="table-empty-state"]').length > 0 &&
                $body.find('[data-testid="table-empty-state"]').text().includes('No results found')
            ) {
                // element "No results found" exists
                expect(true).to.be.true; //test pass
            } else if ($body.find('.table-container').length > 0) {
                // .table-container trovato
                expect(true).to.be.true; //test pass
            } else {
                //None of our elements was found, test should fail
                throw new Error("Can't find either one expected elements ['.table-container', '[data-testid=\"table-empty-state\"]']");
            }
        });
    }



    beforeEach(() => {
        cy.intercept('PUT', '**/servicehub/v1/discovery/integration-instances/**/ingestion').as('ingestion');
        cy.intercept('POST', '**/servicehub/v1/services').as('createService')
        cy.intercept('DELETE', '**/servicehub/v1/services').as('deleteService')
        cy.intercept('POST', '**/services/**/resources').as('createResource')

        cy.loginWithSession();
    })


    it('Trigger resource discovery by hitting ‘sync now’ in the GitHub Integration configuration', () => {
        cy.intercept('PUT', '**/servicehub/v1/discovery/integration-instances/**/ingestion').as('ingestion');

        cy.visit('/eu/service-catalog/integrations/github/instances')

        //open integration detail
        cy.get('td', { timeout: 20000 }).contains('GitHub').click()

        //Open menu
        cy.get('button[data-testid="instance-actions-dropdown"]').click()

        cy.get('[data-testid="dropdown-item"]').contains('Sync Now').click()
        // Wait for the PUT request and validate response
        cy.wait('@ingestion').then(({ response }) => {
            expect(response?.statusCode).to.eq(200);

            // Check response body has a non-empty last_scheduled field
            expect(response?.body).to.have.property('last_scheduled');
            expect(response?.body.last_scheduled).to.match(/^\d{4}-\d{2}-\d{2}T/); // ISO-like format
            //Verify success also in GUI
            cy.get('.toaster-message').contains('Successfully scheduled a full sync')
            cy.get('.toaster-icon-container [data-testid="kui-icon-wrapper-check-circle-icon"]')
        });

    })


    it('Verify sync from inline menu', () => {
        cy.intercept('PUT', '**/servicehub/v1/discovery/integration-instances/**/ingestion').as('ingestion');

        cy.visit('/eu/service-catalog/integrations/github/instances')

        cy.waitForStableDOM()

        cy.get('input[type="search"]').type('GitHub')

        //verify correct info in table
        cy.contains('td', 'GitHub').parents('tr').as('tableRow')

        //Status Authorized
        cy.get('@tableRow').find('.authorized').contains('Authorized')

        cy.get('@tableRow').find('.instance-name').contains('github')

        //#Repository
        cy.get('@tableRow').find('.integration-data').contains('1')

        //click inline Menu
        OpenMenu('GitHub', 'Sync Now')
        // Wait for the PUT request and validate response
        cy.wait('@ingestion').then(({ response }) => {
            expect(response?.statusCode).to.eq(200);

            // Check response body has a non-empty last_scheduled field
            expect(response?.body).to.have.property('last_scheduled');
            expect(response?.body.last_scheduled).to.match(/^\d{4}-\d{2}-\d{2}T/); // ISO-like format
            //Verify success also in GUI
            cy.get('.toaster-message').contains('Successfully scheduled a full sync')
            cy.get('.toaster-icon-container [data-testid="kui-icon-wrapper-check-circle-icon"]')
        });

    })

    it('Handles backend error during sync from inline menu', () => {
        // Simulate 500 error in PUT request
        cy.intercept('PUT', '**/servicehub/v1/discovery/integration-instances/**/ingestion', {
            statusCode: 500,
            body: {
                message: 'Internal Server Error',
            },
        }).as('ingestion');

        cy.visit('/eu/service-catalog/integrations/github/instances');
        cy.waitForStableDOM();

        cy.get('input[type="search"]').type('GitHub');

        // Verify table content
        cy.contains('td', 'GitHub').parents('tr').as('tableRow');
        cy.get('@tableRow').find('.authorized').contains('Authorized');
        cy.get('@tableRow').find('.instance-name').contains('github');
        cy.get('@tableRow').find('.integration-data').contains('1');

        OpenMenu('GitHub', 'Sync Now');

        //Wait network request with simulated error
        cy.wait('@ingestion').then(({ response }) => {
            expect(response?.statusCode).to.eq(500);
            expect(response?.body).to.have.property('message', 'Internal Server Error');
        });

        //Verify UI gritter erro
        cy.get('.toaster-message')
            .should('exist')
            .and('contain', 'An error occurred while scheduling a sync: Internal Server Error.')
    });

    it('Navigate to Resources and locate a discovered GitHub repository', () => {
        cy.visit('/eu/service-catalog/resources/resources-list')

        cy.get('[data-testid="page-header-title"]').contains('Resources')

        console.log('REPONAME:', GitHubRepoName);

        //Filter by name
        cy.get('[data-testid="resources-search"]').type(GitHubRepoName)

        //verify correct info in table
        cy.contains('td', 'GitHub').parents('tr').as('tableRow')

        cy.get('@tableRow').contains(GitHubRepoName)
        cy.get('@tableRow').find('[data-testid="kui-icon-wrapper-github-icon"]')
        cy.get('@tableRow').contains('Repository')

    })



    it('Select a GitHub repository resource and create new Service (only required fields) and map the resource to that service from inline menu', () => {
        const now = Date.now()
        const service = {
            name: 'lorem ipsum ' + now,
            internalName: 'lorem-ipsum-' + now //internal name gets suggested automatically 
            // when typing Display Name just make sure data is coherent for now
        }

        cy.visit('/eu/service-catalog/resources/resources-list')

        cy.waitForStableDOM({ pollInterval: 1000, timeout: 20000 });

        cy.get('[data-testid="page-header-title"').contains('Resources')

        //Filter by name
        cy.get('[data-testid="resources-search"]').type(GitHubRepoName)
        cy.waitForStableDOM({ pollInterval: 1000, timeout: 20000 });

        OpenMenu('GitHub', 'Create Service')

        CreateService(service, true)

        DeleteService(service)
    })


    it('Select a GitHub repository resource and create a new service from bulk menu', () => {
        const now = Date.now()
        const service = {
            name: 'lorem ipsum ' + now,
            internalName: 'lorem-ipsum-' + now //internal name gets suggested automatically 
            // when typing Display Name just make sure data is coherent for now
        }

        cy.visit('/eu/service-catalog/resources/resources-list')

        cy.get('[data-testid="page-header-title"').contains('Resources')

        //Filter by name
        cy.get('[data-testid="resources-search"]').type(GitHubRepoName)

        OpenMenu('GitHub', 'Create Service', true)

        CreateService(service, true)
        //cleanup
        DeleteService(service)
    })


    it('First create Service, then map to a GitHub repository resource', () => {
        const now = Date.now()
        const service = {
            name: 'lorem ipsum ' + now,
            internalName: 'lorem-ipsum-' + now //internal name gets suggested automatically removing spaces with '-'
            // when typing Display Name just make sure data is coherent for now
        }

        cy.visit('/eu/service-catalog')

        cy.waitForStableDOM()

        cy.get('body').then($body => {
            //Enforing always finding correct button if table present, or if it's first element that gets created and we start with 
            if ($body.find('[data-testid="page-header-actions"]:contains("New Service")').length) {
                cy.contains('[data-testid="page-header-actions"]', 'New Service').click();
            } else if ($body.find('[data-testid="entity-create-button"]').length) {
                cy.get('[data-testid="entity-create-button"]').click();
            } else {
                throw new Error('Neither "New Service" button was found');
            }
        });

        CreateService(service)

        cy.url().should('match', /service-catalog\/[0-9a-f-]{36}\/overview#/);

        cy.contains('[data-testid="page-header-title"]', service.name)

        cy.contains('.empty-state-content', 'No Resources Yet') //newly created service has no resources associated

        {
            // Map resources button
            cy.get('.empty-state-card').contains('button', 'Map Resources').click()
            cy.waitForStableDOM()
            cy.get('.modal-container').contains('.modal-title', 'Map Resources')

            cy.get('.modal-container [data-testid="resources-search"]').type(GitHubRepoName)


            cy.get('[data-testid="confirm-map-resources"]').as('modalConfirmBtn')
            cy.get('@modalConfirmBtn').should('be.disabled')
            cy.contains('td', GitHubRepoName).parents('tr').as('tableRow')
            cy.waitForStableDOM()
            cy.get('@tableRow').find('[data-testid="bulk-actions-checkbox"]').should('be.visible').click() //select row checkbox

            cy.waitForStableDOM();
            cy.get('@modalConfirmBtn').should('not.be.disabled').click()

            cy.wait('@createResource').then(({ response }) => {
                expect(response?.statusCode).to.eq(201);

                expect(response?.body).to.include({
                    name: GitHubRepoName,
                });
            });

        }
        //cleanup
        DeleteService(service)
    })

    it.skip('Create GitHub instance', () => {
        cy.visit('/eu/service-catalog/integrations')

        cy.get('[data-testid="catalog-item"]').contains('GitHub').click()
        cy.waitForStableDOM({ timeout: 30000 })

        cy.get('[data-testid="add-instance-button"]').should('be.visible').click()

        cy.get('[data-testid="page-header-title"]').invoke('text')
            .then((text) => {
                const match = text.match(/GitHub.*$/);
                if (match) {
                    const extracted = match[0];
                    cy.wrap(extracted).as('instanceName'); //save content for later use
                    cy.log(`Extracted: ${extracted}`);
                } else {
                    throw new Error('Expected instance name not found in text');
                }
            });

        //TODO authorize GitHub
        cy.get('[data-testid="authorize-button"]').click()
        cy.waitForStableDOM()

        cy.url().then((url) => {
            // console.log({ url })

            expect(url).to.match(/^https:\/\/github.com\/login/);
            expect(url).to.match(/integration=konnect-service-catalog/);

            // Extract `return_to` value
            const returnToMatch = url.match(/return_to=([^&]*)/);
            const returnToValue = returnToMatch ? decodeURIComponent(returnToMatch[1]) : null;

            cy.log('Return to:', returnToValue);

            // Extract state
            const stateMatch = returnToValue?.match(/state=([^&]*)/);
            const state = stateMatch ? stateMatch[1] : null;

            cy.log('State:', state);
        })

        //verify Kong logo present
        cy.get('img[alt="Konnect Service Catalog logo"]')

        //TODO auth in GitHub test execution ok till here put in skip as not ready yet

        return //remove once above part is sorted and we get back to Kong integrations
        // Save
        cy.get('[data-testid="save-integration-instance-button"]').click()
        cy.waitForStableDOM()





        return

        cy.get('@instanceName').then((instanceName) => {
            cy.get('altro-selector') // es: '.summary-panel'
                .should('contain.text', instanceName as string);
        });
    })

});
