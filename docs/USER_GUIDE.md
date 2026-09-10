# PrimărIA — Ghidul Utilizatorului

Ghid de utilizare pentru personalul primăriei.

---

## 1. Autentificare

1. Deschideți aplicația în browser la adresa primită de la administrator
2. Introduceți **adresa de email** și **parola** atribuite
3. Apăsați **Autentificare**

**Conturi demo (mediul de dezvoltare):**

Conturile demo sunt create de `npm run db:seed`; parolele sunt afișate în consolă
și nu sunt incluse în cod sursă.

După autentificare, sunteți redirecționat la **Tabloul de bord** principal.

## 2. Tabloul de Bord

Tabloul de bord afișează:

- **Indicatori cheie (KPI):** număr contribuabili, venituri colectate, restanțe, grad de colectare, proprietăți totale
- **Grafice:** venituri lunare, repartizare pe tip de impozit, evoluția gradului de colectare, îmbătrânire restanțe
- **Plăți recente:** ultimele 5 plăți înregistrate
- **Termene limită:** scadențele importante ale anului fiscal curent

## 3. Gestionarea Contribuabililor

### Vizualizare listă

Accesați **Contribuabili** din meniul lateral. Lista afișează toți contribuabilii activi cu funcții de:

- **Căutare** după nume, CNP/CUI sau cod rol
- **Filtrare** după tip (PF / PJ) și status
- **Sortare** după orice coloană

### Adăugare contribuabil nou

1. Apăsați butonul **Adaugă contribuabil**
2. Selectați tipul: **Persoană Fizică (PF)** sau **Persoană Juridică (PJ)**
3. Completați datele obligatorii:
   - PF: nume, prenume, adresă domiciliu
   - PJ: denumire firmă, CUI, nr. registru comerț, reprezentant legal
4. Opțional: email, telefon, adresă de corespondență
5. Apăsați **Salvare**

### Editare / Vizualizare detalii

Din lista de contribuabili, apăsați pe numele contribuabilului pentru a vedea:

- Datele personale / firmă
- Proprietățile deținute (clădiri, terenuri, vehicule)
- Impozitele calculate
- Plățile efectuate
- Scutirile acordate

## 4. Gestionarea Proprietăților

### Adăugare proprietate

Din pagina contribuabilului sau din meniul **Proprietăți**:

1. Selectați tipul: **Clădire**, **Teren** sau **Vehicul**
2. Completați datele specifice:

**Clădiri:** destinație (rezidențială / nerezidențială), tip construcție, an construcție, suprafață, valoare impozabilă, zonă fiscală, nr. cadastral, act proprietate

**Terenuri:** categorie (intravilan curți / arabil / extravilan), suprafață (mp sau ha), zonă fiscală, nr. cadastral

**Vehicule:** tip vehicul, marcă, model, an fabricație, capacitate cilindrică, număr înmatriculare, serie șasiu

3. Apăsați **Salvare**

## 5. Calculul Masiv de Impozite

Calculul masiv generează automat impozitele pentru toți contribuabilii pe baza proprietăților înregistrate.

1. Accesați **Administrare → Calcul masiv**
2. Selectați **anul fiscal** (ex: 2026)
3. Verificați ca **HCL-ul** cu cotele de impunere să fie configurat
4. Apăsați **Calculează**
5. Sistemul procesează toate proprietățile și generează fișele de impozit
6. La finalizare, se afișează un sumar: nr. impozite calculate, total datorat

**Notă:** Calculul aplică automat:
- Cotele din HCL pentru anul selectat
- Coeficienții de uzură (clădiri vechi)
- Proratarea lunară (proprietăți dobândite/înstrăinate în cursul anului)
- Bonificația de 10% pentru plata integrală până la 31 martie

## 6. Configurare HCL (Cote de Impunere)

1. Accesați **Administrare → HCL**
2. Creați o nouă hotărâre de consiliu local:
   - Număr HCL, dată adoptare, an fiscal
   - Indice de inflație (dacă diferit de 1.0)
3. Adăugați **tabelele de cote**:
   - Impozit clădiri: procent pe tip construcție și zonă
   - Impozit teren: lei/mp sau lei/ha pe categorie și zonă
   - Impozit vehicule: lei/200 cmc pe interval de capacitate
4. Activați HCL-ul

## 7. Generarea Documentelor

Sistemul generează automat documente PDF.

### Tipuri de documente disponibile

- **Decizie de impunere** — document fiscal oficial trimis contribuabilului
- **Certificat fiscal** — atestă situația fiscală a contribuabilului
- **Somație** — notificare pentru restanțe
- **Proces-verbal de colectare** — log de executare

### Generare document

1. Din pagina contribuabilului, apăsați **Generează document**
2. Selectați tipul de document
3. Documentul PDF se generează și se poate descărca

### Generare în masă

Din **Documente → Generare în masă**, puteți genera decizii de impunere pentru toți contribuabilii dintr-un an fiscal.

## 8. Înregistrarea Plăților

1. Accesați **Plăți → Înregistrare plată** sau din pagina contribuabilului
2. Selectați contribuabilul (dacă nu e pre-selectat)
3. Introduceți:
   - Suma plătită
   - Data plății
   - Modalitatea: numerar, virament bancar, mandat poștal, card, Ghișeul.ro
   - Număr chitanță (pentru numerar)
4. Apăsați **Înregistrează**
5. Sistemul distribuie automat plata pe impozitele restante (debit principal → penalități)

## 9. Generarea Rapoartelor

Accesați **Rapoarte** din meniul lateral. Rapoartele disponibile:

| Raport | Descriere |
|--------|-----------|
| Situația veniturilor | Total colectat pe tipuri de impozit și perioade |
| Restanțe | Lista restanțierilor cu sume datorate și penalități |
| Grad de colectare | Procentul de colectare pe tip de impozit |
| Borderou încasări | Registrul zilnic de plăți |
| Situație proprietăți | Inventar proprietăți pe categorie și zonă |

Fiecare raport poate fi filtrat pe perioadă și exportat.

## 10. Export PatrimVen (ANAF)

Exportul PatrimVen generează fișiere XML compatibile cu DUKIntegrator pentru transmiterea datelor la ANAF.

1. Accesați **Administrare → PatrimVen**
2. Selectați anul fiscal și tipul de formular:
   - **F3001** — Declarație patrimoniu (clădiri, terenuri)
   - **F3002** — Declarație vehicule
   - **F3003** — Declarație contribuabili
   - **F3101** — Situație centralizatoare
3. Apăsați **Generează XML**
4. Descărcați fișierul XML
5. Importați în DUKIntegrator pentru transmitere la ANAF

## 11. Somații și Executare

Pentru contribuabilii cu restanțe:

1. Accesați **Somații** din meniul lateral
2. Vizualizați lista contribuabililor cu restanțe
3. Selectați contribuabilii pentru care doriți să emiteți somații
4. Apăsați **Generează somații**
5. Somațiile sunt generate ca documente PDF și înregistrate în sistem
6. Penalitățile sunt calculate automat conform Codului de Procedură Fiscală

## Întrebări Frecvente

**Cum schimb limba interfeței?**
Din meniul utilizator (dreapta sus), selectați limba preferată: Română, Magyar, English.

**Cum resetez parola unui utilizator?**
Administratorul poate reseta parola din **Administrare → Utilizatori**.

**Ce fac dacă calculul masiv nu include un contribuabil?**
Verificați că contribuabilul are status „activ" și cel puțin o proprietate activă înregistrată.

**Cum anulez o plată înregistrată greșit?**
Contactați administratorul. Plățile anulate sunt păstrate în jurnalul de audit.
