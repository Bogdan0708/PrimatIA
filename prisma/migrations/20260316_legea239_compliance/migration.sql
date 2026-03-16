-- Legea 239/2025 compliance: add emisiiCo2GKm for hybrid vehicle reduction,
-- bonificatieProcent for HCL-configurable discount percentage,
-- and exemption type/system rule flags for Art. 456 mandatory exemptions.

-- Add CO2 emissions field for hybrid vehicle reduction (Art. 470 alin. 3)
ALTER TABLE "proprietati_vehicule" ADD COLUMN "emisii_co2_g_km" INTEGER;

-- Add bonificatie percentage to HCL decisions (Art. 462: 0-10%, default ceiling)
ALTER TABLE "hcl_decisions" ADD COLUMN "bonificatie_procent" DECIMAL(4,2);

-- Add exemption type classification (Art. 456: obligatorie vs discretionara)
ALTER TABLE "scutiri_reguli" ADD COLUMN "exemption_type" VARCHAR(20) NOT NULL DEFAULT 'discretionara';

-- Add system rule flag (mandatory exemptions cannot be modified by operators)
ALTER TABLE "scutiri_reguli" ADD COLUMN "is_system_rule" BOOLEAN NOT NULL DEFAULT false;
