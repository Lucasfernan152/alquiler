import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import { ContractForm } from "../components/ContractForm";
import { increaseMethodLabel } from "../lib/contractLabels";
import {
  estimateNextRent,
  resolveNextIncreaseDate,
} from "../lib/rentIncrease";
import { ContactActions } from "../components/ContactActions";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { toast } from "../components/Toast";
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
  onSelectProperty: (propertyId: string) => void;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  focusSheet?: "contract" | "tenants" | null;
  onFocusHandled?: () => void;
};

type Sheet =
  | "building"
  | "unit"
  | "contract"
  | "tenants"
  | "contacts"
  | "profile"
  | "newBuilding"
  | null;

export function MorePage({
  user,
  buildings,
  property,
  reloadProperty,
  reloadOptions,
  onSelectProperty,
  onUserUpdated,
  onLogout,
  focusSheet,
  onFocusHandled,
}: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  /** Qué formulario está abierto dentro de la pantalla actual (detalle primero). */
  const [editing, setEditing] = useState<
    "contract" | "building" | "unit" | "tenant" | "contact" | "addUnit" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [confirmIncrease, setConfirmIncrease] = useState(false);

  useEffect(() => {
    if (!focusSheet) return;
    if (!property) return;
    setSheet(focusSheet);
    setEditing(null);
    onFocusHandled?.();
  }, [focusSheet, property, onFocusHandled]);

  useEffect(() => {
    setEditing(null);
  }, [sheet]);

  function openSheet(next: Sheet) {
    setEditing(null);
    setSheet(next);
  }

  function closeSheet() {
    setEditing(null);
    setSheet(null);
  }

  const isOwner = property?.role === "owner";
  const building = buildings.find((b) => b.id === property?.buildingId);
  const owner = property?.building?.owner;
  const contract = property?.contracts?.[0];
  const rentHistory = property?.rentChanges ?? [];
  const contacts = property?.emergencyContacts ?? [];
  const tenants = property?.tenancies ?? [];

  const [profileName, setProfileName] = useState(user.name);
  const [profilePhone, setProfilePhone] = useState(user.phone ?? "");
  const [profileAlias, setProfileAlias] = useState(user.paymentAlias ?? "");
  const [profileCbu, setProfileCbu] = useState(user.paymentCbu ?? "");
  const [profileHolder, setProfileHolder] = useState(user.paymentHolder ?? "");

  useEffect(() => {
    setProfileName(user.name);
    setProfilePhone(user.phone ?? "");
    setProfileAlias(user.paymentAlias ?? "");
    setProfileCbu(user.paymentCbu ?? "");
    setProfileHolder(user.paymentHolder ?? "");
  }, [
    user.id,
    user.name,
    user.phone,
    user.paymentAlias,
    user.paymentCbu,
    user.paymentHolder,
  ]);

  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");
  const [buildingCity, setBuildingCity] = useState("");
  const [buildingAlias, setBuildingAlias] = useState("");
  const [buildingCbu, setBuildingCbu] = useState("");
  const [buildingHolder, setBuildingHolder] = useState("");
  const [newUnit, setNewUnit] = useState("");

  const [unitLabel, setUnitLabel] = useState("");
  const [unitFloor, setUnitFloor] = useState("");

  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingAddress, setNewBuildingAddress] = useState("");
  const [newBuildingCity, setNewBuildingCity] = useState("");
  const [newBuildingUnit, setNewBuildingUnit] = useState("");

  // Edificio sin unidades al que le estamos agregando la primera.
  const [orphanBuilding, setOrphanBuilding] = useState<Building | null>(null);
  const [orphanUnit, setOrphanUnit] = useState("");

  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantShare, setTenantShare] = useState(100);
  const [inviteUrl, setInviteUrl] = useState("");

  const [contactCategory, setContactCategory] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Los formularios de edificio y unidad arrancan con lo que hay cargado hoy.
  useEffect(() => {
    setBuildingName(building?.name ?? "");
    setBuildingAddress(building?.address ?? "");
    setBuildingCity(building?.city ?? "");
    setBuildingAlias(building?.paymentAlias ?? "");
    setBuildingCbu(building?.paymentCbu ?? "");
    setBuildingHolder(building?.paymentHolder ?? "");
  }, [
    building?.id,
    building?.name,
    building?.address,
    building?.city,
    building?.paymentAlias,
    building?.paymentCbu,
    building?.paymentHolder,
  ]);

  useEffect(() => {
    setInviteUrl("");
  }, [property?.id]);

  useEffect(() => {
    setUnitLabel(property?.label ?? "");
    setUnitFloor(property?.floor ?? "");
  }, [property?.id, property?.label, property?.floor]);

  const currentRequired = requiredInvoiceTypes(property);
  const nextIncrease = contract ? resolveNextIncreaseDate(contract) : null;
  const increasePct = contract?.estimatedIncreasePct ?? null;
  const estimatedRent =
    contract?.estimatedRent ?? (contract ? estimateNextRent(contract) : null);
  // Un edificio sin unidades no entra en el selector, así que se lista aparte.
  const buildingsWithoutUnits = buildings.filter(
    (b) => (b.properties ?? []).length === 0,
  );

  async function run(
    action: () => Promise<unknown>,
    opts: { success?: string; refreshOptions?: boolean } = {},
  ) {
    setBusy(true);
    try {
      await action();
      await reloadProperty();
      if (opts.refreshOptions) reloadOptions();
      if (opts.success) toast.success(opts.success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  async function saveBuilding(e: FormEvent) {
    e.preventDefault();
    if (!building) return;
    await run(
      async () => {
        await api.updateBuilding(building.id, {
          name: buildingName,
          address: buildingAddress,
          city: buildingCity,
          paymentAlias: buildingAlias,
          paymentCbu: buildingCbu,
          paymentHolder: buildingHolder,
        });
        setEditing(null);
      },
      { success: "Edificio guardado", refreshOptions: true },
    );
  }

  async function saveUnit(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(
      async () => {
        await api.updateProperty(property.id, { label: unitLabel, floor: unitFloor });
        setEditing(null);
      },
      { success: "Unidad guardada", refreshOptions: true },
    );
  }

  async function addUnit(e: FormEvent) {
    e.preventDefault();
    if (!building || !newUnit.trim()) return;
    await run(
      async () => {
        await api.createProperty(building.id, { label: newUnit.trim() });
        setNewUnit("");
      },
      { success: "Unidad creada", refreshOptions: true },
    );
  }

  // El edificio se crea siempre con su primera unidad: sin unidades no habría
  // nada para elegir en el selector y quedaría invisible.
  async function createBuilding(e: FormEvent) {
    e.preventDefault();
    await run(
      async () => {
        const created = await api.createBuilding({
          name: newBuildingName,
          address: newBuildingAddress,
          city: newBuildingCity,
        });
        const unit = await api.createProperty(created.id, {
          label: newBuildingUnit.trim() || "Unidad 1",
        });
        setNewBuildingName("");
        setNewBuildingAddress("");
        setNewBuildingCity("");
        setNewBuildingUnit("");
        closeSheet();
        onSelectProperty(unit.id);
      },
      { success: "Edificio creado", refreshOptions: true },
    );
  }

  async function addFirstUnit(e: FormEvent) {
    e.preventDefault();
    if (!orphanBuilding) return;
    const target = orphanBuilding;
    await run(
      async () => {
        const unit = await api.createProperty(target.id, {
          label: orphanUnit.trim() || "Unidad 1",
        });
        setOrphanUnit("");
        setOrphanBuilding(null);
        onSelectProperty(unit.id);
      },
      { success: "Unidad creada", refreshOptions: true },
    );
  }

  async function addTenant(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(
      async () => {
        await api.addTenant(property.id, {
          email: tenantEmail,
          sharePercentage: tenantShare,
        });
        setTenantEmail("");
        setEditing(null);
      },
      { success: "Inquilino agregado" },
    );
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.updateMe({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        paymentAlias: profileAlias.trim(),
        paymentCbu: profileCbu.trim(),
        paymentHolder: profileHolder.trim(),
      });
      onUserUpdated(updated);
      closeSheet();
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  }

  async function createInviteLink() {
    if (!property) return;
    await run(
      async () => {
        const invite = await api.createInvite(property.id, {
          sharePercentage: tenantShare,
        });
        setInviteUrl(invite.url);
        try {
          await navigator.clipboard.writeText(invite.url);
          toast.success("Link copiado");
        } catch {
          toast.success("Link creado");
        }
      },
    );
  }

  async function saveContract(form: FormData) {
    if (!property) return;
    const propertyId = property.id;
    const billSplitMode = String(form.get("billSplitMode") || "");
    form.delete("billSplitMode");
    await run(
      async () => {
        if (
          billSplitMode === "tenant_pays_all" ||
          billSplitMode === "split_by_percentage"
        ) {
          await api.updateProperty(propertyId, { billSplitMode });
        }
        await api.createContract(propertyId, form);
        setEditing(null);
      },
      { success: "Contrato guardado" },
    );
  }

  async function applyIncrease() {
    if (!property || !contract) return;
    const amount = contract.estimatedRent;
    await run(
      async () => {
        await api.applyRentIncrease(property.id, amount != null ? { amount } : undefined);
        setConfirmIncrease(false);
      },
      { success: "Aumento aplicado" },
    );
  }

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!property) return;
    await run(
      async () => {
        await api.addEmergencyContact(property.id, {
          category: contactCategory,
          name: contactName,
          phone: contactPhone,
        });
        setContactCategory("");
        setContactName("");
        setContactPhone("");
        setEditing(null);
      },
      { success: "Contacto agregado" },
    );
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
                  onClick={() => openSheet("building")}
                />
                <ListRow
                  icon={<HomeIcon className="size-[18px]" />}
                  title={`Unidad ${property.label}`}
                  meta={property.floor ? `Piso ${property.floor}` : "Sin piso cargado"}
                  onClick={() => openSheet("unit")}
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
              onClick={() => openSheet("contract")}
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
                onClick={() => openSheet("tenants")}
              />
            )}
            {!isOwner && owner && (
              <ListRow
                icon={<UserIcon className="size-[18px]" />}
                title={owner.name}
                meta={owner.phone || owner.email || "Dueño"}
                right={
                  <ContactActions
                    phone={owner.phone}
                    waText={`Hola ${owner.name}, te escribo por la unidad ${property?.label ?? ""}.`}
                  />
                }
              />
            )}
            <ListRow
              icon={<PhoneIcon className="size-[18px]" />}
              title="Contactos de emergencia"
              meta={contacts.length > 0 ? `${contacts.length} cargados` : "Ninguno cargado"}
              onClick={() => openSheet("contacts")}
            />
          </CardList>
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
                <Button size="sm" onClick={() => openSheet("newBuilding")}>
                  Crear un edificio
                </Button>
              }
            />
          </Card>
        </section>
      )}

      {buildingsWithoutUnits.length > 0 && (
        <section>
          <SectionHeading title="Edificios sin unidades" />
          <CardList>
            {buildingsWithoutUnits.map((b) => (
              <ListRow
                key={b.id}
                icon={<BuildingIcon className="size-[18px]" />}
                title={b.name}
                meta="Agregale una unidad para poder usarlo"
                onClick={() => setOrphanBuilding(b)}
              />
            ))}
          </CardList>
        </section>
      )}

      <section>
        <SectionHeading title="Cuenta" />
        <CardList>
          <ListRow
            icon={<UserIcon className="size-[18px]" />}
            title={user.name}
            meta={user.phone ? `${user.phone} · ${user.email}` : user.email}
            onClick={() => openSheet("profile")}
          />
          <ListRow
            icon={<LogoutIcon className="size-[18px]" />}
            title="Cerrar sesión"
            onClick={onLogout}
          />
        </CardList>
      </section>

      {sheet === "profile" && (
        <Screen title="Tu perfil" onClose={closeSheet}>
          <Card>
            <form className="space-y-4" onSubmit={saveProfile}>
              <Field label="Nombre">
                <input
                  className={inputClass}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email" hint="El email no se puede cambiar por ahora.">
                <input className={inputClass} value={user.email} disabled />
              </Field>
              <Field
                label="Teléfono"
                hint="Con esto el dueño o el inquilino te pueden llamar o escribir por WhatsApp."
              >
                <input
                  className={inputClass}
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="11 5555 0101"
                  required
                />
              </Field>
              <Field
                label="Alias de cobro"
                hint="Lo ven tus inquilinos para transferirte."
              >
                <input
                  className={inputClass}
                  value={profileAlias}
                  onChange={(e) => setProfileAlias(e.target.value)}
                  placeholder="tu.alias.mp"
                />
              </Field>
              <Field label="CBU / CVU">
                <input
                  className={inputClass}
                  value={profileCbu}
                  onChange={(e) => setProfileCbu(e.target.value)}
                  placeholder="0000003100010000000001"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Titular de la cuenta">
                <input
                  className={inputClass}
                  value={profileHolder}
                  onChange={(e) => setProfileHolder(e.target.value)}
                  placeholder="Nombre y apellido"
                />
              </Field>
              <Button block loading={busy}>
                Guardar
              </Button>
            </form>
          </Card>
        </Screen>
      )}

      {sheet === "building" && building && (
        <Screen title="Edificio" onClose={closeSheet}>
          {editing === "building" ? (
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
                <Field
                  label="Alias de cobro"
                  hint="Opcional. Si cargás algo acá, overridea el del perfil para este edificio."
                >
                  <input
                    className={inputClass}
                    value={buildingAlias}
                    onChange={(e) => setBuildingAlias(e.target.value)}
                    placeholder="Dejá vacío para usar el del perfil"
                  />
                </Field>
                <Field label="CBU / CVU del edificio">
                  <input
                    className={inputClass}
                    value={buildingCbu}
                    onChange={(e) => setBuildingCbu(e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Titular">
                  <input
                    className={inputClass}
                    value={buildingHolder}
                    onChange={(e) => setBuildingHolder(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </Button>
                  <Button block loading={busy}>
                    Guardar
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card>
              <p className="text-[13px] font-medium text-ink-500">Edificio</p>
              <p className="mt-1 text-[22px] font-semibold leading-tight text-ink-900">
                {building.name}
              </p>
              <div className="mt-4 divide-y divide-sand-200/70 rounded-xl bg-sand-50">
                <div className="px-3.5 py-3">
                  <p className="text-[12px] font-medium text-ink-400">Dirección</p>
                  <p className="mt-0.5 text-[15px] text-ink-900">{building.address}</p>
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-[12px] font-medium text-ink-400">Ciudad</p>
                  <p className="mt-0.5 text-[15px] text-ink-900">
                    {building.city || "Sin ciudad"}
                  </p>
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-[12px] font-medium text-ink-400">Cobro</p>
                  <p className="mt-0.5 text-[15px] text-ink-900">
                    {building.paymentAlias ||
                    building.paymentCbu ||
                    building.paymentHolder
                      ? [
                          building.paymentHolder,
                          building.paymentAlias,
                          building.paymentCbu,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "Usa el del perfil"}
                  </p>
                </div>
              </div>
              <Button
                className="mt-4"
                block
                variant="secondary"
                onClick={() => setEditing("building")}
              >
                Editar edificio
              </Button>
            </Card>
          )}

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
                      unit.id === property?.id ? (
                        <Badge tone="brand">Actual</Badge>
                      ) : undefined
                    }
                  />
                ))}
              </div>
              {editing === "addUnit" ? (
                <form
                  className="space-y-3 border-t border-sand-200/70 bg-sand-50/60 p-3"
                  onSubmit={async (e) => {
                    await addUnit(e);
                    setEditing(null);
                  }}
                >
                  <Field label="Nueva unidad">
                    <input
                      className={inputClass}
                      placeholder="3B"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      required
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      block
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </Button>
                    <Button block loading={busy}>
                      Agregar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-sand-200/70 p-3">
                  <Button
                    variant="secondary"
                    block
                    onClick={() => setEditing("addUnit")}
                  >
                    Agregar unidad
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <LinkButton onClick={() => openSheet("newBuilding")}>
              Crear otro edificio
            </LinkButton>
          </div>
        </Screen>
      )}

      {sheet === "unit" && property && (
        <Screen title={`Unidad ${property.label}`} onClose={closeSheet}>
          {editing === "unit" ? (
            <Card>
              <form className="space-y-4" onSubmit={saveUnit}>
                <Field
                  label="Etiqueta"
                  hint="Como la identificás: 3B, PB, Casa del fondo."
                >
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </Button>
                  <Button block loading={busy}>
                    Guardar
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card>
              <p className="text-[13px] font-medium text-ink-500">Unidad</p>
              <p className="mt-1 text-[22px] font-semibold leading-tight text-ink-900">
                {property.label}
              </p>
              <div className="mt-4 divide-y divide-sand-200/70 rounded-xl bg-sand-50">
                <div className="px-3.5 py-3">
                  <p className="text-[12px] font-medium text-ink-400">Piso</p>
                  <p className="mt-0.5 text-[15px] text-ink-900">
                    {property.floor || "Sin piso cargado"}
                  </p>
                </div>
              </div>
              <Button
                className="mt-4"
                block
                variant="secondary"
                onClick={() => setEditing("unit")}
              >
                Editar unidad
              </Button>
            </Card>
          )}
        </Screen>
      )}

      {sheet === "newBuilding" && (
        <Screen title="Nuevo edificio" onClose={closeSheet}>
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
              <Field
                label="Primera unidad"
                hint="Si es una casa sola, poné algo como “Casa” o “PB”."
              >
                <input
                  className={inputClass}
                  value={newBuildingUnit}
                  onChange={(e) => setNewBuildingUnit(e.target.value)}
                  placeholder="Depto 3B"
                  required
                />
              </Field>
              <Button block loading={busy}>
                Crear edificio
              </Button>
            </form>
          </Card>
          <p className="px-1 text-[13px] text-ink-400">
            Después podés sumarle más unidades desde la pantalla del edificio.
          </p>
        </Screen>
      )}

      {orphanBuilding && (
        <Screen
          title={orphanBuilding.name}
          onClose={() => setOrphanBuilding(null)}
        >
          <Card>
            <form className="space-y-4" onSubmit={addFirstUnit}>
              <Field
                label="Primera unidad"
                hint="Este edificio no tiene ninguna, por eso no aparece en el selector."
              >
                <input
                  className={inputClass}
                  value={orphanUnit}
                  onChange={(e) => setOrphanUnit(e.target.value)}
                  placeholder="Depto 3B"
                  required
                />
              </Field>
              <Button block loading={busy}>
                Agregar unidad
              </Button>
            </form>
          </Card>
        </Screen>
      )}

      {sheet === "contract" && property && (
        <Screen title="Contrato" onClose={closeSheet}>
          {editing === "contract" ? (
            <Card>
              <p className="mb-3 text-[15px] font-semibold text-ink-900">
                {contract ? "Editar contrato" : "Cargar contrato"}
              </p>
              {contract && (
                <p className="mb-3 text-[13px] text-ink-500">
                  Está cargado lo que dice el contrato vigente. Cambiá sólo lo que
                  haga falta.
                </p>
              )}
              <ContractForm
                key={contract?.id ?? "new"}
                contract={contract}
                requiredTypes={currentRequired}
                billSplitMode={property.billSplitMode}
                busy={busy}
                onSubmit={saveContract}
              />
              <Button
                className="mt-3"
                type="button"
                variant="secondary"
                block
                onClick={() => setEditing(null)}
              >
                Cancelar
              </Button>
            </Card>
          ) : contract ? (
            <>
              <Card>
                <p className="text-[13px] font-medium text-ink-500">Alquiler mensual</p>
                <p className="amount mt-1 text-[32px] leading-none text-ink-900">
                  {money(contract.rentAmount)}
                </p>
                <div className="mt-5 divide-y divide-sand-200/70 rounded-xl bg-sand-50">
                  <div className="flex justify-between gap-3 px-3.5 py-3">
                    <span className="text-[13px] text-ink-500">Inicio</span>
                    <span className="text-right text-[14px] font-medium text-ink-900">
                      {longDate(contract.startDate)}
                    </span>
                  </div>
                  {contract.endDate && (
                    <div className="flex justify-between gap-3 px-3.5 py-3">
                      <span className="text-[13px] text-ink-500">Fin</span>
                      <span className="text-right text-[14px] font-medium text-ink-900">
                        {longDate(contract.endDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 px-3.5 py-3">
                    <span className="text-[13px] text-ink-500">Aumento</span>
                    <span className="text-right text-[14px] font-medium text-ink-900">
                      Cada {contract.increaseEveryMonths} meses ·{" "}
                      {increaseMethodLabel(contract.increaseMethod)}
                      {contract.increaseNote ? ` (${contract.increaseNote})` : ""}
                    </span>
                  </div>
                  {nextIncrease && (
                    <div className="flex justify-between gap-3 px-3.5 py-3">
                      <span className="text-[13px] text-ink-500">Próximo aumento</span>
                      <span className="text-right text-[14px] font-medium text-ink-900">
                        {longDate(nextIncrease.toISOString())}
                      </span>
                    </div>
                  )}
                  {estimatedRent != null && (
                    <div className="flex justify-between gap-3 px-3.5 py-3">
                      <span className="text-[13px] text-ink-500">
                        Alquiler estimado
                        {increasePct != null ? ` (+${increasePct}%)` : ""}
                        {contract.estimateProjected ? " · proy." : ""}
                      </span>
                      <span className="text-right text-[14px] font-medium text-ink-900">
                        {money(estimatedRent)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 px-3.5 py-3">
                    <span className="text-[13px] text-ink-500">Facturas</span>
                    <span className="text-right text-[14px] font-medium text-ink-900">
                      {property.billSplitMode === "split_by_percentage"
                        ? "Se dividen por %"
                        : "Las paga el inquilino"}
                    </span>
                  </div>
                  {currentRequired.length > 0 && (
                    <div className="px-3.5 py-3">
                      <p className="text-[13px] text-ink-500">Facturas obligatorias</p>
                      <p className="mt-1 text-[14px] font-medium text-ink-900">
                        {currentRequired.join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
                {contract.filePath && (
                  <a
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-3 text-[14px] font-semibold text-brand-600"
                    href={api.fileUrl(contract.filePath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileIcon className="size-4" />
                    {contract.fileName ?? "Ver archivo del contrato"}
                  </a>
                )}
              </Card>
              {isOwner && contract.increaseDue && (
                <Card>
                  <p className="text-[15px] font-semibold text-ink-900">
                    Llegó la fecha de aumento
                  </p>
                  <p className="mt-1 text-[13px] text-ink-500">
                    {estimatedRent != null
                      ? `Estimado: ${money(estimatedRent)}${
                          increasePct != null ? ` (+${increasePct}%)` : ""
                        }. Se actualiza el contrato y se avisa al inquilino.`
                      : "No hay estimación automática; editá el contrato y cargá el nuevo monto."}
                  </p>
                  {estimatedRent != null && (
                    <Button
                      className="mt-4"
                      block
                      onClick={() => setConfirmIncrease(true)}
                    >
                      Aplicar aumento
                    </Button>
                  )}
                </Card>
              )}
              {rentHistory.length > 0 && (
                <div>
                  <SectionHeading title="Historial de alquiler" />
                  <Card padded={false}>
                    <div className="divide-y divide-sand-200/70">
                      {rentHistory.map((change) => (
                        <div key={change.id} className="px-4 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[15px] font-medium text-ink-900">
                                {change.kind === "initial"
                                  ? "Alquiler inicial"
                                  : change.kind === "applied"
                                    ? "Aumento aplicado"
                                    : "Cambio manual"}
                              </p>
                              <p className="mt-0.5 text-[13px] text-ink-500">
                                {longDate(change.effectiveDate)}
                                {change.increasePct != null
                                  ? ` · +${change.increasePct}%`
                                  : ""}
                                {change.note ? ` · ${change.note}` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {change.previousAmount != null && (
                                <p className="text-[12px] text-ink-400 line-through">
                                  {money(change.previousAmount)}
                                </p>
                              )}
                              <p className="text-[15px] font-semibold text-ink-900">
                                {money(change.newAmount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
              {isOwner && (
                <Button block onClick={() => setEditing("contract")}>
                  Editar contrato
                </Button>
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<FileIcon className="size-5" />}
                title="Sin contrato cargado"
                description={
                  isOwner
                    ? "Cargá el monto, las fechas, el aumento y el archivo."
                    : "El dueño todavía no subió el contrato."
                }
                action={
                  isOwner ? (
                    <Button size="sm" onClick={() => setEditing("contract")}>
                      Cargar contrato
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          )}
          {confirmIncrease && (
            <ConfirmDialog
              title="Aplicar aumento"
              description={
                contract?.estimatedRent != null
                  ? `El alquiler pasa a ${money(contract.estimatedRent)} y se le avisa al inquilino.`
                  : "Se aplica el aumento estimado y se le avisa al inquilino."
              }
              confirmLabel="Aplicar"
              busy={busy}
              onConfirm={applyIncrease}
              onCancel={() => setConfirmIncrease(false)}
            />
          )}
        </Screen>
      )}

      {sheet === "tenants" && property && (
        <Screen title="Inquilinos" onClose={closeSheet}>
          {tenants.length > 0 ? (
            <CardList>
              {tenants.map((tenancy) => (
                <div
                  key={tenancy.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink-900">
                      {tenancy.tenant?.name ?? "Inquilino"}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-500">
                      {[tenancy.tenant?.phone, tenancy.tenant?.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge>{tenancy.sharePercentage}%</Badge>
                      <LinkButton
                        tone="danger"
                        onClick={() =>
                          run(() => api.removeTenant(property.id, tenancy.id), {
                            success: "Inquilino quitado",
                          })
                        }
                      >
                        Quitar
                      </LinkButton>
                    </div>
                  </div>
                  <ContactActions
                    phone={tenancy.tenant?.phone}
                    waText={`Hola ${tenancy.tenant?.name ?? ""}, te escribo por la unidad ${property.label}.`}
                  />
                </div>
              ))}
            </CardList>
          ) : (
            <Card>
              <EmptyState
                icon={<UsersIcon className="size-5" />}
                title="Sin inquilinos"
                description="Creá un link de invitación o agregalo con el email de su cuenta Google."
              />
            </Card>
          )}

          {isOwner && (
            <Card>
              <p className="mb-1 text-[15px] font-semibold text-ink-900">
                Invitar por link
              </p>
              <p className="mb-3 text-[13px] text-ink-500">
                El inquilino abre el link, inicia con Google y queda asignado a
                esta unidad.
              </p>
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
              <Button
                className="mt-3"
                block
                loading={busy}
                onClick={createInviteLink}
              >
                Crear link de invitación
              </Button>
              {inviteUrl && (
                <div className="mt-3 space-y-2 rounded-xl bg-sand-50 p-3">
                  <p className="break-all text-[13px] text-ink-700">{inviteUrl}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      block
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteUrl);
                          toast.success("Link copiado");
                        } catch {
                          toast.error("No se pudo copiar");
                        }
                      }}
                    >
                      Copiar
                    </Button>
                    <a
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-sand-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-900"
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Hola, uníte a la unidad ${property.label} en Rently: ${inviteUrl}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </Card>
          )}

          {editing === "tenant" ? (
            <Card>
              <p className="mb-3 text-[15px] font-semibold text-ink-900">
                Agregar por email
              </p>
              <form className="space-y-4" onSubmit={addTenant}>
                <Field
                  label="Email"
                  hint="Tiene que haber iniciado sesión antes con ese Google."
                >
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </Button>
                  <Button block loading={busy}>
                    Asignar
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Button block variant="secondary" onClick={() => setEditing("tenant")}>
              Agregar por email
            </Button>
          )}
        </Screen>
      )}

      {sheet === "contacts" && property && (
        <Screen title="Contactos de emergencia" onClose={closeSheet}>
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
                          run(
                            () =>
                              api.deleteEmergencyContact(property.id, contact.id),
                            { success: "Contacto quitado" },
                          )
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

          {isOwner &&
            (editing === "contact" ? (
              <Card>
                <p className="mb-3 text-[15px] font-semibold text-ink-900">
                  Agregar contacto
                </p>
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
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      block
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </Button>
                    <Button block loading={busy}>
                      Guardar
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Button block variant="secondary" onClick={() => setEditing("contact")}>
                Agregar contacto
              </Button>
            ))}
        </Screen>
      )}

    </div>
  );
}
