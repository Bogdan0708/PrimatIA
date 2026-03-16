"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, MapPin, Car, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateBuilding,
  updateLand,
  updateVehicle,
} from "../_actions/property-actions";

// ============================================================================
// Types (matching Prisma output serialized through RSC)
// ============================================================================

// Prisma Decimal serializes as its own class; we accept it + string + number
type DecimalLike = string | number | { toNumber(): number; toString(): string };
const NONE_OPTION = "__none__";

interface BuildingData {
  id: string;
  destinatie: string;
  tipConstructie: string;
  anConstructie: number;
  suprafataConstruita: DecimalLike;
  suprafataUtila?: DecimalLike | null;
  suprafataDesfasurata?: DecimalLike | null;
  nrEtaje: number;
  valoareImpozabila?: DecimalLike | null;
  valoareInventar?: DecimalLike | null;
  suprafataRezidentiala?: DecimalLike | null;
  suprafataNerezidentiala?: DecimalLike | null;
  zona: string;
  cotaParte: DecimalLike;
  nrProprietari: number;
  dataDobandire: string | Date;
  dataInstrainare?: string | Date | null;
  numarCadastral?: string | null;
  numarCarteFunciara?: string | null;
  status: string;
  [key: string]: unknown; // allow extra Prisma fields (adresa, tenantId, etc.)
}

interface LandData {
  id: string;
  categorie: string;
  suprafataMp: DecimalLike;
  suprafataHa?: DecimalLike | null;
  zona: string;
  cotaParte: DecimalLike;
  dataDobandire: string | Date;
  dataInstrainare?: string | Date | null;
  numarCadastral?: string | null;
  numarCarteFunciara?: string | null;
  status: string;
  [key: string]: unknown;
}

interface VehicleData {
  id: string;
  tipVehicul: string;
  marca?: string | null;
  model?: string | null;
  anFabricatie: number;
  cilindreeCmc?: number | null;
  putereKw?: DecimalLike | null;
  masaTotalaKg?: number | null;
  nrLocuri?: number | null;
  normaPoluare?: string | null;
  tipCombustibil?: string | null;
  emisiiCo2GKm?: number | null;
  numarInmatriculare?: string | null;
  serieSasiu?: string | null;
  nrCarteIdentitate?: string | null;
  dataDobandire: string | Date;
  dataInstrainare?: string | Date | null;
  status: string;
  [key: string]: unknown;
}

// ============================================================================
// Helper
// ============================================================================

function toDateStr(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function num(v: DecimalLike | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "object" && "toNumber" in v) return v.toNumber();
  return typeof v === "string" ? parseFloat(v) || 0 : v;
}

function parseRequiredNumberInput(
  value: string,
  opts: { integer?: boolean; min?: number; max?: number } = {}
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (opts.integer && !Number.isInteger(parsed)) return null;
  if (opts.min != null && parsed < opts.min) return null;
  if (opts.max != null && parsed > opts.max) return null;
  return parsed;
}

function parseOptionalNumberInput(
  value: string,
  opts: { integer?: boolean; min?: number; max?: number } = {}
): number | null {
  if (!value.trim()) return null;
  return parseRequiredNumberInput(value, opts);
}

function isValidDateInput(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

// ============================================================================
// Main Component
// ============================================================================

interface PropertiesTabProps {
  buildings: BuildingData[];
  land: LandData[];
  vehicles: VehicleData[];
  noPropertiesLabel: string;
}

export function PropertiesTab({
  buildings,
  land,
  vehicles,
  noPropertiesLabel,
}: PropertiesTabProps) {
  const tc = useTranslations("common");
  const tp = useTranslations("property");

  const [editBuilding, setEditBuilding] = useState<BuildingData | null>(null);
  const [editLandItem, setEditLandItem] = useState<LandData | null>(null);
  const [editVehicle, setEditVehicle] = useState<VehicleData | null>(null);

  const totalProps = buildings.length + land.length + vehicles.length;

  if (totalProps === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{noPropertiesLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buildings */}
      {buildings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle className="text-lg">
              {tp("buildings")} ({buildings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">{tp("destination")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("zone")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("builtArea")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("constructionYear")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("status")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((c) => (
                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-3">{c.destinatie}</td>
                      <td className="p-3"><Badge variant="outline">{c.zona}</Badge></td>
                      <td className="p-3">{num(c.suprafataConstruita).toLocaleString()} mp</td>
                      <td className="p-3">{c.anConstructie}</td>
                      <td className="p-3">
                        <Badge variant={c.status === "activ" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => setEditBuilding(c)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          {tc("edit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Land */}
      {land.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle className="text-lg">
              {tp("land")} ({land.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">{tp("category")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("zone")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("areaSqm")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("ownershipShare")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("status")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {land.map((ter) => (
                    <tr key={ter.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-3">{ter.categorie}</td>
                      <td className="p-3"><Badge variant="outline">{ter.zona}</Badge></td>
                      <td className="p-3">{num(ter.suprafataMp).toLocaleString()} mp</td>
                      <td className="p-3">{num(ter.cotaParte)}%</td>
                      <td className="p-3">
                        <Badge variant={ter.status === "activ" ? "default" : "secondary"}>
                          {ter.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => setEditLandItem(ter)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          {tc("edit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Car className="h-5 w-5" />
            <CardTitle className="text-lg">
              {tp("vehicles")} ({vehicles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-3 text-left font-medium">{tp("vehicleType")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("brand")} / {tp("model")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("registrationNumber")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tp("engineDisplacement")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("status")}</th>
                    <th className="h-10 px-3 text-left font-medium">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-3">{v.tipVehicul}</td>
                      <td className="p-3">
                        {[v.marca, v.model].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="p-3 font-mono text-xs">{v.numarInmatriculare ?? "-"}</td>
                      <td className="p-3">{v.cilindreeCmc ? `${v.cilindreeCmc} cmc` : "-"}</td>
                      <td className="p-3">
                        <Badge variant={v.status === "activ" ? "default" : "secondary"}>
                          {v.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => setEditVehicle(v)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          {tc("edit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialogs */}
      {editBuilding && (
        <EditBuildingDialog
          building={editBuilding}
          onClose={() => setEditBuilding(null)}
        />
      )}
      {editLandItem && (
        <EditLandDialog
          land={editLandItem}
          onClose={() => setEditLandItem(null)}
        />
      )}
      {editVehicle && (
        <EditVehicleDialog
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Edit Building Dialog
// ============================================================================

function EditBuildingDialog({
  building,
  onClose,
}: {
  building: BuildingData;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const tp = useTranslations("property");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    destinatie: building.destinatie,
    tipConstructie: building.tipConstructie,
    anConstructie: String(building.anConstructie),
    suprafataConstruita: String(num(building.suprafataConstruita)),
    suprafataUtila: building.suprafataUtila ? String(num(building.suprafataUtila)) : "",
    suprafataDesfasurata: building.suprafataDesfasurata ? String(num(building.suprafataDesfasurata)) : "",
    nrEtaje: String(building.nrEtaje),
    valoareImpozabila: building.valoareImpozabila ? String(num(building.valoareImpozabila)) : "",
    valoareInventar: building.valoareInventar ? String(num(building.valoareInventar)) : "",
    suprafataRezidentiala: building.suprafataRezidentiala ? String(num(building.suprafataRezidentiala)) : "",
    suprafataNerezidentiala: building.suprafataNerezidentiala ? String(num(building.suprafataNerezidentiala)) : "",
    zona: building.zona,
    cotaParte: String(num(building.cotaParte)),
    nrProprietari: String(building.nrProprietari),
    dataDobandire: toDateStr(building.dataDobandire),
    dataInstrainare: toDateStr(building.dataInstrainare),
    numarCadastral: building.numarCadastral ?? "",
    numarCarteFunciara: building.numarCarteFunciara ?? "",
    status: building.status,
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError("");

    const anConstructie = parseRequiredNumberInput(form.anConstructie, { integer: true, min: 1 });
    const suprafataConstruita = parseRequiredNumberInput(form.suprafataConstruita, { min: 0 });
    const nrEtaje = parseRequiredNumberInput(form.nrEtaje, { integer: true, min: 0 });
    const cotaParte = parseRequiredNumberInput(form.cotaParte, { min: 0, max: 100 });
    const nrProprietari = parseRequiredNumberInput(form.nrProprietari, { integer: true, min: 1 });
    const suprafataUtila = parseOptionalNumberInput(form.suprafataUtila, { min: 0 });
    const suprafataDesfasurata = parseOptionalNumberInput(form.suprafataDesfasurata, { min: 0 });
    const valoareImpozabila = parseOptionalNumberInput(form.valoareImpozabila, { min: 0 });
    const valoareInventar = parseOptionalNumberInput(form.valoareInventar, { min: 0 });
    const suprafataRezidentiala = parseOptionalNumberInput(form.suprafataRezidentiala, { min: 0 });
    const suprafataNerezidentiala = parseOptionalNumberInput(form.suprafataNerezidentiala, { min: 0 });

    if (
      !form.destinatie ||
      !form.tipConstructie ||
      !form.zona ||
      !form.status ||
      anConstructie == null ||
      suprafataConstruita == null ||
      nrEtaje == null ||
      cotaParte == null ||
      nrProprietari == null ||
      (form.suprafataUtila.trim() && suprafataUtila == null) ||
      (form.suprafataDesfasurata.trim() && suprafataDesfasurata == null) ||
      (form.valoareImpozabila.trim() && valoareImpozabila == null) ||
      (form.valoareInventar.trim() && valoareInventar == null) ||
      (form.suprafataRezidentiala.trim() && suprafataRezidentiala == null) ||
      (form.suprafataNerezidentiala.trim() && suprafataNerezidentiala == null) ||
      !isValidDateInput(form.dataDobandire) ||
      (form.dataInstrainare.trim() && !isValidDateInput(form.dataInstrainare))
    ) {
      setError(tp("updateError"));
      return;
    }

    setSaving(true);
    try {
      const result = await updateBuilding(building.id, {
        destinatie: form.destinatie,
        tipConstructie: form.tipConstructie,
        anConstructie,
        suprafataConstruita,
        suprafataUtila,
        suprafataDesfasurata,
        nrEtaje,
        valoareImpozabila,
        valoareInventar,
        suprafataRezidentiala,
        suprafataNerezidentiala,
        zona: form.zona,
        cotaParte,
        nrProprietari,
        dataDobandire: form.dataDobandire,
        dataInstrainare: form.dataInstrainare || null,
        numarCadastral: form.numarCadastral || null,
        numarCarteFunciara: form.numarCarteFunciara || null,
        status: form.status,
      });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    } catch {
      setError(tp("updateError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("editBuilding")}</DialogTitle>
          <DialogDescription>
            {tp("destination")}: {building.destinatie} — {tp("zone")} {building.zona}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Row 1: Destination + Construction Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("destination")}</Label>
              <Select value={form.destinatie} onValueChange={(v) => set("destinatie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rezidentiala">{tp("residential")}</SelectItem>
                  <SelectItem value="nerezidentiala">{tp("nonResidential")}</SelectItem>
                  <SelectItem value="mixta">{tp("mixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("constructionType")}</Label>
              <Select value={form.tipConstructie} onValueChange={(v) => set("tipConstructie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cadre_beton">{tp("concreteFrames")}</SelectItem>
                  <SelectItem value="pereti_caramida">{tp("brickWalls")}</SelectItem>
                  <SelectItem value="lemn">{tp("wood")}</SelectItem>
                  <SelectItem value="alte_materiale">{tp("otherMaterials")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Year + Floors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("constructionYear")}</Label>
              <Input type="number" value={form.anConstructie} onChange={(e) => set("anConstructie", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("floors")}</Label>
              <Input type="number" value={form.nrEtaje} onChange={(e) => set("nrEtaje", e.target.value)} />
            </div>
          </div>

          {/* Row 3: Areas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("builtArea")}</Label>
              <Input type="number" step="0.01" value={form.suprafataConstruita} onChange={(e) => set("suprafataConstruita", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("usableArea")}</Label>
              <Input type="number" step="0.01" value={form.suprafataUtila} onChange={(e) => set("suprafataUtila", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("deployedArea")}</Label>
              <Input type="number" step="0.01" value={form.suprafataDesfasurata} onChange={(e) => set("suprafataDesfasurata", e.target.value)} />
            </div>
          </div>

          {/* Row 4: Mixed areas (shown only for mixed) */}
          {form.destinatie === "mixta" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tp("residentialArea")}</Label>
                <Input type="number" step="0.01" value={form.suprafataRezidentiala} onChange={(e) => set("suprafataRezidentiala", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{tp("nonResidentialArea")}</Label>
                <Input type="number" step="0.01" value={form.suprafataNerezidentiala} onChange={(e) => set("suprafataNerezidentiala", e.target.value)} />
              </div>
            </div>
          )}

          {/* Row 5: Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("taxableValue")}</Label>
              <Input type="number" step="0.01" value={form.valoareImpozabila} onChange={(e) => set("valoareImpozabila", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("inventoryValue")}</Label>
              <Input type="number" step="0.01" value={form.valoareInventar} onChange={(e) => set("valoareInventar", e.target.value)} />
            </div>
          </div>

          {/* Row 6: Zone + Ownership */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("zone")}</Label>
              <Select value={form.zona} onValueChange={(v) => set("zona", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A", "B", "C", "D"].map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("ownershipShare")}</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.cotaParte} onChange={(e) => set("cotaParte", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("numberOfOwners")}</Label>
              <Input type="number" min="1" value={form.nrProprietari} onChange={(e) => set("nrProprietari", e.target.value)} />
            </div>
          </div>

          {/* Row 7: Cadastral */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("cadastralNumber")}</Label>
              <Input value={form.numarCadastral} onChange={(e) => set("numarCadastral", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("landBookNumber")}</Label>
              <Input value={form.numarCarteFunciara} onChange={(e) => set("numarCarteFunciara", e.target.value)} />
            </div>
          </div>

          {/* Row 8: Dates + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("acquisitionDate")}</Label>
              <Input type="date" value={form.dataDobandire} onChange={(e) => set("dataDobandire", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("disposalDate")}</Label>
              <Input type="date" value={form.dataInstrainare} onChange={(e) => set("dataInstrainare", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("status")}</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activ">{tp("active")}</SelectItem>
                  <SelectItem value="instrainat">{tp("disposed")}</SelectItem>
                  <SelectItem value="demolat">{tp("demolished")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tp("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Edit Land Dialog
// ============================================================================

function EditLandDialog({
  land,
  onClose,
}: {
  land: LandData;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const tp = useTranslations("property");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    categorie: land.categorie,
    suprafataMp: String(num(land.suprafataMp)),
    suprafataHa: land.suprafataHa ? String(num(land.suprafataHa)) : "",
    zona: land.zona,
    cotaParte: String(num(land.cotaParte)),
    dataDobandire: toDateStr(land.dataDobandire),
    dataInstrainare: toDateStr(land.dataInstrainare),
    numarCadastral: land.numarCadastral ?? "",
    numarCarteFunciara: land.numarCarteFunciara ?? "",
    status: land.status,
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError("");

    const suprafataMp = parseRequiredNumberInput(form.suprafataMp, { min: 0 });
    const suprafataHa = parseOptionalNumberInput(form.suprafataHa, { min: 0 });
    const cotaParte = parseRequiredNumberInput(form.cotaParte, { min: 0, max: 100 });

    if (
      !form.categorie ||
      !form.zona ||
      !form.status ||
      suprafataMp == null ||
      cotaParte == null ||
      (form.suprafataHa.trim() && suprafataHa == null) ||
      !isValidDateInput(form.dataDobandire) ||
      (form.dataInstrainare.trim() && !isValidDateInput(form.dataInstrainare))
    ) {
      setError(tp("updateError"));
      return;
    }

    setSaving(true);
    try {
      const result = await updateLand(land.id, {
        categorie: form.categorie,
        suprafataMp,
        suprafataHa,
        zona: form.zona,
        cotaParte,
        dataDobandire: form.dataDobandire,
        dataInstrainare: form.dataInstrainare || null,
        numarCadastral: form.numarCadastral || null,
        numarCarteFunciara: form.numarCarteFunciara || null,
        status: form.status,
      });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    } catch {
      setError(tp("updateError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("editLand")}</DialogTitle>
          <DialogDescription>
            {tp("category")}: {land.categorie} — {tp("zone")} {land.zona}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category + Zone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("category")}</Label>
              <Select value={form.categorie} onValueChange={(v) => set("categorie", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intravilan">{tp("intravilan")}</SelectItem>
                  <SelectItem value="extravilan">{tp("extravilan")}</SelectItem>
                  <SelectItem value="curti_constructii">{tp("landCurti")}</SelectItem>
                  <SelectItem value="arabil">{tp("landArabil")}</SelectItem>
                  <SelectItem value="pasuni">{tp("landPasuni")}</SelectItem>
                  <SelectItem value="paduri">{tp("landPaduri")}</SelectItem>
                  <SelectItem value="ape">{tp("landApe")}</SelectItem>
                  <SelectItem value="drumuri">{tp("landDrumuri")}</SelectItem>
                  <SelectItem value="neproductiv">{tp("landNeproductiv")}</SelectItem>
                  <SelectItem value="extravilan_arabil">Extravilan - {tp("landArabil")}</SelectItem>
                  <SelectItem value="extravilan_pasuni">Extravilan - {tp("landPasuni")}</SelectItem>
                  <SelectItem value="extravilan_paduri">Extravilan - {tp("landPaduri")}</SelectItem>
                  <SelectItem value="extravilan_neproductiv">Extravilan - {tp("landNeproductiv")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("zone")}</Label>
              <Select value={form.zona} onValueChange={(v) => set("zona", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A", "B", "C", "D"].map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Area */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("areaSqm")}</Label>
              <Input type="number" step="0.01" value={form.suprafataMp} onChange={(e) => set("suprafataMp", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("areaHa")}</Label>
              <Input type="number" step="0.0001" value={form.suprafataHa} onChange={(e) => set("suprafataHa", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("ownershipShare")}</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.cotaParte} onChange={(e) => set("cotaParte", e.target.value)} />
            </div>
          </div>

          {/* Cadastral */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tp("cadastralNumber")}</Label>
              <Input value={form.numarCadastral} onChange={(e) => set("numarCadastral", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("landBookNumber")}</Label>
              <Input value={form.numarCarteFunciara} onChange={(e) => set("numarCarteFunciara", e.target.value)} />
            </div>
          </div>

          {/* Dates + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("acquisitionDate")}</Label>
              <Input type="date" value={form.dataDobandire} onChange={(e) => set("dataDobandire", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("disposalDate")}</Label>
              <Input type="date" value={form.dataInstrainare} onChange={(e) => set("dataInstrainare", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("status")}</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activ">{tp("active")}</SelectItem>
                  <SelectItem value="instrainat">{tp("disposed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tp("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Edit Vehicle Dialog
// ============================================================================

function EditVehicleDialog({
  vehicle,
  onClose,
}: {
  vehicle: VehicleData;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const tp = useTranslations("property");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tipVehicul: vehicle.tipVehicul,
    marca: vehicle.marca ?? "",
    model: vehicle.model ?? "",
    anFabricatie: String(vehicle.anFabricatie),
    cilindreeCmc: vehicle.cilindreeCmc ? String(vehicle.cilindreeCmc) : "",
    putereKw: vehicle.putereKw ? String(num(vehicle.putereKw)) : "",
    masaTotalaKg: vehicle.masaTotalaKg ? String(vehicle.masaTotalaKg) : "",
    nrLocuri: vehicle.nrLocuri ? String(vehicle.nrLocuri) : "",
    normaPoluare: vehicle.normaPoluare ?? "",
    tipCombustibil: vehicle.tipCombustibil ?? "",
    emisiiCo2GKm: vehicle.emisiiCo2GKm ? String(vehicle.emisiiCo2GKm) : "",
    numarInmatriculare: vehicle.numarInmatriculare ?? "",
    serieSasiu: vehicle.serieSasiu ?? "",
    nrCarteIdentitate: vehicle.nrCarteIdentitate ?? "",
    dataDobandire: toDateStr(vehicle.dataDobandire),
    dataInstrainare: toDateStr(vehicle.dataInstrainare),
    status: vehicle.status,
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setError("");

    const anFabricatie = parseRequiredNumberInput(form.anFabricatie, { integer: true, min: 1 });
    const cilindreeCmc = parseOptionalNumberInput(form.cilindreeCmc, { integer: true, min: 0 });
    const putereKw = parseOptionalNumberInput(form.putereKw, { min: 0 });
    const masaTotalaKg = parseOptionalNumberInput(form.masaTotalaKg, { integer: true, min: 0 });
    const nrLocuri = parseOptionalNumberInput(form.nrLocuri, { integer: true, min: 0 });
    const emisiiCo2GKm = parseOptionalNumberInput(form.emisiiCo2GKm, { integer: true, min: 0 });

    if (
      !form.tipVehicul ||
      !form.status ||
      anFabricatie == null ||
      (form.cilindreeCmc.trim() && cilindreeCmc == null) ||
      (form.putereKw.trim() && putereKw == null) ||
      (form.masaTotalaKg.trim() && masaTotalaKg == null) ||
      (form.nrLocuri.trim() && nrLocuri == null) ||
      (form.emisiiCo2GKm.trim() && emisiiCo2GKm == null) ||
      !isValidDateInput(form.dataDobandire) ||
      (form.dataInstrainare.trim() && !isValidDateInput(form.dataInstrainare))
    ) {
      setError(tp("updateError"));
      return;
    }

    setSaving(true);
    try {
      const result = await updateVehicle(vehicle.id, {
        tipVehicul: form.tipVehicul,
        marca: form.marca || null,
        model: form.model || null,
        anFabricatie,
        cilindreeCmc,
        putereKw,
        masaTotalaKg,
        nrLocuri,
        normaPoluare: form.normaPoluare || null,
        tipCombustibil: form.tipCombustibil || null,
        emisiiCo2GKm,
        numarInmatriculare: form.numarInmatriculare || null,
        serieSasiu: form.serieSasiu || null,
        nrCarteIdentitate: form.nrCarteIdentitate || null,
        dataDobandire: form.dataDobandire,
        dataInstrainare: form.dataInstrainare || null,
        status: form.status,
      });
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    } catch {
      setError(tp("updateError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tp("editVehicle")}</DialogTitle>
          <DialogDescription>
            {[vehicle.marca, vehicle.model].filter(Boolean).join(" ") || vehicle.tipVehicul}
            {vehicle.numarInmatriculare ? ` — ${vehicle.numarInmatriculare}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Row 1: Type + Brand + Model */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("vehicleType")}</Label>
              <Select value={form.tipVehicul} onValueChange={(v) => set("tipVehicul", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="autoturism">{tp("car")}</SelectItem>
                  <SelectItem value="autobuz">{tp("bus")}</SelectItem>
                  <SelectItem value="camion">{tp("truck")}</SelectItem>
                  <SelectItem value="motocicleta">{tp("motorcycle")}</SelectItem>
                  <SelectItem value="tractor">{tp("tractor")}</SelectItem>
                  <SelectItem value="remorca">{tp("trailer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tp("brand")}</Label>
              <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("model")}</Label>
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>

          {/* Row 2: Year + Engine + Power */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("manufacturingYear")}</Label>
              <Input type="number" value={form.anFabricatie} onChange={(e) => set("anFabricatie", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("engineDisplacement")}</Label>
              <Input type="number" value={form.cilindreeCmc} onChange={(e) => set("cilindreeCmc", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("powerKw")}</Label>
              <Input type="number" step="0.01" value={form.putereKw} onChange={(e) => set("putereKw", e.target.value)} />
            </div>
          </div>

          {/* Row 3: Mass + Seats + Pollution */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("totalMassKg")}</Label>
              <Input type="number" value={form.masaTotalaKg} onChange={(e) => set("masaTotalaKg", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("seats")}</Label>
              <Input type="number" value={form.nrLocuri} onChange={(e) => set("nrLocuri", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("pollutionNorm")}</Label>
              <Select value={form.normaPoluare || NONE_OPTION} onValueChange={(v) => set("normaPoluare", v === NONE_OPTION ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>-</SelectItem>
                  <SelectItem value="euro_1">Euro 1</SelectItem>
                  <SelectItem value="euro_2">Euro 2</SelectItem>
                  <SelectItem value="euro_3">Euro 3</SelectItem>
                  <SelectItem value="euro_4">Euro 4</SelectItem>
                  <SelectItem value="euro_5">Euro 5</SelectItem>
                  <SelectItem value="euro_6">Euro 6</SelectItem>
                  <SelectItem value="non_euro">Non-Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Fuel + Registration */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{tp("fuelType")}</Label>
              <Select value={form.tipCombustibil || NONE_OPTION} onValueChange={(v) => set("tipCombustibil", v === NONE_OPTION ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>-</SelectItem>
                  <SelectItem value="benzina">Benzină</SelectItem>
                  <SelectItem value="motorina">Motorină</SelectItem>
                  <SelectItem value="gpl">GPL</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CO2 (g/km)</Label>
              <Input type="number" value={form.emisiiCo2GKm} onChange={(e) => set("emisiiCo2GKm", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("registrationNumber")}</Label>
              <Input value={form.numarInmatriculare} onChange={(e) => set("numarInmatriculare", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("chassisNumber")}</Label>
              <Input value={form.serieSasiu} onChange={(e) => set("serieSasiu", e.target.value)} />
            </div>
          </div>

          {/* Row 5: Identity card */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("identityCardNumber")}</Label>
              <Input value={form.nrCarteIdentitate} onChange={(e) => set("nrCarteIdentitate", e.target.value)} />
            </div>
          </div>

          {/* Row 6: Dates + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tp("acquisitionDate")}</Label>
              <Input type="date" value={form.dataDobandire} onChange={(e) => set("dataDobandire", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("disposalDate")}</Label>
              <Input type="date" value={form.dataInstrainare} onChange={(e) => set("dataInstrainare", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{tp("status")}</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activ">{tp("active")}</SelectItem>
                  <SelectItem value="instrainat">{tp("disposed")}</SelectItem>
                  <SelectItem value="radiat">{tp("deregistered")}</SelectItem>
                  <SelectItem value="casat">{tp("scrapped")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? tp("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
