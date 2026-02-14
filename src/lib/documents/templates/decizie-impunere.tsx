import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { DecizieImpunereData, ImpozitLineEnhanced } from "../types";

/**
 * Decizie de impunere — Tax assessment decision.
 * Per CPF Art. 46-49: shows property, calculated tax, installments, legal basis, appeal instructions.
 * Romanian only (Constituție Art. 13).
 */
export function DecizieImpunerePDF({ data }: { data: DecizieImpunereData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.institutionName}>{data.tenant.name}</Text>
            <Text style={styles.headerInfo}>CIF: {data.tenant.cui}</Text>
            <Text style={styles.headerInfo}>{data.tenant.address}</Text>
            <Text style={styles.headerInfo}>Jud. {data.tenant.county}</Text>
            {data.tenant.phone && (
              <Text style={styles.headerInfo}>Tel: {data.tenant.phone}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerInfo}>Nr. {data.documentNumber}</Text>
            <Text style={styles.headerInfo}>Data: {data.documentDate}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Decizie de Impunere</Text>
        <Text style={styles.subtitle}>
          pentru anul fiscal {data.fiscalYear}
        </Text>

        {/* Taxpayer info */}
        <View style={styles.sectionTitle}>
          <Text>I. Date contribuabil</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nume/Denumire:</Text>
          <Text style={styles.infoValue}>
            {data.contribuabil.nume}
            {data.contribuabil.prenume ? ` ${data.contribuabil.prenume}` : ""}
          </Text>
        </View>
        {data.contribuabil.cnpMasked && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CNP:</Text>
            <Text style={styles.infoValue}>{data.contribuabil.cnpMasked}</Text>
          </View>
        )}
        {data.contribuabil.cui && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CUI:</Text>
            <Text style={styles.infoValue}>{data.contribuabil.cui}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Adresă:</Text>
          <Text style={styles.infoValue}>{data.contribuabil.adresa}</Text>
        </View>
        {data.contribuabil.codRol && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cod rol:</Text>
            <Text style={styles.infoValue}>{data.contribuabil.codRol}</Text>
          </View>
        )}

        {/* Tax lines */}
        <View style={styles.sectionTitle}>
          <Text>II. Impozite și taxe locale stabilite</Text>
        </View>
        <Text style={styles.bodyText}>
          În temeiul {data.legalBasis}, al H.C.L. nr. {data.hclNumber} din{" "}
          {data.hclDate}, vă comunicăm impozitele și taxele locale stabilite
          pentru anul fiscal {data.fiscalYear}:
        </Text>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: "20%" }]}>
              Tip impozit
            </Text>
            <Text style={[styles.tableCellHeader, { width: "20%" }]}>
              Proprietate
            </Text>
            <Text style={[styles.tableCellHeader, { width: "12%", textAlign: "right" }]}>
              Baza imp.
            </Text>
            <Text style={[styles.tableCellHeader, { width: "10%", textAlign: "right" }]}>
              Rată
            </Text>
            <Text style={[styles.tableCellHeader, { width: "12%", textAlign: "right" }]}>
              Calculat
            </Text>
            <Text style={[styles.tableCellHeader, { width: "12%", textAlign: "right" }]}>
              Scutire
            </Text>
            <Text style={[styles.tableCellHeader, { width: "14%", textAlign: "right" }]}>
              Datorat
            </Text>
          </View>
          {data.lines.map((line, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: "20%" }]}>
                {line.taxTypeName}
              </Text>
              <Text style={[styles.tableCell, { width: "20%" }]}>
                {line.propertyDescription}
              </Text>
              <Text style={[styles.tableCellRight, { width: "12%" }]}>
                {line.bazaImpozabila}
              </Text>
              <Text style={[styles.tableCellRight, { width: "10%" }]}>
                {line.rataAplicata}
              </Text>
              <Text style={[styles.tableCellRight, { width: "12%" }]}>
                {line.sumaCalculata}
              </Text>
              <Text style={[styles.tableCellRight, { width: "12%" }]}>
                {line.sumaScutire}
              </Text>
              <Text style={[styles.tableCellRight, { width: "14%" }]}>
                {line.sumaDatorata}
              </Text>
            </View>
          ))}
          <View style={styles.tableRowTotal}>
            <Text
              style={[styles.tableCellHeader, { width: "86%", textAlign: "right" }]}
            >
              TOTAL DATORAT:
            </Text>
            <Text
              style={[styles.tableCellHeader, { width: "14%", textAlign: "right" }]}
            >
              {data.totalDatorat}
            </Text>
          </View>
        </View>

        {/* Rate justification per line */}
        {data.lines.some((l: ImpozitLineEnhanced) => l.articleReference || l.hclReference) && (
          <>
            <View style={styles.sectionTitle}>
              <Text>Temei legal per proprietate</Text>
            </View>
            {data.lines.map((line: ImpozitLineEnhanced, i: number) => (
              (line.articleReference || line.hclReference) ? (
                <Text style={styles.bodyText} key={`ref-${i}`}>
                  • {line.propertyDescription}: {line.articleReference ?? ""}{" "}
                  {line.hclReference ? `(${line.hclReference})` : ""}
                </Text>
              ) : null
            ))}
          </>
        )}

        {/* Installments — 4-installment schedule */}
        <View style={styles.sectionTitle}>
          <Text>III. Termene de plată</Text>
        </View>
        <Text style={styles.bodyText}>
          Impozitul se plătește în patru rate, conform art. 462 Cod Fiscal:
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rata I — {data.installments.rata1Scadenta}:</Text>
          <Text style={styles.infoValue}>{data.installments.rata1} lei</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rata II — {data.installments.rata2Scadenta}:</Text>
          <Text style={styles.infoValue}>{data.installments.rata2} lei</Text>
        </View>
        {data.installments.rata3 && data.installments.rata3Scadenta && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rata III — {data.installments.rata3Scadenta}:</Text>
            <Text style={styles.infoValue}>{data.installments.rata3} lei</Text>
          </View>
        )}
        {data.installments.rata4 && data.installments.rata4Scadenta && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rata IV — {data.installments.rata4Scadenta}:</Text>
            <Text style={styles.infoValue}>{data.installments.rata4} lei</Text>
          </View>
        )}
        <Text style={[styles.bodyText, { marginTop: 5 }]}>
          <Text style={styles.boldText}>Total anual: {data.totalDatorat} lei</Text>
        </Text>
        <Text style={styles.bodyText}>
          Bonificație: Dacă plătiți integral până la data de{" "}
          {data.installments.rata1Scadenta}, beneficiați de o reducere de{" "}
          {data.installments.bonificatie} lei (10% conform art. 462 alin. 2 Cod
          Fiscal).
        </Text>

        {/* Penalties warning */}
        <View style={styles.sectionTitle}>
          <Text>IV. Consecințele neplății la termen</Text>
        </View>
        <Text style={styles.bodyText}>
          Neplata la termenele stabilite atrage calcularea de majorări de
          întârziere conform art. 174-176 din Legea nr. 207/2015 privind Codul
          de procedură fiscală, în cuantum de 0,01% pe fiecare zi de întârziere.
        </Text>

        {/* Appeal instructions (CPF Art. 268-281) */}
        <View style={styles.sectionTitle}>
          <Text>V. Căi de atac</Text>
        </View>
        <Text style={styles.bodyText}>
          Împotriva prezentei decizii se poate formula contestație în termen de
          45 de zile de la data comunicării, conform art. 268-281 din Legea
          nr. 207/2015 privind Codul de procedură fiscală. Contestația se depune
          la organul fiscal emitent — {data.tenant.name}.
        </Text>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>ORDONATOR DE CREDITE</Text>
            <Text style={styles.signatureName}>Primar</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura și ștampila</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>COMPARTIMENT DE SPECIALITATE</Text>
            <Text style={styles.signatureName}>Inspector taxe și impozite</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura</Text>
          </View>
        </View>

        {/* QES placeholder */}
        <View style={styles.qesPlaceholder}>
          <Text style={styles.qesText}>
            Spațiu rezervat semnăturii electronice calificate (QES)
          </Text>
          <Text style={styles.qesText}>
            Documentul va fi semnat electronic conform Reg. (UE) nr. 910/2014
            (eIDAS)
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {data.tenant.name} | CIF: {data.tenant.cui} | {data.tenant.address} |{" "}
          {data.tenant.phone ?? ""} | {data.tenant.email ?? ""}
        </Text>
      </Page>
    </Document>
  );
}
