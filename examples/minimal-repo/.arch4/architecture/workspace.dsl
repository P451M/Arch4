workspace "Travel Booking Recovery" "Intermediate recovery of a travel booking platform." {

    model {
        group "Travel Customers and Operations" {
            traveler = person "Traveler" "Customer searching, booking, changing, or cancelling trips."
            supportAgent = person "Support Agent" "Customer support specialist resolving booking, payment, and partner confirmation issues."
            productOwner = person "Booking Product Owner" "Owns booking journey priorities, customer outcomes, and roadmap tradeoffs."
        }

        group "External Travel and Enterprise Services" {
            identity = softwareSystem "Identity Provider" "Customer and employee sign-in, session policy, and support-agent authorization."
            paymentProvider = softwareSystem "Payment Provider" "External card authorization, capture, refunds, and payment dispute signals."
            airlinePartner = softwareSystem "Airline Partner APIs" "Flight search, seat hold, ticket confirmation, and cancellation contracts."
            hotelPartner = softwareSystem "Hotel Partner APIs" "Hotel availability, room reservation, confirmation, and cancellation contracts."
            notificationProvider = softwareSystem "Notification Provider" "Email, SMS, and push delivery for booking lifecycle updates."
            analyticsWarehouse = softwareSystem "Analytics Warehouse" "Downstream reporting for booking funnel, partner reliability, and support metrics."
        }

        group "Travel Booking Platform" {
            travel = softwareSystem "Travel Booking Platform" "Lets travelers search, book, pay for, change, cancel, and get support for trips." {
                webApp = container "Web App" "Customer-facing travel search, checkout, itinerary, and cancellation experience." "React"

                supportConsole = container "Support Console" "Internal agent UI for booking lookup, manual support actions, and customer communication." "React"

                bookingApi = container "Booking API" "Coordinates booking lifecycle workflows and exposes customer and support APIs." "Kotlin / Spring Boot" {
                    quoteValidator = component "Quote Validator" "Checks selected offer, price, availability window, and traveler constraints." "Kotlin"
                    bookingOrchestrator = component "Booking Orchestrator" "Creates booking records, coordinates partner confirmation, and emits booking lifecycle events." "Kotlin"
                    cancellationHandler = component "Cancellation Handler" "Applies cancellation policy, starts refund workflow, and records customer-visible cancellation state." "Kotlin"
                    partnerConfirmationAdapter = component "Partner Confirmation Adapter" "Normalizes airline and hotel confirmation outcomes into booking decisions." "Kotlin"
                }

                searchService = container "Search Service" "Runs trip search, caches offer summaries, and shields users from partner latency." "Go"

                inventoryAdapter = container "Inventory Adapter" "Connects search and booking flows to airline and hotel partner APIs." "Node.js"

                paymentService = container "Payment Service" "Owns authorization, capture, refund initiation, and payment status projection." "Java"

                notificationWorker = container "Notification Worker" "Sends booking confirmations, cancellation receipts, and support escalation updates." "Python"

                analyticsExportWorker = container "Analytics Export Worker" "Publishes curated booking and partner reliability events to analytics." "Python"

                eventBus = container "Event Bus" "Carries booking lifecycle, payment, notification, and analytics events." "Kafka" "Queue"

                bookingDb = container "Booking DB" "Stores bookings, travelers, partner confirmations, itinerary state, and cancellation state." "PostgreSQL" "Database"

                searchCache = container "Search Cache" "Stores short-lived search offers and partner availability snapshots." "Redis" "Database"
            }
        }

        deploymentEnvironment "Production" {
            deploymentNode "Cloud Region" "Primary production cloud region for the travel platform." "AWS eu-central-1" {
                deploymentNode "Edge Network" "Public ingress and traffic management." "Managed edge" {
                    edgeGateway = infrastructureNode "Edge Gateway" "Terminates TLS and routes public traffic to the platform." "CloudFront / WAF"
                }

                deploymentNode "Application Cluster" "Runs customer, support, API, worker, and integration workloads." "Kubernetes" {
                    webAppInstance = containerInstance webApp
                    supportConsoleInstance = containerInstance supportConsole
                    bookingApiInstance = containerInstance bookingApi
                    searchServiceInstance = containerInstance searchService
                    inventoryAdapterInstance = containerInstance inventoryAdapter
                    paymentServiceInstance = containerInstance paymentService
                    notificationWorkerInstance = containerInstance notificationWorker
                    analyticsExportWorkerInstance = containerInstance analyticsExportWorker
                }

                deploymentNode "Managed Data Services" "Managed persistence, cache, and event infrastructure." "AWS managed services" {
                    bookingDbRuntime = infrastructureNode "Booking DB" "Managed production booking database." "PostgreSQL"
                    searchCacheRuntime = infrastructureNode "Search Cache" "Managed cache for search offer snapshots." "Redis"
                    eventBusRuntime = infrastructureNode "Event Bus" "Managed event streaming infrastructure." "Kafka"
                }

                edgeGateway -> webAppInstance "Routes customer traffic"
                edgeGateway -> supportConsoleInstance "Routes support traffic"
                searchServiceInstance -> searchCacheRuntime "Reads and writes offers"
                bookingApiInstance -> bookingDbRuntime "Reads and writes booking state"
                bookingApiInstance -> eventBusRuntime "Publishes lifecycle events"
                notificationWorkerInstance -> eventBusRuntime "Consumes lifecycle events"
                analyticsExportWorkerInstance -> eventBusRuntime "Consumes analytics events"
            }
        }

        traveler -> webApp "Searches, books, changes, and cancels trips"
        supportAgent -> supportConsole "Reviews bookings and handles support cases"
        productOwner -> travel "Reviews recovered booking journey and product risks"
        webApp -> identity "Authenticates traveler"
        supportConsole -> identity "Authorizes support access"
        webApp -> bookingApi "Creates, reads, changes, and cancels bookings"
        webApp -> searchService "Searches flights and hotels"
        supportConsole -> bookingApi "Looks up bookings and requests support actions"
        searchService -> searchCache "Reads and writes short-lived offers"
        searchService -> inventoryAdapter "Requests live partner availability"
        bookingApi -> bookingDb "Reads and writes booking lifecycle state"
        bookingApi -> eventBus "Publishes booking lifecycle events"
        bookingApi -> paymentService "Requests authorization, capture, and refunds"
        bookingApi -> inventoryAdapter "Confirms or cancels partner reservations"
        paymentService -> paymentProvider "Authorizes, captures, and refunds payments"
        inventoryAdapter -> airlinePartner "Searches, holds, confirms, and cancels flights"
        inventoryAdapter -> hotelPartner "Searches, reserves, confirms, and cancels rooms"
        notificationWorker -> eventBus "Consumes booking and payment events"
        notificationWorker -> notificationProvider "Sends customer notifications"
        analyticsExportWorker -> eventBus "Consumes lifecycle events"
        analyticsExportWorker -> analyticsWarehouse "Publishes curated booking facts"
        quoteValidator -> searchCache "Verifies selected offer freshness"
        bookingOrchestrator -> bookingDb "Creates and updates booking state"
        bookingOrchestrator -> partnerConfirmationAdapter "Requests partner confirmation"
        partnerConfirmationAdapter -> inventoryAdapter "Normalizes partner outcomes"
        cancellationHandler -> bookingDb "Records cancellation state"
        cancellationHandler -> paymentService "Starts refund workflow"
        cancellationHandler -> notificationWorker "Requests cancellation notification"
    }

    views {
        systemContext travel "TravelBookingSystemContext" {
            include travel
            include traveler
            include supportAgent
            include productOwner
            include identity
            include paymentProvider
            include airlinePartner
            include hotelPartner
            include notificationProvider
            include analyticsWarehouse
            autoLayout lr
        }

        container travel "TravelBookingContainers" {
            include webApp
            include supportConsole
            include bookingApi
            include searchService
            include inventoryAdapter
            include paymentService
            include notificationWorker
            include analyticsExportWorker
            include eventBus
            include bookingDb
            include searchCache
            include traveler
            include supportAgent
            include identity
            include paymentProvider
            include airlinePartner
            include hotelPartner
            include notificationProvider
            include analyticsWarehouse
            autoLayout lr
        }

        component bookingApi "BookingApiComponents" {
            include quoteValidator
            include bookingOrchestrator
            include cancellationHandler
            include partnerConfirmationAdapter
            include inventoryAdapter
            include paymentService
            include notificationWorker
            include bookingDb
            include searchCache
            autoLayout lr
        }

        deployment travel "Production" "TravelBookingProductionDeployment" {
            include *
            autoLayout lr
        }

        dynamic travel "BookTripFlow" {
            traveler -> webApp "Searches, books, changes, and cancels trips"
            webApp -> searchService "Searches flights and hotels"
            searchService -> searchCache "Reads and writes short-lived offers"
            searchService -> inventoryAdapter "Requests live partner availability"
            inventoryAdapter -> airlinePartner "Searches, holds, confirms, and cancels flights"
            inventoryAdapter -> hotelPartner "Searches, reserves, confirms, and cancels rooms"
            webApp -> bookingApi "Creates, reads, changes, and cancels bookings"
            bookingApi -> paymentService "Requests authorization, capture, and refunds"
            paymentService -> paymentProvider "Authorizes, captures, and refunds payments"
            bookingApi -> bookingDb "Reads and writes booking lifecycle state"
            bookingApi -> eventBus "Publishes booking lifecycle events"
            notificationWorker -> eventBus "Consumes booking and payment events"
            notificationWorker -> notificationProvider "Sends customer notifications"
            autoLayout lr
        }

        dynamic travel "CancelTripFlow" {
            traveler -> webApp "Searches, books, changes, and cancels trips"
            webApp -> bookingApi "Creates, reads, changes, and cancels bookings"
            bookingApi -> inventoryAdapter "Confirms or cancels partner reservations"
            inventoryAdapter -> airlinePartner "Searches, holds, confirms, and cancels flights"
            inventoryAdapter -> hotelPartner "Searches, reserves, confirms, and cancels rooms"
            bookingApi -> paymentService "Requests authorization, capture, and refunds"
            paymentService -> paymentProvider "Authorizes, captures, and refunds payments"
            bookingApi -> bookingDb "Reads and writes booking lifecycle state"
            bookingApi -> eventBus "Publishes booking lifecycle events"
            notificationWorker -> eventBus "Consumes booking and payment events"
            notificationWorker -> notificationProvider "Sends customer notifications"
            autoLayout lr
        }

        styles {
            relationship "Relationship" {
            }
        }
    }

}
