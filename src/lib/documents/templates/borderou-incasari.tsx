import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { BordeRouIncasariData } from "../types";

/**
 * Borderou de încasări — Daily collection summary.
 * Romanian only (Constituție Art. 13).
 */
export function BordeRouIncasariPDF({
  data,
}: {
  data: BordeRouIncasariData;
}) {
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
        <Text style={styles.title}>Borderou de Încasări</Text>
        <Text style={styles.subtitle}>
          din data de {data.documentDate}
        </Text>

        {/* Cashier info */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Casier:</Text>
          <Text style={styles.infoValue}>{data.casierName}</Text>
        </View>

        {/* Payments table */}
        <View style={[styles.table, { marginTop: 10 }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: "8%" }]}>
              Nr.
            </Text>
            <Text style={[styles.tableCellHeader, { width: "15%" }]}>
              Nr. chitanță
            </Text>
            <Text style={[styles.tableCellHeader, { width: "32%" }]}>
              Contribuabil
            </Text>
            <Text style={[styles.tableCellHeader, { width: "20%" }]}>
              Modalitate
            </Text>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "25%", textAlign: "right" },
              ]}
            >
              Sumă (lei)
            </Text>
          </View>
          {data.payments.map((p) => (
            <View style={styles.tableRow} key={p.nrCrt}>
              <Text style={[styles.tableCell, { width: "8%" }]}>
                {p.nrCrt}
              </Text>
              <Text style={[styles.tableCell, { width: "15%" }]}>
                {p.nrChitanta}
              </Text>
              <Text style={[styles.tableCell, { width: "32%" }]}>
                {p.contribuabilName}
              </Text>
              <Text style={[styles.tableCell, { width: "20%" }]}>
                {p.modalitate}
              </Text>
              <Text style={[styles.tableCellRight, { width: "25%" }]}>
                {p.suma}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.tableRowTotal}>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "75%", textAlign: "right" },
              ]}
            >
              Total numerar:
            </Text>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "25%", textAlign: "right" },
              ]}
            >
              {data.totalNumerar}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "75%", textAlign: "right" },
              ]}
            >
              Total virament/card:
            </Text>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "25%", textAlign: "right" },
              ]}
            >
              {data.totalVirament}
            </Text>
          </View>
          <View style={styles.tableRowTotal}>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "75%", textAlign: "right" },
              ]}
            >
              TOTAL GENERAL:
            </Text>
            <Text
              style={[
                styles.tableCellHeader,
                { width: "25%", textAlign: "right" },
              ]}
            >
              {data.totalGeneral}
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>CASIER</Text>
            <Text style={styles.signatureName}>{data.casierName}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>COMPARTIMENT FINANCIAR</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {data.tenant.name} | CIF: {data.tenant.cui} | {data.tenant.address}
        </Text>
      </Page>
    </Document>
  );
}
