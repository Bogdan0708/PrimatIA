import { StyleSheet } from "@react-pdf/renderer";
import "./fonts"; // Register Roboto for Romanian diacritics

/**
 * Shared PDF styles for all Romanian fiscal documents.
 * All documents use A4 format with standard government document margins.
 */
export const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    lineHeight: 1.4,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "1 solid #000",
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "column",
    maxWidth: "60%",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    maxWidth: "35%",
  },
  institutionName: {
    fontSize: 12,
    fontFamily: "Roboto", fontWeight: "bold" as const,
    marginBottom: 2,
  },
  headerInfo: {
    fontSize: 8,
    color: "#333",
    marginBottom: 1,
  },
  // Document title
  title: {
    fontSize: 14,
    fontFamily: "Roboto", fontWeight: "bold" as const,
    textAlign: "center",
    marginTop: 15,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 15,
  },
  documentNumber: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 20,
  },
  // Section headings
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Roboto", fontWeight: "bold" as const,
    marginTop: 12,
    marginBottom: 6,
    borderBottom: "0.5 solid #666",
    paddingBottom: 2,
  },
  // Body text
  bodyText: {
    fontSize: 10,
    marginBottom: 4,
    textAlign: "justify",
  },
  boldText: {
    fontFamily: "Roboto", fontWeight: "bold" as const,
  },
  // Tables
  table: {
    width: "100%",
    marginVertical: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTop: "1 solid #000",
    borderBottom: "1 solid #000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #ccc",
    minHeight: 22,
  },
  tableRowTotal: {
    flexDirection: "row",
    borderTop: "1 solid #000",
    borderBottom: "1 solid #000",
    backgroundColor: "#f5f5f5",
    minHeight: 24,
  },
  tableCell: {
    padding: 4,
    fontSize: 9,
  },
  tableCellHeader: {
    padding: 4,
    fontSize: 9,
    fontFamily: "Roboto", fontWeight: "bold" as const,
  },
  tableCellRight: {
    padding: 4,
    fontSize: 9,
    textAlign: "right",
  },
  // Amount display
  amountLarge: {
    fontSize: 12,
    fontFamily: "Roboto", fontWeight: "bold" as const,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 7,
    color: "#666",
    textAlign: "center",
    borderTop: "0.5 solid #ccc",
    paddingTop: 5,
  },
  // Signatures area
  signatureArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    paddingTop: 10,
  },
  signatureBlock: {
    width: "40%",
    alignItems: "center",
  },
  signatureTitle: {
    fontSize: 9,
    fontFamily: "Roboto", fontWeight: "bold" as const,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    marginBottom: 20,
  },
  signatureLine: {
    borderBottom: "0.5 solid #000",
    width: "80%",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    color: "#666",
  },
  // QES placeholder
  qesPlaceholder: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "#999",
    borderStyle: "dashed",
    alignItems: "center",
  },
  qesText: {
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
  // Legal text
  legalText: {
    fontSize: 8,
    color: "#333",
    marginTop: 10,
    textAlign: "justify",
    lineHeight: 1.3,
  },
  // Info rows (label: value pairs)
  infoRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  infoLabel: {
    width: "40%",
    fontSize: 9,
    color: "#444",
  },
  infoValue: {
    width: "60%",
    fontSize: 9,
    fontFamily: "Roboto", fontWeight: "bold" as const,
  },
});
