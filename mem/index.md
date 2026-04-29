# Project Memory

## Core
- Krankenkasse-first workflow: UI, validation, and export depend on selected provider (VIACTIV, Novitas, DAK, BIG Plusbonus). Hide sections until selected.
- No PII persistence: AI extraction uses ephemeral in-memory processing. Never persist documents to storage or databases.
- Image integrity: Never apply auto-cropping or image enhancement in document merging or processing.
- Mandatory contacts: Phone and Email are strictly mandatory for all applications; validate prior to submit.
- UI Layout: "Vorname" must always appear before "Name" across all UI sections.
- Open Import: JSON and Freitext Import dialogs are intentionally NOT password protected.

## Memories
- [Architecture Provider Support](mem://architecture/multi-provider-support) — Dynamic Krankenkasse-first form adaptation
- [PDF Naming Conventions](mem://constraints/pdf-naming-conventions) — Provider-specific filename formats and multi-part splitting
- [Address Validation](mem://constraints/address-validation-and-export) — Required address fields and BKK GS city extraction
- [Import Dialogs](mem://auth/import-protection) — Unprotected access and setup for JSON/Freitext imports
- [Mandatory Contacts](mem://constraints/mandatory-contact-info) — Phone and email enforcement constraints
- [Document Merging](mem://features/document-merging) — PDF/Image combining without processing enhancements
- [AI Capture System](mem://features/ai-document-capture/core-system) — Gemini 2.5, ephemeral processing, schema routing
- [AI Frontend Mapping](mem://features/ai-document-capture/frontend-mapping-logic) — Extracted OCR data routing via applyKrankenkassenMapping
- [Birth Location Derivation](mem://logic/birth-location-derivation) — Country derived from birthplace during extraction
- [Data Copy Blocks](mem://features/data-import-logic/ui-and-copy-blocks) — Reusable single-line summary components for review
- [JSON Context Awareness](mem://features/data-import-logic/provider-context-awareness) — Dynamic JSON examples based on provider
- [Import Defaults & Sync](mem://logic/import-defaults-and-sync) — Auto-population of signature date and insurance links
- [Field Sync Logic](mem://logic/field-synchronization-logic) — Bidirectional sync for KV-Nummer and doctor locations
- [Country Code Mapping](mem://logic/country-code-mapping) — Standardized dropdown and ISO code mappings
- [Dynamic Header Labels](mem://ui/header-dynamic-labels) — Context-aware application header titles

### BKK GS Specific
- [BKK PDF Signatures](mem://logic/bkk-gs-pdf-signatures) — Signature routing and broker signature removal
- [BKK AcroField Updates](mem://logic/bkk-gs-acrofield-updates) — Updated mapping names and excluded fields

### Novitas BKK Specific
- [Novitas Integration](mem://features/novitas-bkk-integration) — UI hiding rules and specific PDF export mappings

### DAK Specific
- [DAK UI Validation](mem://features/dak-integration/ui-and-validation) — Hidden KVNR fields and 2-child export limit
- [DAK Export Mapping](mem://features/dak-integration/export-mapping) — Specific AcroField numbering and embedded signatures

### VIACTIV Specific
- [VIACTIV UI & Model](mem://features/viactiv-integration/ui-and-data-model) — Specific gender/employment dropdowns
- [VIACTIV Employment](mem://features/viactiv-integration/employment-fields) — "Beschäftigt seit" field removed constraint
- [VIACTIV UI Layout](mem://features/viactiv-integration/ui-layout) — Vorname before Name enforcement
- [VIACTIV Validation](mem://features/viactiv-integration/mandatory-fields-and-validation) — Employer data requirement if employed
- [VIACTIV Export Mapping](mem://features/viactiv-integration/export-mapping-logic) — Checkboxes and encoding fallbacks
- [VIACTIV Date Logic](mem://logic/viactiv-date-logic) — 3-month lead times and format toggling
- [VIACTIV Field Automation](mem://logic/viactiv-field-automation) — Advanced syncing of insurance provider across family
- [VIACTIV FamVers Display](mem://features/viactiv-integration/familienversicherung-conditional-display) — Conditional UI logic
- [VIACTIV Spouse Split](mem://features/viactiv-integration/spouse-separate-application) — Own membership auto-generates BE
- [VIACTIV Child Logic](mem://features/viactiv-integration/child-membership-logic-v2) — Own membership rules and Bonus PDFs

### BIG Plusbonus Specific
- [BIG Plusbonus Integration](mem://features/big-plusbonus-integration) — Provider value, mapping, signature placement, validation rules
