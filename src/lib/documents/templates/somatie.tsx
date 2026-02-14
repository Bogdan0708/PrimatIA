import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import type { SomatieData } from "../types";

/**
 * Somație — Payment notice with 15-day deadline.
 * Per CPF Art. 226-228 (Legea 207/2015).
 * Romanian only (Constituție Art. 13).
 */
export function SomatiePDF({ data }: { data: SomatieData }) {
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

        {/* Title — official wording */}
        <Text style={styles.title}>SOMAȚIE</Text>
        <Text style={styles.subtitle}>
          emisă în temeiul art. 226-228 din Legea nr. 207/2015 privind Codul de
          procedură fiscală, cu modificările și completările ulterioare
        </Text>

        {/* Taxpayer info */}
        <Text style={styles.bodyText}>
          Către:{" "}
          <Text style={styles.boldText}>
            {data.contribuabil.nume}
            {data.contribuabil.prenume ? ` ${data.contribuabil.prenume}` : ""}
          </Text>
        </Text>
        <Text style={styles.bodyText}>
          Domiciliul/Sediul: {data.contribuabil.adresa}
        </Text>
        {data.contribuabil.cnpMasked && (
          <Text style={styles.bodyText}>
            CNP: {data.contribuabil.cnpMasked}
          </Text>
        )}
        {data.contribuabil.cui && (
          <Text style={styles.bodyText}>CUI: {data.contribuabil.cui}</Text>
        )}

        {/* Notification body */}
        <Text style={[styles.bodyText, { marginTop: 15 }]}>
          Vă facem cunoscut că figurați în evidențele fiscale ale{" "}
          {data.tenant.name} cu obligații de plată restante, conform tabelului
          de mai jos:
        </Text>

        {/* Debt table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: "10%" }]}>
              Nr.
            </Text>
            <Text style={[styles.tableCellHeader, { width: "30%" }]}>
              Descriere obligație
            </Text>
            <Text style={[styles.tableCellHeader, { width: "10%" }]}>
              An
            </Text>
            <Text style={[styles.tableCellHeader, { width: "16%", textAlign: "right" }]}>
              Debit
            </Text>
            <Text style={[styles.tableCellHeader, { width: "16%", textAlign: "right" }]}>
              Penalități
            </Text>
            <Text style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}>
              Total
            </Text>
          </View>
          {data.debts.map((debt, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: "10%" }]}>{i + 1}</Text>
              <Text style={[styles.tableCell, { width: "30%" }]}>
                {debt.description}
              </Text>
              <Text style={[styles.tableCell, { width: "10%" }]}>
                {debt.fiscalYear}
              </Text>
              <Text style={[styles.tableCellRight, { width: "16%" }]}>
                {debt.sumaDebit}
              </Text>
              <Text style={[styles.tableCellRight, { width: "16%" }]}>
                {debt.sumaPenalitati}
              </Text>
              <Text style={[styles.tableCellRight, { width: "18%" }]}>
                {debt.sumaTotala}
              </Text>
            </View>
          ))}
          <View style={styles.tableRowTotal}>
            <Text
              style={[styles.tableCellHeader, { width: "50%", textAlign: "right" }]}
            >
              TOTAL:
            </Text>
            <Text style={[styles.tableCellHeader, { width: "16%", textAlign: "right" }]}>
              {data.totalDebit}
            </Text>
            <Text style={[styles.tableCellHeader, { width: "16%", textAlign: "right" }]}>
              {data.totalPenalitati}
            </Text>
            <Text style={[styles.tableCellHeader, { width: "18%", textAlign: "right" }]}>
              {data.totalSuma}
            </Text>
          </View>
        </View>

        {/* Interest calculation breakdown */}
        {data.interestBreakdown && data.interestBreakdown.length > 0 && (
          <>
            <Text style={[styles.bodyText, { marginTop: 10, fontWeight: "bold" }]}>
              Detaliere calcul accesorii fiscale (dobânzi și penalități de întârziere):
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCellHeader, { width: "25%" }]}>Obligație</Text>
                <Text style={[styles.tableCellHeader, { width: "15%", textAlign: "right" }]}>Principal</Text>
                <Text style={[styles.tableCellHeader, { width: "15%" }]}>Zile întârziere</Text>
                <Text style={[styles.tableCellHeader, { width: "15%" }]}>Rată (%)</Text>
                <Text style={[styles.tableCellHeader, { width: "15%", textAlign: "right" }]}>Dobândă</Text>
                <Text style={[styles.tableCellHeader, { width: "15%", textAlign: "right" }]}>Penalitate</Text>
              </View>
              {data.interestBreakdown.map((item, i) => (
                <View style={styles.tableRow} key={i}>
                  <Text style={[styles.tableCell, { width: "25%" }]}>{item.description}</Text>
                  <Text style={[styles.tableCellRight, { width: "15%" }]}>{item.principal}</Text>
                  <Text style={[styles.tableCell, { width: "15%" }]}>{item.daysOverdue}</Text>
                  <Text style={[styles.tableCell, { width: "15%" }]}>{item.rate}</Text>
                  <Text style={[styles.tableCellRight, { width: "15%" }]}>{item.interest}</Text>
                  <Text style={[styles.tableCellRight, { width: "15%" }]}>{item.penalty}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Deadline */}
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          În conformitate cu prevederile art. 226 alin. (1) din Legea nr.
          207/2015, vă somăm să achitați suma totală de{" "}
          <Text style={styles.boldText}>{data.totalSuma} lei</Text> în termen de{" "}
          <Text style={styles.boldText}>15 zile</Text> de la data comunicării
          prezentei somații, respectiv până la data de{" "}
          <Text style={styles.boldText}>{data.termenPlata}</Text>.
        </Text>

        {/* Legal basis — Art. 226-228 CPF */}
        <Text style={[styles.bodyText, { marginTop: 10, fontWeight: "bold" }]}>
          Temei legal:
        </Text>
        <Text style={styles.bodyText}>
          Art. 226 — Somația: Executarea silită începe prin comunicarea somației.
          Dacă în termen de 15 zile de la comunicarea somației nu se stinge debitul,
          se continuă măsurile de executare silită. Somația este însoțită de un
          exemplar al titlului executoriu emis de organul fiscal.
        </Text>
        <Text style={styles.bodyText}>
          Art. 227 — Titlul executoriu: Titlul de creanță devine titlu executoriu
          la data la care creanța fiscală este scadentă prin expirarea termenului
          de plată prevăzut de lege sau stabilit de organul fiscal ori în alt mod
          prevăzut de lege.
        </Text>
        <Text style={styles.bodyText}>
          Art. 228 — Reguli privind executarea silită: Executarea silită se poate
          întinde asupra veniturilor și bunurilor proprietate a debitorului, urmăribile
          potrivit legii, iar valorificarea acestora se efectuează numai în măsura
          necesară pentru realizarea creanțelor fiscale și a cheltuielilor de executare.
        </Text>

        {/* Property listing — assets subject to enforcement */}
        {data.propertyListing && data.propertyListing.length > 0 && (
          <>
            <Text style={[styles.bodyText, { marginTop: 10, fontWeight: "bold" }]}>
              Bunuri identificate în evidențele fiscale care pot face obiectul
              executării silite:
            </Text>
            {data.propertyListing.map((prop, i) => (
              <Text style={styles.bodyText} key={i}>
                {i + 1}. {prop}
              </Text>
            ))}
          </>
        )}

        {/* Consequences */}
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          În caz de neplată, se va proceda la executare silită conform art.
          220-267 din Legea nr. 207/2015 privind Codul de procedură fiscală,
          care poate consta în: poprire asupra conturilor bancare, executare
          silită asupra bunurilor mobile și imobile, instituire de sechestru.
        </Text>

        <Text style={styles.bodyText}>
          De asemenea, se vor calcula și percepe accesorii fiscale (dobânzi și
          penalități de întârziere) conform art. 174-176 din Codul de procedură
          fiscală.
        </Text>

        {/* Appeal */}
        <Text style={[styles.bodyText, { marginTop: 10 }]}>
          Împotriva prezentei somații se poate formula contestație la executare
          silită conform art. 260-261 din Legea nr. 207/2015, în termen de 15
          zile de la comunicare.
        </Text>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>ORGAN DE EXECUTARE</Text>
            <Text style={styles.signatureName}>Inspector taxe și impozite</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Semnătura și ștampila</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>AM PRIMIT / DATA</Text>
            <View style={[styles.signatureLine, { marginTop: 30 }]} />
            <Text style={styles.signatureLabel}>
              Semnătura contribuabilului
            </Text>
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
