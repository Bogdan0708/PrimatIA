/**
 * Default PatrimVen code mappings.
 * Maps internal PrimărIA codes to ANAF PatrimVen/DUKIntegrator codes.
 * These are seeded into patrimven_code_mappings table and can be overridden.
 */

export const DEFAULT_MAPPINGS = {
  // Building construction types → PatrimVen codes
  tip_constructie: {
    cadre_beton: { patrimvenCode: "01", descriptionRo: "Cu cadre din beton armat" },
    pereti_caramida: { patrimvenCode: "02", descriptionRo: "Cu pereți din cărămidă arsă" },
    lemn: { patrimvenCode: "03", descriptionRo: "Din lemn" },
    alte_materiale: { patrimvenCode: "04", descriptionRo: "Din alte materiale" },
  },
  // Building destination → PatrimVen codes
  destinatie: {
    rezidentiala: { patrimvenCode: "R", descriptionRo: "Rezidențială" },
    nerezidentiala: { patrimvenCode: "N", descriptionRo: "Nerezidențială" },
    mixta: { patrimvenCode: "M", descriptionRo: "Mixtă" },
  },
  // Land categories → PatrimVen codes
  categorie_teren: {
    intravilan_curti: { patrimvenCode: "01", descriptionRo: "Intravilan - curți construcții" },
    intravilan_arabil: { patrimvenCode: "02", descriptionRo: "Intravilan - arabil" },
    intravilan_pasuni: { patrimvenCode: "03", descriptionRo: "Intravilan - pășuni" },
    intravilan_paduri: { patrimvenCode: "04", descriptionRo: "Intravilan - păduri" },
    intravilan_ape: { patrimvenCode: "05", descriptionRo: "Intravilan - ape" },
    intravilan_drumuri: { patrimvenCode: "06", descriptionRo: "Intravilan - drumuri" },
    intravilan_neproductiv: { patrimvenCode: "07", descriptionRo: "Intravilan - neproductiv" },
    extravilan_arabil: { patrimvenCode: "08", descriptionRo: "Extravilan - arabil" },
    extravilan_pasuni: { patrimvenCode: "09", descriptionRo: "Extravilan - pășuni" },
    extravilan_paduri: { patrimvenCode: "10", descriptionRo: "Extravilan - păduri" },
    extravilan_ape: { patrimvenCode: "11", descriptionRo: "Extravilan - ape" },
    extravilan_drumuri: { patrimvenCode: "12", descriptionRo: "Extravilan - drumuri" },
    extravilan_neproductiv: { patrimvenCode: "13", descriptionRo: "Extravilan - neproductiv" },
  },
  // Vehicle types → PatrimVen codes
  tip_vehicul: {
    autoturism: { patrimvenCode: "01", descriptionRo: "Autoturism" },
    autobuz: { patrimvenCode: "02", descriptionRo: "Autobuz/microbuz" },
    camion: { patrimvenCode: "03", descriptionRo: "Autocamion/autoutilitară" },
    motocicleta: { patrimvenCode: "04", descriptionRo: "Motocicletă/motoretă" },
    tractor: { patrimvenCode: "05", descriptionRo: "Tractor" },
    remorca: { patrimvenCode: "06", descriptionRo: "Remorcă/semiremorcă" },
  },
  // Tax type codes for PatrimVen
  tip_impozit: {
    impozit_cladiri_rezidentiale: { patrimvenCode: "IC_R", descriptionRo: "Impozit clădiri rezidențiale" },
    impozit_cladiri_nerezidentiale: { patrimvenCode: "IC_N", descriptionRo: "Impozit clădiri nerezidențiale" },
    impozit_cladiri_mixte: { patrimvenCode: "IC_M", descriptionRo: "Impozit clădiri mixte" },
    impozit_teren_intravilan: { patrimvenCode: "IT_I", descriptionRo: "Impozit teren intravilan" },
    impozit_teren_extravilan: { patrimvenCode: "IT_E", descriptionRo: "Impozit teren extravilan" },
    impozit_teren_curti: { patrimvenCode: "IT_C", descriptionRo: "Impozit teren curți" },
    impozit_mijloace_transport: { patrimvenCode: "IMT", descriptionRo: "Impozit mijloace de transport" },
    taxa_firma: { patrimvenCode: "TF", descriptionRo: "Taxă firmă" },
    taxa_hoteliera: { patrimvenCode: "TH", descriptionRo: "Taxă hotelieră" },
    taxa_spectacole: { patrimvenCode: "TS", descriptionRo: "Taxă spectacole" },
  },
} as const;
