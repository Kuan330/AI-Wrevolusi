import { useEffect, useState } from "react";

import {
  FILTER_ORDER,
  NEXT_FILTER,
  type OccupationFilterKey,
} from "@/pages/WorkProfile/occupationFilters";
import { referenceService } from "@/services/referenceService";
import type { ReferenceOccupation } from "@/types/reference";

const emptySelections = (): Record<OccupationFilterKey, ReferenceOccupation | null> => ({
  major: null,
  sub_major: null,
  minor: null,
  unit: null,
});

const emptyOptions = (): Record<OccupationFilterKey, ReferenceOccupation[]> => ({
  major: [],
  sub_major: [],
  minor: [],
  unit: [],
});

export const useOccupationFilters = () => {
  const [selections, setSelections] = useState(emptySelections);
  const [options, setOptions] = useState(emptyOptions);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReferenceOccupation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedUnit = selections.unit;
  const selectedPath = FILTER_ORDER.map((key) => selections[key]).filter(
    (item): item is ReferenceOccupation => Boolean(item),
  );

  const loadLevel = async (key: OccupationFilterKey, parent?: string) => {
    const rows = await referenceService.occupations(parent);
    setOptions((current) => ({ ...current, [key]: rows }));
    return rows;
  };

  useEffect(() => {
    let active = true;
    void referenceService
      .occupations()
      .then((rows) => {
        if (active) setOptions((current) => ({ ...current, major: rows }));
      })
      .catch(() => {
        if (active) setError("Unable to load occupations right now. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const clearAfter = (key: OccupationFilterKey) => {
    const start = FILTER_ORDER.indexOf(key);
    setSelections((current) => {
      const next = { ...current };
      FILTER_ORDER.slice(start + 1).forEach((level) => {
        next[level] = null;
      });
      return next;
    });
    setOptions((current) => {
      const next = { ...current };
      FILTER_ORDER.slice(start + 1).forEach((level) => {
        next[level] = [];
      });
      return next;
    });
  };

  const selectFilter = async (key: OccupationFilterKey, code: string) => {
    setError(null);
    if (!code) {
      setSelections((current) => ({ ...current, [key]: null }));
      clearAfter(key);
      return;
    }

    const chosen = options[key].find((item) => item.occupation_code === code) ?? null;
    setSelections((current) => ({ ...current, [key]: chosen }));
    clearAfter(key);

    const nextKey = NEXT_FILTER[key];
    if (chosen && nextKey) {
      setLoading(true);
      try {
        await loadLevel(nextKey, chosen.occupation_code);
      } catch {
        setError("Unable to load the next occupation list.");
      } finally {
        setLoading(false);
      }
    }
  };

  const searchUnits = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setHasSearched(true);
    setError(null);
    try {
      setSearchResults(await referenceService.searchOccupations(query.trim()));
    } catch {
      setError("Search is temporarily unavailable.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pathForUnit = async (unit: ReferenceOccupation) => {
    const path: ReferenceOccupation[] = [unit];
    let parent = unit.parent_code;
    while (parent) {
      const node = await referenceService.getOccupation(parent);
      path.unshift(node);
      parent = node.parent_code;
    }
    return path;
  };

  return {
    selections,
    options,
    query,
    setQuery,
    searchResults,
    hasSearched,
    loading,
    searching,
    error,
    selectedUnit,
    selectedPath,
    selectFilter,
    searchUnits,
    pathForUnit,
  };
};
