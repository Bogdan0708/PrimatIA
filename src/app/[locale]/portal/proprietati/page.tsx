import { requireCitizenAuth } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/formatting";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MapPin, Car } from "lucide-react";

export default async function PortalPropertiesPage() {
  const citizen = await requireCitizenAuth();
  const t = await getTranslations("portal");
  const tProp = await getTranslations("property");
  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const [buildings, land, vehicles] = await Promise.all([
    prisma.proprietateCladire.findMany({
      where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
      include: { adresa: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.proprietateTeren.findMany({
      where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
      include: { adresa: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.proprietateVehicul.findMany({
      where: { contribuabilId: { in: contribuabilIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("myProperties")}</h1>

      <Tabs defaultValue="buildings">
        <TabsList>
          <TabsTrigger value="buildings" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            {tProp("buildings")} ({buildings.length})
          </TabsTrigger>
          <TabsTrigger value="land" className="gap-1.5">
            <MapPin className="h-4 w-4" />
            {tProp("land")} ({land.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Car className="h-4 w-4" />
            {tProp("vehicles")} ({vehicles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buildings">
          <Card>
            <CardHeader>
              <CardTitle>{tProp("buildings")}</CardTitle>
            </CardHeader>
            <CardContent>
              {buildings.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noProperties")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tProp("destination")}</TableHead>
                      <TableHead>{tProp("constructionType")}</TableHead>
                      <TableHead>{tProp("builtArea")}</TableHead>
                      <TableHead>{tProp("zone")}</TableHead>
                      <TableHead>{tProp("constructionYear")}</TableHead>
                      <TableHead>{tProp("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildings.map((building) => (
                      <TableRow key={building.id}>
                        <TableCell className="font-medium">{building.destinatie}</TableCell>
                        <TableCell>{building.tipConstructie}</TableCell>
                        <TableCell>{formatNumber(Number(building.suprafataConstruita), 0)} mp</TableCell>
                        <TableCell>{building.zona}</TableCell>
                        <TableCell>{building.anConstructie}</TableCell>
                        <TableCell>
                          <Badge variant={building.status === "activ" ? "default" : "secondary"}>
                            {building.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="land">
          <Card>
            <CardHeader>
              <CardTitle>{tProp("land")}</CardTitle>
            </CardHeader>
            <CardContent>
              {land.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noProperties")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tProp("category")}</TableHead>
                      <TableHead>{tProp("areaSqm")}</TableHead>
                      <TableHead>{tProp("zone")}</TableHead>
                      <TableHead>{tProp("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {land.map((plot) => (
                      <TableRow key={plot.id}>
                        <TableCell className="font-medium">{plot.categorie}</TableCell>
                        <TableCell>{formatNumber(Number(plot.suprafataMp), 0)} mp</TableCell>
                        <TableCell>{plot.zona}</TableCell>
                        <TableCell>
                          <Badge variant={plot.status === "activ" ? "default" : "secondary"}>
                            {plot.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle>{tProp("vehicles")}</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noProperties")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tProp("vehicleType")}</TableHead>
                      <TableHead>{tProp("brand")} / {tProp("model")}</TableHead>
                      <TableHead>{tProp("registrationNumber")}</TableHead>
                      <TableHead>{tProp("manufacturingYear")}</TableHead>
                      <TableHead>{tProp("engineDisplacement")}</TableHead>
                      <TableHead>{tProp("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">{vehicle.tipVehicul}</TableCell>
                        <TableCell>{vehicle.marca} {vehicle.model}</TableCell>
                        <TableCell>{vehicle.numarInmatriculare}</TableCell>
                        <TableCell>{vehicle.anFabricatie}</TableCell>
                        <TableCell>{vehicle.cilindreeCmc ? `${vehicle.cilindreeCmc} cmc` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={vehicle.status === "activ" ? "default" : "secondary"}>
                            {vehicle.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
