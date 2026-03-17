export const NON_RESIDENTIAL_DESTINATIONS = [
  "mixta",
  "mixt",
  "nerezidentiala",
  "nerezidential",
] as const;

export const OCCUPANCY_TYPES = [
  "proprietar",
  "inchiriat",
  "comodat",
] as const;

export type OccupancyType = (typeof OCCUPANCY_TYPES)[number];

export interface OccupancyFieldInput<TDate = string | Date | null | undefined> {
  ocupareNerezidentiala?: string | null;
  chiriasNume?: string | null;
  chiriasCui?: string | null;
  contractNr?: string | null;
  contractData?: TDate;
  contractExpirare?: TDate;
}

export interface SanitizedOccupancyFields<TDate = Date | null> {
  ocupareNerezidentiala: OccupancyType | null;
  chiriasNume: string | null;
  chiriasCui: string | null;
  contractNr: string | null;
  contractData: TDate;
  contractExpirare: TDate;
}

function normalizeOccupancyType(value: string | null | undefined): OccupancyType | null {
  if (!value) return null;
  return OCCUPANCY_TYPES.includes(value as OccupancyType)
    ? (value as OccupancyType)
    : null;
}

function parseDateOrNull(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sanitizeOccupancyFields(
  destinatie: string,
  fields: OccupancyFieldInput
): SanitizedOccupancyFields<Date | null> {
  const isNonResidential = NON_RESIDENTIAL_DESTINATIONS.includes(
    destinatie as (typeof NON_RESIDENTIAL_DESTINATIONS)[number]
  );

  if (!isNonResidential) {
    return {
      ocupareNerezidentiala: null,
      chiriasNume: null,
      chiriasCui: null,
      contractNr: null,
      contractData: null,
      contractExpirare: null,
    };
  }

  const ocupare = normalizeOccupancyType(fields.ocupareNerezidentiala);
  const hasTenant = ocupare === "inchiriat" || ocupare === "comodat";

  return {
    ocupareNerezidentiala: ocupare,
    chiriasNume: hasTenant ? (fields.chiriasNume || null) : null,
    chiriasCui: hasTenant ? (fields.chiriasCui || null) : null,
    contractNr: hasTenant ? (fields.contractNr || null) : null,
    contractData: hasTenant ? parseDateOrNull(fields.contractData) : null,
    contractExpirare: hasTenant ? parseDateOrNull(fields.contractExpirare) : null,
  };
}
