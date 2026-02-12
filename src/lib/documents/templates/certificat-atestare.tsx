import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { CertificatAtestareData } from "../types";

/**
 * Certificat de atestare fiscală — Fiscal certificate showing all debts/payments.
 * Romanian only (Constituție Art. 13).
 */
export function CertificatAtestarePDF({
  data,
}: {
  data: CertificatAtestareData;
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
        <Text style={styles.title}>Certificat de Atestare Fiscală</Text>
        <Text style={styles.subtitle}>
          pentru persoane {data.contribuabil.tip === "PF" ? "fizice" : "juridice"}
        </Text>

        {/* Taxpayer info */}
        <View style={styles.sectionTitle}>
          <Text>Date de identificare contribuabil</Text>
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

        {/* Purpose */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Scopul eliberării:</Text>
          <Text style={styles.infoValue}>{data.purpose}</Text>
        </View>

        {/* Certification */}
        <View style={styles.sectionTitle}>
          <Text>Situația obligațiilor fiscale</Text>
        </View>
        <Text style={styles.bodyText}>
          Se certifică prin prezentul document că contribuabilul menționat mai
          sus figurează în evidențele fiscale ale {data.tenant.name} cu
          următoarea situație a obligațiilor de plată la bugetul local:
        </Text>

        {/* Tax table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: "8%" }]}>Nr.</Text>
            <Text style={[styles.tableCellHeader, { width: "28%" }]}>
              Tip impozit/taxă
            </Text>
            <Text style={[styles.tableCellHeader, { width: "10%" }]}>An</Text>
            <Text
              style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}
            >
              Stabilit
            </Text>
            <Text
              style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}
            >
              Achitat
            </Text>
            <Text
              style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}
            >
              Restanță
            </Text>
          </View>
          {data.taxes.map((tax, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: "8%" }]}>{i + 1}</Text>
              <Text style={[styles.tableCell, { width: "28%" }]}>
                {tax.taxType}
              </Text>
              <Text style={[styles.tableCell, { width: "10%" }]}>
                {tax.fiscalYear}
              </Text>
              <Text style={[styles.tableCellRight, { width: "18%" }]}>
                {tax.sumaDatorata}
              </Text>
              <Text style={[styles.tableCellRight, { width: "18%" }]}>
                {tax.sumaPlatita}
              </Text>
              <Text style={[styles.tableCellRight, { width: "18%" }]}>
                {tax.sumaRestanta}
              </Text>
            </View>
          ))}
          <View style={styles.tableRowTotal}>
            <Text
              style={[styles.tableCellHeader, { width: "64%", textAlign: "right" }]}
            >
              TOTAL RESTANȚĂ:
            </Text>
            <Text
              style={[styles.tableCellHeader, { width: "18%" }]}
            />
            <Text
              style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}
            >
              {data.totalRestanta}
            </Text>
          </View>
        </View>

        {/* Conclusion */}
        {data.hasDebts ? (
          <Text style={[styles.bodyText, { marginTop: 10 }]}>
            Din evidențele fiscale ale {data.tenant.name} rezultă că
            contribuabilul{" "}
            <Text style={styles.boldText}>
              FIGUREAZĂ cu obligații de plată restante
            </Text>{" "}
            în sumă totală de{" "}
            <Text style={styles.boldText}>{data.totalRestanta} lei</Text>.
          </Text>
        ) : (
          <Text style={[styles.bodyText, { marginTop: 10 }]}>
            Din evidențele fiscale ale {data.tenant.name} rezultă că
            contribuabilul{" "}
            <Text style={styles.boldText}>
              NU FIGUREAZĂ cu obligații de plată restante
            </Text>{" "}
            către bugetul local.
          </Text>
        )}

        {/* Validity */}
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Prezentul certificat este valabil{" "}
          <Text style={styles.boldText}>30 de zile</Text> de la data emiterii,
          respectiv până la data de{" "}
          <Text style={styles.boldText}>{data.validUntil}</Text>.
        </Text>

        <Text style={styles.legalText}>
          Certificatul de atestare fiscală se eliberează în conformitate cu
          prevederile art. 159 din Legea nr. 207/2015 privind Codul de procedură
          fiscală.
        </Text>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>PRIMAR</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura și ștampila</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>COMPARTIMENT DE SPECIALITATE</Text>
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
          {data.tenant.name} | CIF: {data.tenant.cui} | {data.tenant.address}
        </Text>
      </Page>
    </Document>
  );
}
