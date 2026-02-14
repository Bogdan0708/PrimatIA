// Fiscal Knowledge Base — Romanian Fiscal Code (Codul Fiscal) & Fiscal Procedure Code (CPF)
// Comprehensive entries for NL search

export interface FiscalEntry {
  article: string;
  title: string;
  content: string;
  keywords: string[];
  category: string;
}

export const FISCAL_ENTRIES: FiscalEntry[] = [
  // =========================================================================
  // IMPOZIT PE CLĂDIRI (Art. 455-463)
  // =========================================================================
  {
    article: "Art. 455",
    title: "Reguli generale privind impozitul pe clădiri",
    content:
      "Orice persoană care deține o clădire situată în România datorează impozit pe clădiri. Impozitul se datorează de la data de 1 ianuarie a anului următor celui în care clădirea a fost dobândită sau construită. Pentru clădirile noi, impozitul se datorează de la data de 1 ianuarie a anului următor finalizării.",
    keywords: ["impozit cladiri", "cladire", "proprietar", "detinator", "reguli generale", "datorare impozit"],
    category: "cladiri",
  },
  {
    article: "Art. 456",
    title: "Calculul impozitului pe clădiri pentru persoane fizice",
    content:
      "Pentru persoanele fizice, impozitul pe clădiri se calculează prin aplicarea cotei de 0,08%-0,2% asupra valorii impozabile. Valoarea se determină pe baza suprafeței construite desfășurate, tipul construcției, rangul localității și zona fiscală. Se aplică corecții pentru vetustețe (vechimea clădirii) și dotări (instalații de apă, canalizare, electricitate, încălzire).",
    keywords: ["calcul impozit", "persoane fizice", "cota", "valoare impozabila", "suprafata", "vetustete", "dotari", "instalatii"],
    category: "cladiri",
  },
  {
    article: "Art. 457",
    title: "Calculul impozitului pe clădiri pentru persoane juridice",
    content:
      "Pentru persoanele juridice, impozitul pe clădiri se calculează prin aplicarea cotei de 0,2%-1,3% asupra valorii de inventar (valoarea contabilă rezultată din actul de proprietate sau evaluare). Dacă nu a fost efectuată o reevaluare în ultimii 5 ani, cota se majorează la 5%.",
    keywords: ["persoane juridice", "firma", "societate", "valoare inventar", "reevaluare", "cota majorata", "5%", "valoare contabila"],
    category: "cladiri",
  },
  {
    article: "Art. 458",
    title: "Clădiri cu destinație mixtă",
    content:
      "Pentru clădirile cu destinație mixtă (rezidențial + comercial), impozitul se calculează separat pentru fiecare destinație, proporțional cu suprafața utilizată. Dacă nu se pot delimita suprafețele, se aplică cota cea mai mare.",
    keywords: ["destinatie mixta", "rezidential", "comercial", "proportional", "suprafata utilizata"],
    category: "cladiri",
  },
  {
    article: "Art. 456 alin. 2",
    title: "Coeficienți de corecție pentru clădiri",
    content:
      "Valoarea impozabilă se ajustează cu coeficienți de corecție: rang localitate (0-I: 2.40, II: 2.20, III: 2.00, IV: 1.10, V: 1.00), zona fiscală (A, B, C, D cu procente diferite), și coeficient de vetustețe bazat pe anul finalizării construcției.",
    keywords: ["coeficient", "corectie", "rang localitate", "zona fiscala", "zona A", "zona B", "zona C", "zona D", "vetustete", "ajustare"],
    category: "cladiri",
  },
  {
    article: "Art. 459",
    title: "Scutiri de la impozitul pe clădiri",
    content:
      "Sunt scutite de impozit clădirile: statului și UAT-urilor (utilizate pentru activități proprii), instituțiilor publice, cultelor religioase, instituțiilor de învățământ, spitalelor publice, monumentelor istorice clasate, clădirilor persoanelor cu handicap grav sau accentuat, veteranilor de război, văduvelor de război, eroilor Revoluției.",
    keywords: ["scutire", "scutit", "exceptie", "handicap", "veteran", "revolutie", "monument", "cult religios", "invatamant", "spital"],
    category: "cladiri",
  },
  {
    article: "Art. 460",
    title: "Reduceri de impozit pe clădiri",
    content:
      "Consiliul local poate acorda reduceri de până la 50% pentru clădiri: situate în localități cu declin economic, care necesită reabilitare termică (după finalizare). De asemenea, se aplică majorarea cu 500% pentru clădirile neîngrijite situate în intravilanul localităților.",
    keywords: ["reducere", "50%", "reabilitare termica", "declin economic", "majorare", "500%", "neingrijit", "intravilan"],
    category: "cladiri",
  },
  {
    article: "Art. 462",
    title: "Declararea clădirilor",
    content:
      "Proprietarii clădirilor au obligația de a depune declarația de impunere în termen de 30 de zile de la data dobândirii. Declarația se depune la organul fiscal local în raza căruia se află clădirea. Modificările privind clădirea (extindere, demolare, schimbare destinație) se declară în același termen.",
    keywords: ["declaratie", "declarare", "30 zile", "impunere", "obligatie", "dobandire", "organ fiscal"],
    category: "cladiri",
  },
  {
    article: "Art. 463",
    title: "Plata impozitului pe clădiri",
    content:
      "Impozitul pe clădiri se plătește anual, în două rate egale: până la 31 martie (rata I) și până la 30 septembrie (rata II). Pentru plata integrală până la 31 martie se acordă bonificație de până la 10%, stabilită prin HCL.",
    keywords: ["plata", "rate", "31 martie", "30 septembrie", "bonificatie", "10%", "HCL", "anual", "termen"],
    category: "cladiri",
  },

  // =========================================================================
  // IMPOZIT PE TEREN (Art. 464-467)
  // =========================================================================
  {
    article: "Art. 464",
    title: "Reguli generale privind impozitul pe teren",
    content:
      "Orice persoană care deține teren în România datorează impozit pe teren. Impozitul se stabilește anual, pe baza suprafeței terenului, categoriei de folosință, rangului localității și zonei fiscale. Terenurile se clasifică în: intravilan (construcții, arabil, luciu de apă) și extravilan.",
    keywords: ["impozit teren", "teren", "suprafata", "categorie folosinta", "intravilan", "extravilan", "rang", "zona"],
    category: "teren",
  },
  {
    article: "Art. 465",
    title: "Calculul impozitului pe teren intravilan",
    content:
      "Impozitul pe teren intravilan se calculează pe baza: suprafeței (mp), rangul localității (0-V), zona fiscală (A-D) și coeficientul de corecție. Pentru teren intravilan cu construcții, se aplică tarife diferite față de teren arabil intravilan. Tarifele sunt stabilite în lei/mp/an.",
    keywords: ["teren intravilan", "calcul", "lei pe mp", "tarif", "constructii", "arabil", "intravilan"],
    category: "teren",
  },
  {
    article: "Art. 465 alin. 2",
    title: "Calculul impozitului pe teren extravilan",
    content:
      "Impozitul pe teren extravilan se calculează pe baza categoriei de folosință: arabil, pășune, fâneață, vie, livadă, pădure, ape, drumuri, neproductiv. Tarifele sunt în lei/ha/an și variază în funcție de zona fiscală (I-IV pentru extravilan).",
    keywords: ["teren extravilan", "arabil", "pasune", "faneata", "vie", "livada", "padure", "hectar", "ha", "neproductiv"],
    category: "teren",
  },
  {
    article: "Art. 466",
    title: "Scutiri de la impozitul pe teren",
    content:
      "Sunt scutite de impozit terenurile: din domeniul public/privat al statului și UAT, cele folosite de culte religioase, instituții de învățământ, cimitire, terenuri cu monumente istorice, terenuri ale persoanelor cu handicap grav, veteranilor de război. Consiliul local poate acorda scutiri suplimentare.",
    keywords: ["scutire teren", "exceptie", "handicap", "veteran", "cimitir", "monument", "domeniul public"],
    category: "teren",
  },
  {
    article: "Art. 467",
    title: "Plata și declararea impozitului pe teren",
    content:
      "Impozitul pe teren se plătește anual, în două rate: 31 martie și 30 septembrie. Declarația se depune în 30 de zile de la dobândire. Bonificație de până la 10% pentru plata integrală anticipată. Modificările (schimbare categorie, dezmembrare) se declară în 30 zile.",
    keywords: ["plata teren", "declaratie teren", "31 martie", "30 septembrie", "bonificatie", "30 zile", "dezmembrare"],
    category: "teren",
  },

  // =========================================================================
  // IMPOZIT PE MIJLOACE DE TRANSPORT (Art. 468-472)
  // =========================================================================
  {
    article: "Art. 468",
    title: "Reguli generale privind impozitul pe vehicule",
    content:
      "Orice persoană care deține un vehicul înmatriculat sau înregistrat în România datorează impozit. Impozitul se calculează în funcție de tipul vehiculului și capacitatea cilindrică (cm³). Vehiculele se clasifică în: autoturisme, autobuze, camioane, motociclete, etc.",
    keywords: ["impozit vehicul", "vehicul", "auto", "autoturism", "capacitate cilindrica", "cm3", "inmatriculare"],
    category: "vehicule",
  },
  {
    article: "Art. 469",
    title: "Calculul impozitului pentru autoturisme",
    content:
      "Impozitul pe autoturisme se calculează în lei/200 cm³ sau fracțiune. Tarifele variază: până la 1600 cm³ (cel mai mic tarif), 1601-2000, 2001-2600, 2601-3000, peste 3000 cm³ (cel mai mare tarif). Se aplică un coeficient de corecție bazat pe anul fabricației.",
    keywords: ["autoturism", "cilindree", "200 cm3", "tarif auto", "an fabricatie", "motor", "capacitate"],
    category: "vehicule",
  },
  {
    article: "Art. 469 alin. 2",
    title: "Impozit vehicule de marfă și speciale",
    content:
      "Autovehiculele de transport marfă cu masa totală autorizată peste 12 tone se impozitează pe baza numărului de axe și tipul suspensiei (pneumatică sau alte tipuri). Vehiculele speciale (automacarale, buldozere) au tarife fixe.",
    keywords: ["transport marfa", "camion", "12 tone", "axe", "suspensie", "pneumatica", "vehicul special", "automacara", "buldozer"],
    category: "vehicule",
  },
  {
    article: "Art. 469 alin. 3",
    title: "Impozit motociclete, remorci și bărci",
    content:
      "Motocicletele se impozitează pe baza capacității cilindrice, similar autoturismelor. Remorcile se impozitează în funcție de masa totală autorizată. Ambarcațiunile (bărci cu motor, yacht) se impozitează pe baza lungimii sau puterii motorului.",
    keywords: ["motocicleta", "remorca", "barca", "yacht", "ambarcatiune", "motor", "lungime"],
    category: "vehicule",
  },
  {
    article: "Art. 470",
    title: "Scutiri de la impozitul pe vehicule",
    content:
      "Sunt scutite: vehiculele instituțiilor publice, cele pentru transport public, ambulanțele, vehiculele pompierilor, vehiculele persoanelor cu handicap, autoturismele electrice, vehiculele istorice (peste 30 ani). Consiliul local poate acorda scutiri suplimentare.",
    keywords: ["scutire vehicul", "electric", "handicap", "ambulanta", "pompieri", "vehicul istoric", "transport public"],
    category: "vehicule",
  },
  {
    article: "Art. 471",
    title: "Declararea vehiculelor",
    content:
      "Declarația se depune în 30 de zile de la dobândire (cumpărare, moștenire, donație). La înstrăinare, se depune declarație de scoatere din evidență. Impozitul se datorează proporțional cu perioada în care vehiculul a fost deținut.",
    keywords: ["declaratie vehicul", "30 zile", "dobandire", "instrainare", "scoatere evidenta", "proportional"],
    category: "vehicule",
  },
  {
    article: "Art. 472",
    title: "Plata impozitului pe vehicule",
    content:
      "Impozitul pe vehicule se plătește anual, în două rate egale: 31 martie și 30 septembrie. Bonificație de până la 10% pentru plata integrală. Este necesar certificatul fiscal (fără datorii) pentru orice operațiune de înstrăinare.",
    keywords: ["plata vehicul", "31 martie", "30 septembrie", "bonificatie", "certificat fiscal", "instrainare"],
    category: "vehicule",
  },

  // =========================================================================
  // TAXE LOCALE (Art. 474-490)
  // =========================================================================
  {
    article: "Art. 474",
    title: "Taxa pentru servicii de reclamă și publicitate",
    content:
      "Taxa pentru afișaj în scop de reclamă și publicitate se stabilește de consiliul local. Se aplică pentru panouri, firme, bannere amplasate pe domeniul public sau privat. Taxa anuală se calculează pe mp de suprafață afișaj.",
    keywords: ["reclama", "publicitate", "afisaj", "panou", "firma", "banner", "taxa publicitate"],
    category: "taxe_locale",
  },
  {
    article: "Art. 475",
    title: "Impozitul pe spectacole",
    content:
      "Organizatorii de spectacole datorează impozit pe spectacole calculat prin aplicarea unei cote de 2% (spectacole de teatru, muzică) sau 5% (alte spectacole) asupra încasărilor din vânzarea biletelor.",
    keywords: ["spectacol", "bilet", "teatru", "muzica", "concert", "impozit spectacole", "organizator"],
    category: "taxe_locale",
  },
  {
    article: "Art. 478",
    title: "Taxa hotelieră",
    content:
      "Taxa hotelieră (taxa de stațiune) se stabilește de consiliul local. Se aplică persoanelor care nu domiciliază în localitatea respectivă și care beneficiază de cazare. Taxa este de maximum 1% din tariful de cazare pe noapte.",
    keywords: ["taxa hoteliera", "hotel", "cazare", "statiune", "turism", "noapte"],
    category: "taxe_locale",
  },
  {
    article: "Art. 484",
    title: "Alte taxe locale",
    content:
      "Consiliul local poate institui taxe pentru: utilizarea temporară a domeniului public, vizitarea monumentelor, folosirea parcajelor publice, eliberarea autorizațiilor de construire, eliberarea certificatelor de urbanism. Nivelul taxelor se stabilește prin HCL.",
    keywords: ["taxa locala", "domeniu public", "parcaj", "autorizatie construire", "certificat urbanism", "HCL", "monument"],
    category: "taxe_locale",
  },
  {
    article: "Art. 486",
    title: "Taxa pentru eliberarea certificatelor și autorizațiilor",
    content:
      "Se percepe taxă pentru: certificat de urbanism, autorizație de construire/desființare, autorizație de foraje, certificate de nomenclatură stradală. Cuantumul taxei depinde de valoarea lucrării sau suprafața construcției.",
    keywords: ["certificat", "autorizatie", "urbanism", "construire", "foraje", "nomenclatura stradala", "taxa eliberare"],
    category: "taxe_locale",
  },
  {
    article: "Art. 490",
    title: "Facilități fiscale acordate de consiliul local",
    content:
      "Consiliul local poate acorda scutiri sau reduceri de impozite și taxe locale pentru: persoane fizice ale căror venituri lunare sunt sub salariul minim, contribuabili afectați de calamități naturale, investiții de interes local. Facilitățile se stabilesc prin HCL.",
    keywords: ["facilitati", "scutire", "reducere", "HCL", "calamitate", "venituri mici", "salariu minim", "investitie"],
    category: "taxe_locale",
  },

  // =========================================================================
  // PROCEDURA FISCALĂ (Art. 1-50 CPF)
  // =========================================================================
  {
    article: "Art. 1-5 CPF",
    title: "Principii generale ale procedurii fiscale",
    content:
      "Codul de procedură fiscală reglementează drepturile și obligațiile contribuabililor și organelor fiscale. Principii: legalitate, aplicare unitară, exercitarea dreptului de apreciere, rolul activ al organului fiscal, limba oficială (română), dreptul de a fi ascultat.",
    keywords: ["procedura fiscala", "principii", "legalitate", "drept apreciere", "rol activ", "limba romana"],
    category: "procedura",
  },
  {
    article: "Art. 7 CPF",
    title: "Domiciliul fiscal",
    content:
      "Domiciliul fiscal este locul unde contribuabilul își are domiciliul sau sediul social. Pentru persoanele fizice, domiciliul fiscal este adresa din actul de identitate. Schimbarea domiciliului fiscal se comunică organului fiscal în 30 de zile.",
    keywords: ["domiciliu fiscal", "sediu social", "adresa", "schimbare domiciliu", "30 zile"],
    category: "procedura",
  },
  {
    article: "Art. 17-18 CPF",
    title: "Competența organelor fiscale locale",
    content:
      "Organele fiscale locale (primăriile) administrează impozitele și taxele locale. Competența se stabilește în funcție de domiciliul fiscal al contribuabilului sau locul unde se află bunul impozabil. În cazul clădirilor/terenurilor, competent este organul în raza căruia se află bunul.",
    keywords: ["competenta", "organ fiscal", "primarie", "local", "administrare", "bun impozabil", "raza"],
    category: "procedura",
  },
  {
    article: "Art. 40-46 CPF",
    title: "Actul administrativ fiscal",
    content:
      "Actul administrativ fiscal (decizie de impunere, somație, etc.) se emite în formă scrisă, conține motivele de fapt și de drept, și se comunică contribuabilului. Comunicarea se face prin: poștă cu confirmare, remitere directă, sau mijloace electronice.",
    keywords: ["act administrativ", "decizie impunere", "somatie", "comunicare", "posta", "electronic", "forma scrisa"],
    category: "procedura",
  },

  // =========================================================================
  // PLĂȚI ȘI PENALITĂȚI (Art. 156-182)
  // =========================================================================
  {
    article: "Art. 156 CPF",
    title: "Termenele de plată",
    content:
      "Impozitele și taxele locale se plătesc în două rate: 31 martie și 30 septembrie. Dacă termenul cade într-o zi nelucrătoare, acesta se prelungește până în prima zi lucrătoare. Plata se consideră efectuată la data debitării contului bancar sau la data încasării la casierie.",
    keywords: ["termen plata", "31 martie", "30 septembrie", "zi nelucratoare", "data platii", "debitare", "casierie"],
    category: "plati",
  },
  {
    article: "Art. 157 CPF",
    title: "Bonificații pentru plata anticipată",
    content:
      "Pentru plata cu anticipație a impozitului anual, până la data de 31 martie, se acordă o bonificație de până la 10%, stabilită prin hotărârea consiliului local. Bonificația se aplică automat la momentul plății.",
    keywords: ["bonificatie", "plata anticipata", "10%", "31 martie", "HCL", "reducere"],
    category: "plati",
  },
  {
    article: "Art. 173 CPF",
    title: "Dobânzi pentru plata cu întârziere",
    content:
      "Pentru neachitarea la termen a obligațiilor fiscale se datorează dobânzi. Nivelul dobânzii este de 0,02% pe zi de întârziere (aprox. 7,3% pe an). Dobânda se calculează de la data scadenței până la data plății inclusiv.",
    keywords: ["dobanda", "intarziere", "0.02%", "zi", "scadenta", "penalizare", "accesorii"],
    category: "plati",
  },
  {
    article: "Art. 176 CPF",
    title: "Penalități de întârziere",
    content:
      "Pe lângă dobânzi, se datorează penalități de întârziere de 0,01% pe zi. Penalitatea se calculează asupra obligațiilor fiscale principale neachitate la scadență. Total accesorii: 0,03% pe zi (dobândă 0,02% + penalitate 0,01%).",
    keywords: ["penalitate", "0.01%", "accesorii", "0.03%", "penalitate intarziere", "obligatie principala"],
    category: "plati",
  },
  {
    article: "Art. 178 CPF",
    title: "Prescripția dreptului de a cere executarea silită",
    content:
      "Dreptul organului fiscal de a cere executarea silită a creanțelor fiscale se prescrie în termen de 5 ani de la data de 1 ianuarie a anului următor celui în care a luat naștere dreptul. Prescripția se întrerupe prin acte de executare sau recunoașterea datoriei.",
    keywords: ["prescriptie", "5 ani", "executare silita", "creanta fiscala", "intrerupere", "recunoastere datorie"],
    category: "plati",
  },
  {
    article: "Art. 181-182 CPF",
    title: "Eșalonarea la plată",
    content:
      "Contribuabilii pot solicita eșalonarea la plată a obligațiilor fiscale restante. Cererea se depune la organul fiscal competent. Condițiile: suma minimă, garanții, lipsa cazierului fiscal. Eșalonarea se acordă pe maximum 5 ani. Pe durata eșalonării nu se calculează penalități noi.",
    keywords: ["esalonare", "rate", "plata esalonata", "cerere", "garantii", "5 ani", "restante"],
    category: "plati",
  },

  // =========================================================================
  // EXECUTARE SILITĂ (Art. 220-260 CPF)
  // =========================================================================
  {
    article: "Art. 220-221 CPF",
    title: "Condiții pentru executarea silită",
    content:
      "Executarea silită începe după: emiterea titlului executoriu (decizia de impunere devenită exigibilă), comunicarea somației către debitor, și expirarea termenului de 15 zile de la comunicarea somației. Somația cuprinde suma datorată, accesoriile și termenul de plată.",
    keywords: ["executare silita", "titlu executoriu", "somatie", "15 zile", "debitor", "exigibil"],
    category: "executare",
  },
  {
    article: "Art. 226 CPF",
    title: "Poprirea conturilor bancare",
    content:
      "Organul fiscal poate institui poprire asupra conturilor bancare ale debitorului. Banca este obligată să blocheze și să vireze sumele datorate. Poprirea se comunică simultan debitorului și băncii. Sunt exceptate sumele destinate plății salariilor.",
    keywords: ["poprire", "cont bancar", "banca", "blocare", "virare", "salariu", "exceptie"],
    category: "executare",
  },
  {
    article: "Art. 238 CPF",
    title: "Sechestrul asupra bunurilor mobile",
    content:
      "Organul fiscal poate aplica sechestru asupra bunurilor mobile ale debitorului (vehicule, utilaje, etc.). Bunurile sechestrate se inventariază și se evaluează. Debitorul este numit administrator-sechestru. Bunurile se valorifică prin licitație publică.",
    keywords: ["sechestru", "bunuri mobile", "inventar", "evaluare", "licitatie", "administrator sechestru"],
    category: "executare",
  },
  {
    article: "Art. 242 CPF",
    title: "Sechestrul asupra bunurilor imobile",
    content:
      "Executarea silită imobiliară se aplică pentru creanțe fiscale semnificative. Sechestrul se înscrie în cartea funciară. Imobilul se evaluează și se valorifică prin licitație publică. Debitorul poate locui în continuare în imobil până la adjudecare.",
    keywords: ["sechestru imobil", "carte funciara", "licitatie", "adjudecare", "imobil", "executare imobiliara"],
    category: "executare",
  },
  {
    article: "Art. 250 CPF",
    title: "Suspendarea executării silite",
    content:
      "Executarea silită se suspendă: la cererea debitorului cu constituirea unei garanții, prin hotărâre judecătorească, în cazul deschiderii procedurii insolvenței, sau dacă debitorul obține eșalonare la plată.",
    keywords: ["suspendare executare", "garantie", "hotarare judecatoreasca", "insolventa", "esalonare"],
    category: "executare",
  },

  // =========================================================================
  // CONTESTAȚII (Art. 268-281 CPF)
  // =========================================================================
  {
    article: "Art. 268 CPF",
    title: "Dreptul la contestație",
    content:
      "Orice contribuabil care se consideră lezat printr-un act administrativ fiscal poate formula contestație. Contestația se depune la organul fiscal emitent în termen de 45 de zile de la comunicarea actului. Contestația nu suspendă executarea actului.",
    keywords: ["contestatie", "45 zile", "act administrativ", "lezat", "organ emitent", "drept contestatie"],
    category: "contestatii",
  },
  {
    article: "Art. 270 CPF",
    title: "Conținutul contestației",
    content:
      "Contestația trebuie să conțină: datele de identificare ale contestatarului, actul contestat, motivele de fapt și de drept, dovezile pe care se bazează, și semnătura. Se pot atașa documente justificative. Contestația se depune în scris.",
    keywords: ["continut contestatie", "motive", "dovezi", "documente", "semnatura", "identificare", "scris"],
    category: "contestatii",
  },
  {
    article: "Art. 274 CPF",
    title: "Soluționarea contestației",
    content:
      "Contestația se soluționează de organul fiscal competent în termen de 45 de zile. Soluțiile posibile: admiterea totală sau parțială (desființarea/modificarea actului), respingerea contestației, sau clasarea (retragere, lipsă calitate). Decizia de soluționare este ea însăși un act administrativ fiscal.",
    keywords: ["solutionare", "admitere", "respingere", "clasare", "45 zile", "decizie solutionare", "desfiintare"],
    category: "contestatii",
  },
  {
    article: "Art. 281 CPF",
    title: "Acțiunea în instanță",
    content:
      "Dacă contestația este respinsă, contribuabilul poate contesta decizia la instanța de contencios administrativ în termen de 6 luni de la comunicare. Acțiunea se introduce la tribunalul în raza căruia se află sediul organului fiscal.",
    keywords: ["instanta", "contencios administrativ", "tribunal", "6 luni", "actiune", "judecata", "respingere"],
    category: "contestatii",
  },
  {
    article: "Art. 278 CPF",
    title: "Suspendarea executării actului contestat",
    content:
      "Instanța de contencios poate dispune suspendarea executării actului fiscal contestat dacă contribuabilul depune o cauțiune de 10-33% din suma contestată. Suspendarea durează până la soluționarea definitivă a cauzei.",
    keywords: ["suspendare executare", "cautiune", "10%", "33%", "contencios", "suspendare act", "instanta"],
    category: "contestatii",
  },
];
