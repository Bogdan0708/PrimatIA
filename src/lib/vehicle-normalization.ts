const EURO_NORM_MAP: Record<string, string> = {
  "euro1": "euro_1",
  "euro2": "euro_2",
  "euro3": "euro_3",
  "euro4": "euro_4",
  "euro5": "euro_5",
  "euro6": "euro_6",
  "euro_1": "euro_1",
  "euro_2": "euro_2",
  "euro_3": "euro_3",
  "euro_4": "euro_4",
  "euro_5": "euro_5",
  "euro_6": "euro_6",
  "non-euro": "non_euro",
  "non euro": "non_euro",
  "non_euro": "non_euro",
};

const FUEL_TYPE_MAP: Record<string, string> = {
  "benzina": "benzina",
  "motorina": "motorina",
  "diesel": "motorina",
  "electric": "electric",
  "electrica": "electric",
  "gpl": "gpl",
  "hybrid": "hybrid",
  "hibrid": "hybrid",
};

const VEHICLE_TYPE_MAP: Record<string, string> = {
  "autocamion": "camion",
  "autoutilitara": "camion",
  "camion": "camion",
  "autoturism": "autoturism",
  "autobuz": "autobuz",
  "motocicleta": "motocicleta",
  "tractor": "tractor",
  "remorca": "remorca",
};

export function normalizeVehicleEuroNorm(value?: string | null): string | null {
  if (!value) return null;
  const normalized = EURO_NORM_MAP[value.trim().toLowerCase()];
  return normalized ?? value.trim();
}

export function normalizeVehicleFuelType(value?: string | null): string | null {
  if (!value) return null;
  const normalized = FUEL_TYPE_MAP[value.trim().toLowerCase()];
  return normalized ?? value.trim().toLowerCase();
}

export function normalizeVehicleType(value?: string | null): string | null {
  if (!value) return null;
  const normalized = VEHICLE_TYPE_MAP[value.trim().toLowerCase()];
  return normalized ?? value.trim().toLowerCase();
}
