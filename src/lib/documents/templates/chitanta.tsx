import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { ChitantaData } from "../types";

/**
 * Chitanță — Payment receipt.
 * Romanian only (Constituție Art. 13).
 */
export function ChitantaPDF({ data }: { data: ChitantaData }) {
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
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerInfo}>Nr. {data.documentNumber}</Text>
            <Text style={styles.headerInfo}>Data: {data.documentDate}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>CHITANȚĂ</Text>

        {/* Payer info */}
        <Text style={[styles.bodyText, { marginTop: 15 }]}>
          Am primit de la{" "}
          <Text style={styles.boldText}>
            {data.contribuabil.nume}
            {data.contribuabil.prenume ? ` ${data.contribuabil.prenume}` : ""}
          </Text>
          , domiciliat/cu sediul în {data.contribuabil.adresa}
          {data.contribuabil.cnpMasked
            ? `, CNP: ${data.contribuabil.cnpMasked}`
            : ""}
          {data.contribuabil.cui ? `, CUI: ${data.contribuabil.cui}` : ""}
          {data.contribuabil.codRol
            ? `, cod rol: ${data.contribuabil.codRol}`
            : ""}
          :
        </Text>

        {/* Amount */}
        <View
          style={{
            marginTop: 15,
            marginBottom: 15,
            padding: 10,
            backgroundColor: "#f5f5f5",
            borderWidth: 1,
            borderColor: "#000",
            alignItems: "center",
          }}
        >
          <Text style={styles.amountLarge}>
            Suma de: {data.suma} lei
          </Text>
          <Text style={{ fontSize: 9, marginTop: 4, fontStyle: "italic" }}>
            (adică: {data.sumaInLitere})
          </Text>
        </View>

        {/* Payment method */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Modalitate de plată:</Text>
          <Text style={styles.infoValue}>{data.modalitate}</Text>
        </View>

        {/* Distribution details */}
        {data.distributions.length > 0 && (
          <>
            <View style={styles.sectionTitle}>
              <Text>Reprezentând:</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCellHeader, { width: "8%" }]}>
                  Nr.
                </Text>
                <Text style={[styles.tableCellHeader, { width: "40%" }]}>
                  Descriere
                </Text>
                <Text style={[styles.tableCellHeader, { width: "12%" }]}>
                  An
                </Text>
                <Text
                  style={[
                    styles.tableCellHeader,
                    { width: "20%", textAlign: "right" },
                  ]}
                >
                  Debit
                </Text>
                <Text
                  style={[
                    styles.tableCellHeader,
                    { width: "20%", textAlign: "right" },
                  ]}
                >
                  Penalități
                </Text>
              </View>
              {data.distributions.map((d, i) => (
                <View style={styles.tableRow} key={i}>
                  <Text style={[styles.tableCell, { width: "8%" }]}>
                    {i + 1}
                  </Text>
                  <Text style={[styles.tableCell, { width: "40%" }]}>
                    {d.description}
                  </Text>
                  <Text style={[styles.tableCell, { width: "12%" }]}>
                    {d.fiscalYear}
                  </Text>
                  <Text style={[styles.tableCellRight, { width: "20%" }]}>
                    {d.sumaDebit}
                  </Text>
                  <Text style={[styles.tableCellRight, { width: "20%" }]}>
                    {d.sumaPenalitati}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>CASIER</Text>
            <Text style={styles.signatureName}>{data.casierName}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>CONTRIBUABIL</Text>
            <View style={[styles.signatureLine, { marginTop: 30 }]} />
            <Text style={styles.signatureLabel}>Semnătura de primire</Text>
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
          {data.tenant.name} | CIF: {data.tenant.cui} | {data.tenant.address}
        </Text>
      </Page>
    </Document>
  );
}
