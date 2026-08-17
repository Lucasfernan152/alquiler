import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import { ContractForm } from "../components/ContractForm";
import { Screen } from "../components/Screen";
import {
  BuildingIcon,
  FileIcon,
  HomeIcon,
  LogoutIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
} from "../components/icons";
import { requiredInvoiceTypes } from "../lib/billing";
import {
  Badge,
  Button,
  Card,
  CardList,
  EmptyState,
  ErrorText,
  Field,
  LinkButton,
  ListRow,
  SectionHeading,
  inputClass,
  longDate,
  money,
  monthYear,
} from "../components/ui";
import type { Building, Property, User } from "../types";

type Props = {
  user: User;
  buildings: Building[];
  property: Property | null;
  reloadProperty: () => Promise<void>;
  reloadOptions: () => void;
  onLogout: () => void;
  focusSheet?: "contract" | null;
  onFocusHandled?: () => void;
};

type Sheet =
  | "building"
  | "unit"
  | "contract"
  | "tenants"
  | "contacts"
  | "newBuilding"
  | null;

export function MorePage({
  user,
  buildings,
  property,
  reloadProperty,
  reloadOptions,
  onLogout,
  focusSheet,
  onFocusHandled,
}: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!focusSheet) return;
    if (!property) return;
    setSheet(focusSheet);
    onFocusHandled?.();
  }, [focusSheet, property, onFocusHandled]);

  const isOwner = property?.role === "owner";
  const building = buildings.find((b) => b.id === property?.buildingId);
  const contract = property?.contracts?.[0];
  const contacts = property?.emergencyContacts ?? [];
  const tenants = property?.tenancies ?? [];

  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");
  const [buildingCity, setBuildingCity] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const [unitLabel, setUnitLabel] = useState("");
  const [unitFloor, setUnitFloor] = useState("");

  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingAddress, setNewBuildingAddress] = useState("");
  const [newBuildingCity, setNewBuildingCity] = useState("");

  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantShare, setTenantShare] = useState(100);

  const [contactCategory, setContactCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Los formularios de edificio y unidad arrancan con lo que hay cargado hoy.
  useEffect(() => {
    setBuildingName(building?.name ?? "");
    setBuildingAddress(building?.address ?? "");
    setBuildingCity(building?.city ?? "");
  }, [building?.id, building?.name, building?.address, building?.city]);

  useEffect(() => {
    setUnitLabel(property?.label ?? "");
    setUnitFloor(property?.floor ?? "");
  }, [property?.id, property?.label, property?.floor]);

  const currentRequired = requiredInvoiceTypes(property);

  async function run(action: () => Promise<unknown>, refreshOptions = false) {
    setBusy(true);
    setError("");
    try {
      await action();
      await reloadProperty();
      if (refreshOptions) reloadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  async function saveBuilding(e: FormEvent) {
    e.preventDefault();
    if (!building) return;
    await run(
      () =>
        api.updateBuilding(building.id, {
          name: buildingName,
          address: buildingAddress,
          city: buildingCity,
        }),
      true,
    );
  }

  async function saveUnit(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(
      () => api.updateProperty(property.id, { label: unitLabel, floor: unitFloor }),
      true,
    );
  }

  async function addUnit(e: FormEvent) {
    e.preventDefault();
    if (!building || !newUnit.trim()) return;
    await run(async () => {
      await api.createProperty(building.id, { label: newUnit.trim() });
      setNewUnit("");
    }, true);
  }

  async function createBuilding(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api.createBuilding({
        name: newBuildingName,
        address: newBuildingAddress,
        city: newBuildingCity,
      });
      setNewBuildingName("");
      setNewBuildingAddress("");
      setNewBuildingCity("");
      setSheet(null);
    }, true);
  }

  async function addTenant(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(async () => {
      await api.addTenant(property.id, {
        email: tenantEmail,
        sharePercentage: tenantShare,
      });
      setTenantEmail("");
    });
  }

  async function saveContract(form: FormData) {
    if (!property) return;
    const propertyId = property.id;
    await run(async () => {
      await api.createContract(propertyId, form);
      setSheet(null);
    });
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(async () => {
      await api.addEmergencyContact(property.id, {
        category: contactCategory,
        name: contactName,
        phone: contactPhone,
      });
      setContactCategory("");
      setContactName("");
      setContactPhone("");
    });
  }

  return (
    <div className="space-y-6">
      {property ? (
        <section>
          <SectionHeading title="Esta propiedad" />
          <CardList>
            {isOwner && (
              <>
                <ListRow
                  icon={<BuildingIcon className="size-[18px]" />}
                  title={building?.name ?? property.building?.name ?? "Edificio"}
                  meta={building?.address ?? property.building?.address}
                  onClick={() => setSheet("building")}
                />
                <ListRow
                  icon={<HomeIcon className="size-[18px]" />}
                  title={`Unidad ${property.label}`}
                  meta={property.floor ? `Piso ${property.floor}` : "Sin piso cargado"}
                  onClick={() => setSheet("unit")}
                />
              </>
            )}
            <ListRow
              icon={<FileIcon className="size-[18px]" />}
              title="Contrato"
              meta={
                contract
                  ? `Vigente desde ${monthYear(contract.startDate)}`
                  : isOwner
                    ? "Cargalo para que lo vea el inquilino"
                    : "El dueño todavía no lo cargó"
              }
              value={contract ? money(contract.rentAmount) : undefined}
              onClick={() => setSheet("contract")}
            />
            {isOwner && (
              <ListRow
                icon={<UsersIcon className="size-[18px]" />}
                title="Inquilinos"
                meta={
                  tenants.length > 0
                    ? tenants.map((t) => t.tenant?.name).filter(Boolean).join(", ")
                    : "Sin asignar"
                }
                onClick={() => setSheet("tenants")}
              />
            )}
            <ListRow
              icon={<PhoneIcon className="size-[18px]" />}
              title="Contactos de emergencia"
              meta={contacts.length > 0 ? `${contacts.length} cargados` : "Ninguno cargado"}
              onClick={() => setSheet("contacts")}
            />
          </CardList>
          {isOwner && (
            <p className="mt-2 px-1 text-[13px] text-ink-400">
              Para editar otra unidad, elegila en el selector de arriba.
            </p>
          )}
        </section>
      ) : (
        <section>
          <SectionHeading title="Empezá" />
          <Card>
            <EmptyState
              icon={<BuildingIcon className="size-5" />}
              title="Sin propiedades"
              description="Creá un edificio y agregale las unidades que alquilás. Si sos inquilino, pedile al dueño que te asigne con tu email."
              action={
                <Button size="sm" onClick={() => setSheet("newBuilding")}>
                  Crear un edificio
                </Button>
              }
            />
          </Card>
        </section>
      )}

      <section>
        <SectionHeading title="Cuenta" />
        <CardList>
          <ListRow
            icon={<UserIcon className="size-[18px]" />}
            title={user.name}
            meta={user.email}
          />
          <ListRow
            icon={<LogoutIcon className="size-[18px]" />}
            title="Cerrar sesión"
            onClick={onLogout}
          />
        </CardList>
      </section>

      <ErrorText>{error}</ErrorText>

      {sheet === "building" && building && (
        <Screen title="Edificio" onClose={() => setSheet(null)}>
          <Card>
            <form className="space-y-4" onSubmit={saveBuilding}>
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Dirección">
                <input
                  className={inputClass}
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  required
                />
              </Field>
              <Field label="Ciudad">
                <input
                  className={inputClass}
                  value={buildingCity}
                  onChange={(e) => setBuildingCity(e.target.value)}
                />
              </Field>
              <Button block disabled={busy}>
                Guardar cambios
              </Button>
            </form>
          </Card>

          <div>
            <SectionHeading title="Unidades de este edificio" />
            <Card padded={false}>
              <div className="divide-y divide-sand-200/70">
                {(building.properties ?? []).map((unit) => (
                  <ListRow
                    key={unit.id}
                    title={unit.label}
                    meta={
                      (unit.tenancies ?? [])
                        .map((t) => t.tenant?.name)
                        .filter(Boolean)
                        .join(", ") || "Sin inquilinos"
                    }
                    right={
                      unit.id === property?.id ? <Badge tone="brand">Actual</Badge> : undefined
                    }
                  />
                ))}
              </div>
              <form
                className="flex gap-2 border-t border-sand-200/70 bg-sand-50/60 p-3"
                onSubmit={addUnit}
              >
                <input
                  className={inputClass}
                  placeholder="Nueva unidad (3B)"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
                <Button variant="secondary" disabled={busy} className="shrink-0">
                  Agregar
                </Button>
              </form>
            </Card>
            <p className="mt-2 px-1 text-[13px] text-ink-400">
              Para editar una unidad, elegila en el selector y volvé acá.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <LinkButton onClick={() => setSheet("newBuilding")}>
              Crear otro edificio
            </LinkButton>
          </div>
        </Screen>
      )}

      {sheet === "unit" && property && (
        <Screen title={`Unidad ${property.label}`} onClose={() => setSheet(null)}>
          <Card>
            <form className="space-y-4" onSubmit={saveUnit}>
              <Field label="Etiqueta" hint="Como la identificás: 3B, PB, Casa del fondo.">
                <input
                  className={inputClass}
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  required
                />
              </Field>
              <Field label="Piso">
                <input
                  className={inputClass}
                  value={unitFloor}
                  onChange={(e) => setUnitFloor(e.target.value)}
                  placeholder="3"
                />
              </Field>
              <Button block disabled={busy}>
                Guardar cambios
              </Button>
            </form>
          </Card>

          <Card>
            <p className="mb-3 text-[15px] font-semibold text-ink-900">
              Cómo se pagan las facturas
            </p>
            <select
              className={inputClass}
              value={property.billSplitMode}
              onChange={(e) =>
                run(() => api.updateProperty(property.id, { billSplitMode: e.target.value }))
              }
            >
              <option value="tenant_pays_all">Las paga todas el inquilino</option>
              <option value="split_by_percentage">Se dividen por porcentaje</option>
            </select>
          </Card>
        </Screen>
      )}

      {sheet === "newBuilding" && (
        <Screen title="Nuevo edificio" onClose={() => setSheet(null)}>
          <Card>
            <form className="space-y-4" onSubmit={createBuilding}>
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  placeholder="Edificio Belgrano"
                  required
                />
              </Field>
              <Field label="Dirección">
                <input
                  className={inputClass}
                  value={newBuildingAddress}
                  onChange={(e) => setNewBuildingAddress(e.target.value)}
                  placeholder="Av. Cabildo 2340"
                  required
                />
              </Field>
              <Field label="Ciudad">
                <input
                  className={inputClass}
                  value={newBuildingCity}
                  onChange={(e) => setNewBuildingCity(e.target.value)}
                  placeholder="CABA"
                />
              </Field>
              <Button block disabled={busy}>
                Crear edificio
              </Button>
            </form>
          </Card>
          <p className="px-1 text-[13px] text-ink-400">
            Después vas a poder agregarle unidades desde la pantalla del edificio.
          </p>
        </Screen>
      )}

      {sheet === "contract" && property && (
        <Screen title="Contrato" onClose={() => setSheet(null)}>
          {contract ? (
            <Card>
              <p className="text-[13px] font-medium text-ink-500">Alquiler mensual</p>
              <p className="amount mt-1 text-[28px] leading-none text-ink-900">
                {money(contract.rentAmount)}
              </p>
              <div className="mt-4 space-y-1 text-sm text-ink-500">
                <p>Inicio: {longDate(contract.startDate)}</p>
                <p>Aumenta cada {contract.increaseEveryMonths} meses</p>
                {contract.nextIncreaseDate && (
                  <p>Próximo aumento: {longDate(contract.nextIncreaseDate)}</p>
                )}
                <p>
                  Facturas:{" "}
                  {property.billSplitMode === "split_by_percentage"
                    ? "se dividen por porcentaje"
                    : "las paga el inquilino"}
                </p>
                {requiredInvoiceTypes(property).length > 0 && (
                  <p>
                    Facturas obligatorias: {requiredInvoiceTypes(property).join(" · ")}
                  </p>
                )}
              </div>
              {contract.filePath && (
                <a
                  className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-600"
                  href={api.fileUrl(contract.filePath)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileIcon className="size-4" />
                  {contract.fileName ?? "Abrir archivo"}
                </a>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={<FileIcon className="size-5" />}
                title="Sin contrato cargado"
                description={
                  isOwner
                    ? "Cargá el monto y el archivo del contrato."
                    : "El dueño todavía no subió el contrato."
                }
              />
            </Card>
          )}

          {isOwner && (
            <Card>
              <p className="text-[15px] font-semibold text-ink-900">
                {contract ? "Editar contrato" : "Cargar contrato"}
              </p>
              {contract && (
                <p className="mt-1 mb-3 text-[13px] text-ink-500">
                  Está cargado lo que dice el contrato vigente. Cambiá sólo lo que haga
                  falta.
                </p>
              )}
              <ContractForm
                key={contract?.id ?? "new"}
                contract={contract}
                requiredTypes={currentRequired}
                busy={busy}
                onSubmit={saveContract}
              />
            </Card>
          )}
        </Screen>
      )}

      {sheet === "tenants" && property && (
        <Screen title="Inquilinos" onClose={() => setSheet(null)}>
          {tenants.length > 0 ? (
            <CardList>
              {tenants.map((tenancy) => (
                <ListRow
                  key={tenancy.id}
                  title={tenancy.tenant?.name ?? "Inquilino"}
                  meta={tenancy.tenant?.email}
                  right={
                    <>
                      <Badge>{tenancy.sharePercentage}%</Badge>
                      <LinkButton
                        tone="danger"
                        onClick={() => run(() => api.removeTenant(property.id, tenancy.id))}
                      >
                        Quitar
                      </LinkButton>
                    </>
                  }
                />
              ))}
            </CardList>
          ) : (
            <Card>
              <EmptyState
                icon={<UsersIcon className="size-5" />}
                title="Sin inquilinos"
                description="Asigná a la persona que alquila usando el email con el que se registró."
              />
            </Card>
          )}

          <Card>
            <p className="mb-3 text-[15px] font-semibold text-ink-900">Agregar inquilino</p>
            <form className="space-y-4" onSubmit={addTenant}>
              <Field label="Email" hint="Tiene que estar registrado en la app.">
                <input
                  className={inputClass}
                  type="email"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  placeholder="inquilino@email.com"
                  required
                />
              </Field>
              <Field
                label="Porcentaje de las facturas"
                hint="El alquiler lo paga completo; el porcentaje divide sólo las facturas."
              >
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  value={tenantShare}
                  onChange={(e) => setTenantShare(Number(e.target.value))}
                />
              </Field>
              <Button block disabled={busy}>
                Asignar
              </Button>
            </form>
          </Card>
        </Screen>
      )}

      {sheet === "contacts" && property && (
        <Screen title="Contactos de emergencia" onClose={() => setSheet(null)}>
          {contacts.length > 0 ? (
            <CardList>
              {contacts.map((contact) => (
                <ListRow
                  key={contact.id}
                  icon={<PhoneIcon className="size-[18px]" />}
                  title={contact.category}
                  meta={`${contact.name} · ${contact.phone}`}
                  right={
                    isOwner ? (
                      <LinkButton
                        tone="danger"
                        onClick={() =>
                          run(() => api.deleteEmergencyContact(property.id, contact.id))
                        }
                      >
                        Quitar
                      </LinkButton>
                    ) : (
                      <a
                        href={`tel:${contact.phone}`}
                        className="rounded-lg bg-sage-50 px-3 py-1.5 text-[13px] font-semibold text-sage-700"
                      >
                        Llamar
                      </a>
                    )
                  }
                />
              ))}
            </CardList>
          ) : (
            <Card>
              <EmptyState
                icon={<PhoneIcon className="size-5" />}
                title="Sin contactos"
                description="Guardá los teléfonos que el inquilino puede llamar ante una urgencia."
              />
            </Card>
          )}

          {isOwner && (
            <Card>
              <p className="mb-3 text-[15px] font-semibold text-ink-900">Agregar contacto</p>
              <form className="space-y-4" onSubmit={addContact}>
                <Field label="Rubro">
                  <input
                    className={inputClass}
                    value={contactCategory}
                    onChange={(e) => setContactCategory(e.target.value)}
                    placeholder="Electricidad"
                    required
                  />
                </Field>
                <Field label="Nombre">
                  <input
                    className={inputClass}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Juan Pérez"
                    required
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    className={inputClass}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="11 5555 0101"
                    required
                  />
                </Field>
                <Button block disabled={busy}>
                  Guardar contacto
                </Button>
              </form>
            </Card>
          )}
        </Screen>
      )}
    </div>
  );
}
