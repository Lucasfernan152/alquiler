import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Building, Property, PropertyOption } from "../types";

function optionsFromBuildings(buildings: Building[]): PropertyOption[] {
  return buildings.flatMap((building) =>
    (building.properties ?? []).map((property) => ({
      id: property.id,
      label: property.label,
      buildingId: building.id,
      buildingName: building.name,
      address: building.address,
      role: "owner" as const,
    })),
  );
}

export function usePropertyOptions(reloadKey: number) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [options, setOptions] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([api.buildings(), api.myTenancies()])
      .then(([ownedBuildings, tenancies]) => {
        if (!active) return;
        const tenantOptions: PropertyOption[] = tenancies
          .filter((t) => t.property)
          .map((t) => ({
            id: t.property!.id,
            label: t.property!.label,
            buildingId: t.property!.buildingId,
            buildingName: t.property!.building?.name ?? "Propiedad",
            address: t.property!.building?.address ?? "",
            role: "tenant" as const,
          }));

        const owned = optionsFromBuildings(ownedBuildings);
        const ownedIds = new Set(owned.map((o) => o.id));
        setBuildings(ownedBuildings);
        setOptions([...owned, ...tenantOptions.filter((t) => !ownedIds.has(t.id))]);
        setError("");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Error de red");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { buildings, options, loading, error };
}

export function useProperty(propertyId: string | null) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!propertyId) {
      setProperty(null);
      return;
    }
    setLoading(true);
    try {
      setProperty(await api.property(propertyId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { property, loading, error, reload: load };
}
