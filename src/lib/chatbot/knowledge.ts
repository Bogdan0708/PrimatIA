export type ChatbotEntry = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  sources: string[];
};

export const CHATBOT_ENTRIES: ChatbotEntry[] = [
  {
    id: "tax-deadlines",
    question: "Cand sunt scadente taxele locale?",
    answer:
      "Impozitele si taxele locale sunt datorate anual, cu doua termene de plata: 31 martie (rata 1) si 30 septembrie (rata 2), conform Codului fiscal.",
    keywords: ["scadenta", "scadente", "termen", "31 martie", "30 septembrie", "rate", "rata"],
    sources: ["Codul fiscal - Titlul IX", "Portal PrimarIA"],
  },
  {
    id: "tax-installments",
    question: "Pot plati impozitul in doua rate?",
    answer:
      "Da. Impozitele locale se pot plati in doua rate egale: prima pana la 31 martie, a doua pana la 30 septembrie.",
    keywords: ["doua rate", "rata", "rate", "plata in rate", "esalonat"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "bonificatie",
    question: "Exista bonificatie pentru plata integrala?",
    answer:
      "Da. Pentru plata integrala pana la 31 martie, se acorda bonificatie de pana la 10%, stabilita prin hotararea consiliului local.",
    keywords: ["bonificatie", "discount", "reducere", "plata integrala", "10%"],
    sources: ["Codul fiscal - Titlul IX", "HCL"],
  },
  {
    id: "late-penalties",
    question: "Care sunt penalitatile pentru intarziere?",
    answer:
      "Pentru plata cu intarziere se calculeaza majorari de intarziere, de regula 1% pe luna sau fractiune de luna, conform Codului fiscal si hotararilor locale.",
    keywords: ["penalitati", "majorari", "intarziere", "dobanzi", "1%"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "payment-online",
    question: "Cum platesc online?",
    answer:
      "Poti plati online din portal, cu cardul, sau prin ghiseul.ro (daca primaria este inrolata). Pastreaza confirmarea platii pentru evidenta ta.",
    keywords: ["online", "card", "ghiseul", "plata online", "portal"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "payment-bank-transfer",
    question: "Pot plati prin virament bancar?",
    answer:
      "Da. Poti achita prin virament bancar folosind contul IBAN al bugetului local si specificand corect CNP/CUI si tipul obligatiei.",
    keywords: ["virament", "transfer bancar", "iban", "banca"],
    sources: ["Portal PrimarIA", "Buget local"],
  },
  {
    id: "payment-cash",
    question: "Unde pot plati numerar?",
    answer:
      "Plata in numerar se poate face la casieria primariei sau la punctele de incasare autorizate. Programul exact este afisat in pagina Contact.",
    keywords: ["numerar", "casierie", "plata cash", "incasare"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "docs-building",
    question: "Ce documente sunt necesare pentru declararea unei cladiri?",
    answer:
      "Pentru declararea unei cladiri sunt necesare, de regula: actul de proprietate, actul de identitate, documentatia cadastrala (extras CF), autorizatia de construire si procesul-verbal de receptie (daca este cazul).",
    keywords: ["documente cladire", "declarare cladire", "act proprietate", "cadastru"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "docs-land",
    question: "Ce documente sunt necesare pentru declararea unui teren?",
    answer:
      "Pentru declararea unui teren se solicita, de regula: actul de proprietate, actul de identitate, documente cadastrale (extras CF, plan de amplasament) si, daca e cazul, documente privind categoria de folosinta.",
    keywords: ["documente teren", "declarare teren", "plan amplasament", "extras cf"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "docs-vehicle",
    question: "Ce documente sunt necesare pentru declararea unui vehicul?",
    answer:
      "Pentru declararea unui vehicul se solicita, de regula: actul de identitate, contractul de vanzare-cumparare/factura, cartea de identitate a vehiculului si certificatul de inmatriculare.",
    keywords: ["documente vehicul", "declarare vehicul", "talon", "carte identitate"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "declaration-deadline",
    question: "In cat timp trebuie depusa declaratia de impunere?",
    answer:
      "Declaratia de impunere se depune, de regula, in termen de 30 de zile de la dobandirea bunului sau de la modificarea datelor care afecteaza impozitul.",
    keywords: ["declaratie", "30 zile", "impunere", "termen declarare"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "fiscal-certificate",
    question: "Cum obtin certificatul fiscal?",
    answer:
      "Poti solicita certificatul fiscal din portal, sectiunea Certificate. Cererea se depune online, iar documentul se elibereaza electronic sau la ghiseu, in functie de politica primariei.",
    keywords: ["certificat fiscal", "certificat atestare", "eliberare", "cerere"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "fiscal-certificate-time",
    question: "Cat dureaza eliberarea certificatului fiscal?",
    answer:
      "Termenul de eliberare este de obicei intre 1 si 3 zile lucratoare, in functie de volumul de solicitari. Vezi statusul in portal.",
    keywords: ["durata", "termen eliberare", "status"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "tax-exemptions",
    question: "Cine poate beneficia de scutiri de impozite?",
    answer:
      "Scutirile pot include persoane cu handicap grav/accentuat, veterani, revolutionari sau alte categorii stabilite de Codul fiscal si hotararile consiliului local. Verifica eligibilitatea in portal sau la compartimentul taxe.",
    keywords: ["scutiri", "exemptii", "handicap", "veterani", "revolutionari"],
    sources: ["Codul fiscal - Titlul IX", "HCL"],
  },
  {
    id: "tax-appeal",
    question: "Cum contest o decizie de impunere?",
    answer:
      "Poti depune contestatie la organul fiscal local in termen de 45 de zile de la comunicarea deciziei. Contestatia trebuie sa includa motivele si documentele justificative.",
    keywords: ["contestatie", "decizie impunere", "45 zile", "reclamatie"],
    sources: ["Codul de procedura fiscala"],
  },
  {
    id: "contact",
    question: "Cum contactez primaria pentru taxe?",
    answer:
      "Ne poti contacta prin pagina Contact din portal, telefonic sau pe emailul publicat de primaria ta. Mesajele din portal sunt inregistrate automat.",
    keywords: ["contact", "telefon", "email", "mesaj", "suport"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "office-hours",
    question: "Care este programul de lucru cu publicul?",
    answer:
      "Programul de lucru cu publicul este afisat in pagina Contact. In general, intervalul este Luni-Vineri, 08:30-16:30, dar poate varia in functie de primaria ta.",
    keywords: ["program", "orar", "lucru", "public"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "tax-year",
    question: "Pentru ce an sunt impozitele afisate?",
    answer:
      "Impozitele sunt afisate pentru anul fiscal curent. In portal poti vedea si obligatiile restante din anii precedenti.",
    keywords: ["an fiscal", "an curent", "restante"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "ownership-changes",
    question: "Ce fac daca am vandut sau cumparat o proprietate?",
    answer:
      "Dupa vanzare sau cumparare, trebuie sa depui declaratia de impunere in termen de 30 de zile, cu actele de proprietate si documentele cadastrale. Impozitul se actualizeaza in baza declaratiei.",
    keywords: ["vanzare", "cumparare", "declaratie", "actualizare"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "payment-confirmation",
    question: "Cum verific daca plata a fost inregistrata?",
    answer:
      "In portal, la sectiunea Plati, poti vedea istoricul si statusul platilor. Daca ai platit prin banca, procesarea poate dura 1-3 zile lucratoare.",
    keywords: ["verificare plata", "status", "istoric", "confirmare"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "property-tax-calc",
    question: "Cum se calculeaza impozitul pe cladiri?",
    answer:
      "Impozitul pe cladiri se calculeaza pe baza valorii impozabile, a destinatiei (rezidentiala/nerezidentiala/mixta) si a cotelor stabilite prin hotararea consiliului local.",
    keywords: ["calcul impozit", "cladiri", "valoare impozabila", "cota"],
    sources: ["Codul fiscal - Titlul IX", "HCL"],
  },
  {
    id: "land-tax-calc",
    question: "Cum se calculeaza impozitul pe teren?",
    answer:
      "Impozitul pe teren depinde de categoria de folosinta, zona fiscala si suprafata declarata, conform grilelor locale.",
    keywords: ["calcul impozit", "teren", "zona fiscala", "suprafata"],
    sources: ["Codul fiscal - Titlul IX", "HCL"],
  },
  {
    id: "vehicle-tax-calc",
    question: "Cum se calculeaza impozitul pe vehicule?",
    answer:
      "Impozitul pe vehicule se stabileste in functie de capacitatea cilindrica si tipul vehiculului, conform cotelor stabilite prin hotararea consiliului local.",
    keywords: ["calcul impozit", "vehicule", "capacitate cilindrica", "motor"],
    sources: ["Codul fiscal - Titlul IX", "HCL"],
  },
  {
    id: "tax-assessment-notice",
    question: "Cand primesc decizia de impunere?",
    answer:
      "Decizia de impunere se emite dupa prelucrarea declaratiei si este disponibila in portal sau comunicata prin posta, in functie de optiunile primariei.",
    keywords: ["decizie impunere", "emitere", "comunicare"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "tax-certificate-needed",
    question: "Cand am nevoie de certificat fiscal?",
    answer:
      "Certificatul fiscal este necesar, de regula, la vanzarea unei proprietati, la succesiune sau la diverse proceduri administrative. Il poti solicita din portal.",
    keywords: ["cand", "nevoie", "certificat fiscal", "vanzare", "succesiune"],
    sources: ["Codul fiscal - Titlul IX"],
  },
  {
    id: "support-issues",
    question: "Ce fac daca am o problema cu contul din portal?",
    answer:
      "Daca ai probleme cu autentificarea sau datele contului, foloseste formularul de contact din portal sau solicita asistenta la ghiseu.",
    keywords: ["cont", "autentificare", "probleme", "asistenta"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "documents-upload",
    question: "Pot incarca documente direct in portal?",
    answer:
      "Da. Pentru anumite cereri (ex: certificat fiscal), poti incarca documente justificative direct in portal, unde sunt pastrate in siguranta.",
    keywords: ["incarcare", "documente", "upload", "portal"],
    sources: ["Portal PrimarIA"],
  },
  {
    id: "deadlines-reminders",
    question: "Primesc notificari pentru scadente?",
    answer:
      "Da, portalul poate trimite notificari pentru scadente si plati. Asigura-te ca ai emailul si numarul de telefon actualizate in profil.",
    keywords: ["notificari", "reminder", "scadenta", "email"],
    sources: ["Portal PrimarIA"],
  },
];
