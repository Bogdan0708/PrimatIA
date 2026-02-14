export {
  generateDecizieImpunere,
  generateSomatie,
  generateCertificatAtestare,
  generateChitanta,
  generateBordeRouIncasari,
} from "./generator";

export {
  generateDocument,
  generateBatch,
  getRecentDocuments,
} from "./auto-generator";

export type {
  TenantInfo,
  ContribuabilInfo,
  DecizieImpunereData,
  SomatieData,
  CertificatAtestareData,
  ChitantaData,
  BordeRouIncasariData,
} from "./types";

export type {
  GeneratableDocType,
  GenerateRequest,
  BatchRequest,
  BatchResult,
} from "./auto-generator";
