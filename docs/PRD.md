# PrimărIA — Product Requirements Document

**Version**: 1.0  
**Date**: 2026-02-12  
**Author**: PrimărIA Team  

---

## 1. Rezumat Executiv / Executive Summary

### 🇷🇴 Română

**PrimărIA** este o platformă SaaS cloud-native pentru gestionarea taxelor și impozitelor locale în primăriile din România. Platforma vizează în principal comunele mici (500–5.000 locuitori) care în prezent folosesc Excel, aplicații desktop învechite sau procese manuale pentru administrarea fiscală locală.

PrimărIA oferă un motor de taxare complet conform Codului Fiscal (Titlul IX), export PatrimVen obligatoriu, generare automată de documente fiscale, portal cetățean self-service și integrare cu Ghișeul.ro — toate într-o interfață modernă, accesibilă din browser.

Numele combină **Primărie** + **IA** (Inteligență Artificială), reflectând viziunea de digitalizare inteligentă a administrației locale.

### 🇬🇧 English

**PrimărIA** is a cloud-native SaaS platform for managing local taxes and fees in Romanian municipalities. It primarily targets small communes (500–5,000 population) currently using Excel, legacy desktop apps, or manual processes for local tax administration.

PrimărIA provides a complete tax engine compliant with the Fiscal Code (Title IX), mandatory PatrimVen export, automated fiscal document generation, citizen self-service portal, and Ghișeul.ro integration — all in a modern, browser-accessible interface.

---

## 2. Problemă / Problem Statement

### Situația actuală în comunele mici din România

România are **~3.200 UAT-uri** (unități administrativ-teritoriale), din care **~2.800 sunt comune**. Majoritatea comunelor mici:

- **Nu au software dedicat** — folosesc Excel sau registre pe hârtie
- **Nu își permit soluțiile existente** — Impotax (Indeco Soft) și Avansis (Integrisoft) sunt prea scumpe pentru bugetele de 5.000–15.000 €/an
- **Nu respectă obligațiile legale** — integrarea PatrimVen (obligatorie din martie 2022 conform OUG 11/2021) lipsește frecvent
- **Pierd venituri** — fără automatizare, somațiile și executările silite întârzie sau nu se emit
- **Nu oferă servicii digitale cetățenilor** — cetățenii trebuie să se deplaseze fizic la primărie

### Oportunitatea

- **Finanțare disponibilă**: Programul Național de Transformare Digitală (MCID) — 200M lei în 2025, vizând 1.000 primării
- **Obligații legale noi**: PatrimVen, Ghișeul.ro, ROeID, e-Factura
- **Segment nedeservit**: ~20% din piață (comunele mici) nu are nicio soluție software

---

## 3. Utilizatori Țintă / Target Users

### 3.1 Secretar de Comună / Commune Secretary
- **Rol**: Administrator principal al sistemului fiscal local
- **Nevoi**: Gestionarea registrului de contribuabili, emiterea deciziilor de impunere, raportări către Curtea de Conturi
- **Nivel tehnic**: Mediu (folosește Word, Excel)

### 3.2 Contabil / Accountant
- **Rol**: Gestiunea financiară, încasări, raportări bugetare
- **Nevoi**: Evidența plăților, export Forexebug, reconcilieri, generare situații financiare
- **Nivel tehnic**: Mediu

### 3.3 Primar / Mayor
- **Rol**: Supervizare, analiză, decizie
- **Nevoi**: Dashboard cu indicatori (venituri, restanțe, grad de colectare), rapoarte sintetice
- **Nivel tehnic**: De bază

### 3.4 Cetățean / Citizen
- **Rol**: Contribuabil, beneficiar servicii publice
- **Nevoi**: Verificare solduri, plată online, descărcare adeverințe, depunere declarații
- **Nivel tehnic**: Variabil (de bază → avansat)

---

## 4. Povești ale Utilizatorilor / User Stories

### 4.1 Secretar de Comună

| # | User Story (RO) | English Translation | Priority |
|---|-----------------|---------------------|----------|
| S1 | Ca secretar, vreau să **înregistrez un contribuabil nou** cu CNP/CUI, adresă și date de contact, pentru a-l include în evidența fiscală. | As secretary, I want to register a new taxpayer with CNP/CUI, address and contact data, to include them in the fiscal registry. | P0 |
| S2 | Ca secretar, vreau să **înregistrez o clădire** cu suprafață, tip construcție, an edificare și valoare de impozitare, pentru calculul automat al impozitului. | As secretary, I want to register a building with area, construction type, year built, and taxable value, for automatic tax calculation. | P0 |
| S3 | Ca secretar, vreau să **emit decizii de impunere** în masă la începutul anului fiscal, pentru toți contribuabilii. | As secretary, I want to mass-generate tax assessment decisions at the start of the fiscal year, for all taxpayers. | P0 |
| S4 | Ca secretar, vreau să **export datele în format PatrimVen XML**, conform cerințelor ANAF. | As secretary, I want to export data in PatrimVen XML format, per ANAF requirements. | P0 |
| S5 | Ca secretar, vreau să **configurez cotele de impozitare** conform HCL-ului aprobat de consiliul local, cu indexare anuală. | As secretary, I want to configure tax rates per the HCL approved by local council, with annual indexation. | P0 |
| S6 | Ca secretar, vreau să **caut un contribuabil** după nume, CNP sau adresă, pentru a-i vizualiza rapid dosarul fiscal. | As secretary, I want to search for a taxpayer by name, CNP, or address, to quickly view their fiscal file. | P0 |
| S7 | Ca secretar, vreau să **generez somații automate** pentru contribuabilii cu restanțe mai vechi de 30 de zile. | As secretary, I want to auto-generate summons for taxpayers with debts older than 30 days. | P1 |
| S8 | Ca secretar, vreau să **import date din Excel/CSV** din sistemul anterior, pentru migrarea rapidă la PrimărIA. | As secretary, I want to import data from Excel/CSV from the previous system, for quick migration to PrimărIA. | P0 |

### 4.2 Contabil

| # | User Story (RO) | English Translation | Priority |
|---|-----------------|---------------------|----------|
| C1 | Ca contabil, vreau să **înregistrez o plată** (numerar, virament, Ghișeul.ro) și să se distribuie automat pe debite. | As accountant, I want to record a payment (cash, bank transfer, Ghișeul.ro) and have it auto-distributed across debts. | P0 |
| C2 | Ca contabil, vreau să **generez rapoarte de încasări** pe perioade, tipuri de taxe și modalități de plată. | As accountant, I want to generate collection reports by period, tax type, and payment method. | P0 |
| C3 | Ca contabil, vreau să **calculez automat penalitățile** de întârziere conform Codului de Procedură Fiscală. | As accountant, I want to auto-calculate late penalties per the Fiscal Procedure Code. | P1 |
| C4 | Ca contabil, vreau să **export situații financiare** pentru Forexebug și Curtea de Conturi. | As accountant, I want to export financial reports for Forexebug and Court of Auditors. | P1 |
| C5 | Ca contabil, vreau să **emit adeverințe fiscale** automat, fără a le scrie manual. | As accountant, I want to auto-generate fiscal certificates without writing them manually. | P0 |

### 4.3 Primar

| # | User Story (RO) | English Translation | Priority |
|---|-----------------|---------------------|----------|
| P1 | Ca primar, vreau să **văd un dashboard** cu veniturile colectate vs. plan, pe fiecare tip de taxă. | As mayor, I want to see a dashboard with collected revenue vs. plan, per tax type. | P1 |
| P2 | Ca primar, vreau să **primesc alerte** când gradul de colectare scade sub un prag stabilit. | As mayor, I want to receive alerts when the collection rate drops below a set threshold. | P2 |
| P3 | Ca primar, vreau să **compar performanța** comunei mele cu medii județene/naționale. | As mayor, I want to compare my commune's performance with county/national averages. | P2 |

### 4.4 Cetățean

| # | User Story (RO) | English Translation | Priority |
|---|-----------------|---------------------|----------|
| CT1 | Ca cetățean, vreau să **verific online cât datorez** la impozite și taxe locale. | As citizen, I want to check online how much I owe in local taxes and fees. | P1 |
| CT2 | Ca cetățean, vreau să **plătesc online** prin Ghișeul.ro direct din portal. | As citizen, I want to pay online through Ghișeul.ro directly from the portal. | P1 |
| CT3 | Ca cetățean, vreau să **descarc adeverințe fiscale** fără a mă deplasa la primărie. | As citizen, I want to download fiscal certificates without going to town hall. | P1 |
| CT4 | Ca cetățean, vreau să **primesc notificări** pe WhatsApp/SMS când am o plată scadentă. | As citizen, I want to receive notifications via WhatsApp/SMS when I have a due payment. | P1 |
| CT5 | Ca cetățean, vreau să **întreb un chatbot** despre taxele mele în limbaj natural. | As citizen, I want to ask a chatbot about my taxes in natural language. | P2 |

---

## 5. Funcționalități / Feature Breakdown

### P0 — Must Have (MVP)

| Feature | Description | Legal Basis |
|---------|-------------|-------------|
| **Motor de taxare / Tax Engine** | Calcul automat pentru tipurile principale de impozite din Titlul IX Cod Fiscal: impozit clădiri (rezidențiale/nerezidențiale/mixte), impozit teren (intravilan/extravilan), impozit mijloace de transport. Include bonificație pentru plată anticipată și proratare an parțial. *Taxa firmă, hotelieră, spectacole → post-MVP.* | L227/2015, Art. 455-495; Art. 462 (bonificație); Art. 461 (proratare) |
| **Bonificație / Early Payment Discount** | Reducere configurabilă per HCL pentru plata integrală până la 31 martie (Art. 462 alin. 2). Calculată automat, afișată pe decizia de impunere. | L227/2015, Art. 462 |
| **Proratare an parțial / Partial Year Proration** | Calcul proporțional de la prima zi a lunii următoare dobândirii/înstrăinării (regula primei luni următoare). | L227/2015, Art. 461 |
| **Semnătură electronică calificată (QES)** | Semnare digitală calificată a tuturor documentelor fiscale emise (decizii, somații, adeverințe) — obligatorie pentru validitate juridică. Integrare certSIGN/DigiSign, format PAdES. | eIDAS, L455/2001 |
| **Registru contribuabili / Taxpayer Registry** | CRUD complet pentru persoane fizice (CNP) și juridice (CUI), cu istoric, legături familiale, mandate | Cod Procedură Fiscală |
| **Gestiune proprietăți / Property Management** | Clădiri, terenuri, vehicule — cu toate atributele necesare calculului fiscal (suprafață, categorie, an, zonă, rang) | L227/2015, Art. 457-458 |
| **Cote configurabile / Rate Configuration** | Configurare cote pe HCL, cu interval legal, indexare anuală, istoric versiuni | L227/2015, Art. 489 |
| **Scutiri și reduceri / Exemptions Engine** | Motor de reguli pentru scutiri (veterani, persoane cu handicap, etc.) cu validare documente justificative | L227/2015, Art. 456; OUG 78/2025 |
| **Export PatrimVen XML** | Generare fișiere XML în format DUKIntegrator pentru upload la ANAF | OUG 11/2021, OMF 109/2022 |
| **Generare documente / Document Generation** | Decizii de impunere, adeverințe fiscale, certificate de atestare fiscală — PDF cu antet primărie | Cod Procedură Fiscală |
| **Rapoarte de bază / Basic Reporting** | Registru fiscal, borderou încasări, centralizator debite/încasări, situație restanțe | — |
| **Plăți / Payment Recording** | Înregistrare plăți numerar, virament, mandat poștal cu distribuire automată pe debite | — |
| **i18n** | Interfață în limba română (principală), maghiară și engleză — toate trei din lansare. Documentele fiscale/legale sunt generate exclusiv în limba română (Constituție Art. 13); HU/EN doar pentru UI informativ. | Constituție Art. 13 |
| **Import date / Data Import** | Import contribuabili, proprietăți, solduri din CSV/Excel | — |

### P1 — Should Have

| Feature | Description |
|---------|-------------|
| **Integrare Ghișeul.ro** | Plăți online prin platforma națională SNEP |
| **Portal cetățean / Citizen Portal** | Self-service: vizualizare solduri, plată, descărcare documente, depunere declarații |
| **Rapoarte avansate** | 400+ tipuri de rapoarte cerute de Curtea de Conturi, ANAF, management |
| **Flux executare silită** | Somație → notificare → penalizare → titlu executoriu → poprire — automatizat |
| **Notificări** | Email, SMS, WhatsApp, Telegram — pentru scadențe, restanțe, confirmări plată |
| ~~**Semnătură electronică**~~ | ~~Semnare digitală documente emise~~ — **MOVED TO P0** (QES required for legal validity) |
| **Offline/PWA de bază** | Service worker, offline queue pentru înregistrări de bază, sincronizare la reconectare — esențial pentru comune rurale cu internet intermitent |
| **ROeID autentificare** | Autentificare cetățeni prin identitate digitală națională |
| **Export Forexebug** | Raportare execuție bugetară |
| **RO e-Factura** | Facturare electronică pentru taxe locale |

### P2 — Nice to Have

| Feature | Description |
|---------|-------------|
| **Chatbot AI cetățean** | "Cât impozit datorez pe mașină?" — răspuns automat în limbaj natural |
| **Detecție anomalii** | Flagging declarații suspecte (clădire declarată ca anexă, mașină scumpă fără venituri) |
| ~~**Limba maghiară**~~ | ~~i18n HU~~ — **MOVED TO P0**: Hungarian is a launch language alongside RO and EN |
| ~~**PWA / Mobile App**~~ | ~~Aplicație mobilă pentru cetățeni~~ — **Basic PWA/offline MOVED TO P1** |
| **Taxa firmă / hotelieră / spectacole** | Entități și calcul fiscal pentru taxa de firmă (Art. 475), taxa hotelieră (Art. 478), taxa spectacole (Art. 480) — post-MVP |
| **Dashboard analytics primar** | KPI-uri, trend-uri, comparații, predicții |
| **API deschis** | REST API pentru integrări terțe (n8n, Zapier) |

---

## 6. Metrici de Succes / Success Metrics

| Metric | Target (Year 1) | Target (Year 2) |
|--------|-----------------|-----------------|
| Comune onboardate | 10 (pilot Maramureș) | 100 (național) |
| Timp de onboarding | < 48 ore | < 24 ore |
| Grad colectare taxe (creștere) | +10% față de media anterioară | +20% |
| Documente generate automat | > 90% din total | > 98% |
| Plăți online (din total plăți) | > 15% | > 35% |
| Satisfacție utilizatori (NPS) | > 30 | > 50 |
| Timp generare PatrimVen export | < 5 minute | < 2 minute |
| Uptime | 99.5% | 99.9% |

---

## 7. Cerințe Non-Funcționale / Non-Functional Requirements

### 7.1 Performanță
- Timp de răspuns pagini: < 500ms (P95)
- Generare rapoarte: < 30s pentru cele mai complexe
- Generare în masă decizii (1.000 contribuabili): < 5 minute
- Suport concurent: 50 utilizatori simultani per tenant

### 7.2 Securitate
- Autentificare: Email/parolă + 2FA (TOTP), ROeID (P1)
- Autorizare: RBAC cu 4 roluri (admin, operator/secretar, contabil, cetățean)
- Date în tranzit: TLS 1.3
- Date în repaus: AES-256 pentru date sensibile (CNP, adrese)
- Audit log complet pentru toate operațiunile CRUD

### 7.3 GDPR & Protecția Datelor
- Conformitate EU Reg 2016/679 + Legea 190/2018
- **DPIA obligatorie** (GDPR Art. 35) — evaluare de impact înainte de producție, documentată formal [UPDATED per review]
- Stocare date în datacenter românesc
- Dreptul la ștergere (cu excepția obligațiilor legale de păstrare)
- Export date personale (format portabil)
- Consimțământ explicit pentru notificări (tabel dedicat `consimtaminte`)
- Retenție date: minim 10 ani (obligație fiscală), apoi anonimizare

### 7.3.1 NIS2 Compliance [UPDATED per review]
- Conformitate cu Directiva NIS2 (EU 2022/2555) — aplicabilă entităților administrației publice
- Plan de răspuns la incidente documentat, raportare DNSC în 24h
- GDPR Art. 33: notificare ANSPDCP în 72h pentru breșuri de date personale

### 7.3.2 Achiziții Publice / SEAP [UPDATED per review]
- **Înregistrare SEAP obligatorie** la e-licitatie.ro pentru vânzarea către primării
- Listare în catalogul electronic SEAP
- Compatibilitate cu procedura de achiziție directă < 30.000€

### 7.4 Accesibilitate
- WCAG 2.1 AA minim
- Navigare completă prin tastatură
- Compatibil cu screen readers
- Contrast minim 4.5:1

### 7.5 Compatibilitate
- Browsere: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- Responsive: Desktop, tablet, mobil
- OS: Agnostic (web-based)

### 7.6 Disponibilitate & Backup
- Uptime target: 99.5% (Year 1) → 99.9% (Year 2)
- RPO (Recovery Point Objective): 1 oră
- RTO (Recovery Time Objective): 4 ore
- Backup-uri zilnice automate, retenție 90 zile

---

## 8. Model de Prețuri / Pricing Model

| Tier | Populație | Preț/lună | Include |
|------|-----------|-----------|---------|
| **Comună** | < 5.000 | 500–1.000 lei | Motor taxe, PatrimVen, documente, rapoarte de bază |
| **Oraș** | 5.000–50.000 | 2.000–5.000 lei | + Portal cetățean, Ghișeul.ro, AI, rapoarte avansate |
| **Municipiu** | 50.000+ | Custom | + Integrări custom, SLA dedicat, suport prioritar |

*Prețuri transparente, publicate pe site. Fără costuri ascunse.*

---

## 9. Constrângeri și Riscuri / Constraints & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Indeco Soft răspunde cu reduceri de preț | Ridicat | Focus pe segmentul nedeservit, nu pe clienții lor |
| Modificări legislative frecvente | Ridicat | Motor de taxare configurabil, nu hardcodat |
| Integrare Ghișeul.ro blocată (API nedocumentat) | Mediu | Contact ADR devreme, fallback la GlobalPay |
| Cicluri lungi de achiziție publică | Ridicat | Vizează achiziții directe < 30.000€ |
| Migrare date din sisteme legacy | Mediu | Importuri flexibile CSV/Excel + serviciu migrare manuală |
| Rezistența la schimbare a personalului | Mediu | Training inclus, UI simplificat, tranziție graduală |

---

*Document viu — se actualizează pe măsură ce cerințele se clarifică prin validare cu utilizatorii pilot.*
