import { useCallback, useEffect, useRef, useState } from "react";

import {
  FILTER_ORDER,
  NEXT_FILTER,
  type OccupationFilterKey,
} from "@/pages/WorkProfile/occupationFilters";
import { referenceService } from "@/services/referenceService";
import type { ReferenceOccupation } from "@/types/reference";

export type OccupationSearchResult = {
  unit: ReferenceOccupation;
  path: ReferenceOccupation[];
  pathLabel: string;
};

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
  const [searchResults, setSearchResults] = useState<OccupationSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const occupationCacheRef = useRef(new Map<string, ReferenceOccupation>());
  const activeSearchRequestRef = useRef(0);

  const selectedUnit = selections.unit;
  const selectedPath = FILTER_ORDER.map((key) => selections[key]).filter(
    (item): item is ReferenceOccupation => Boolean(item),
  );

  const cacheOccupations = useCallback((rows: ReferenceOccupation[]) => {
    rows.forEach((row) => {
      occupationCacheRef.current.set(row.occupation_code, row);
    });
  }, []);

  const getOccupationByCode = useCallback(async (code: string) => {
    const cached = occupationCacheRef.current.get(code);
    if (cached) return cached;
    const row = await referenceService.getOccupation(code);
    occupationCacheRef.current.set(row.occupation_code, row);
    return row;
  }, []);

  const loadLevel = async (key: OccupationFilterKey, parent?: string) => {
    const rows = await referenceService.occupations(parent);
    cacheOccupations(rows);
    setOptions((current) => ({ ...current, [key]: rows }));
    return rows;
  };

  useEffect(() => {
    let active = true;
    void referenceService
      .occupations()
      .then((rows) => {
        cacheOccupations(rows);
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

  const resetFilters = () => {
    setSelections(emptySelections());
    setOptions((current) => ({
      major: current.major,
      sub_major: [],
      minor: [],
      unit: [],
    }));
    setError(null);
  };

  const resetSearch = () => {
    activeSearchRequestRef.current += 1;
    setQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSearching(false);
    setError(null);
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

  const pathForUnit = useCallback(async (unit: ReferenceOccupation) => {
    cacheOccupations([unit]);
    const path: ReferenceOccupation[] = [unit];
    let parent = unit.parent_code;
    while (parent) {
      const node = await getOccupationByCode(parent);
      path.unshift(node);
      parent = node.parent_code;
    }
    return path;
  }, [cacheOccupations, getOccupationByCode]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHasSearched(false);
      setSearching(false);
      setSearchResults([]);
      return;
    }

    const requestId = activeSearchRequestRef.current + 1;
    activeSearchRequestRef.current = requestId;
    setSearching(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const matches = await referenceService.searchOccupations(trimmed);
          cacheOccupations(matches);
          const expanded = await Promise.all(
            matches.map(async (unit) => {
              const path = await pathForUnit(unit);
              const parentPath = path
                .slice(0, -1)
                .map((item) => item.title)
                .join(" › ");

              return {
                unit,
                path,
                pathLabel: parentPath,
              };
            }),
          );
          if (activeSearchRequestRef.current !== requestId) return;
          setSearchResults(expanded);
          setHasSearched(true);
        } catch {
          if (activeSearchRequestRef.current !== requestId) return;
          setError("Search is temporarily unavailable.");
          setSearchResults([]);
          setHasSearched(true);
        } finally {
          if (activeSearchRequestRef.current === requestId) {
            setSearching(false);
          }
        }
      })();
    }, 220);

    return () => clearTimeout(timer);
  }, [cacheOccupations, pathForUnit, query]);

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
    pathForUnit,
    resetFilters,
    resetSearch,
  };
};
