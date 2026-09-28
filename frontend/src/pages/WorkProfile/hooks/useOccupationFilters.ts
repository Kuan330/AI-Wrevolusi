import { useEffect, useRef, useState } from "react";
import { referenceService } from "@/services/referenceService";
import type { ReferenceOccupation } from "@/types/reference";

/** The database hierarchy stays behind the two user-facing choices. */
export const useOccupationFilters = () => {
  const [areas, setAreas] = useState<ReferenceOccupation[]>([]);
  const [area, setArea] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReferenceOccupation[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [areaError, setAreaError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<string, ReferenceOccupation>());

  useEffect(() => {
    let active = true;
    setLoadingAreas(true);
    setAreaError("");
    void referenceService.occupations().then(rows => {
      if (!active) return;
      setAreas(rows);
      rows.forEach(row => cache.current.set(row.occupation_code, row));
    }).catch(() => {
      if (active) setAreaError("Work areas could not load. You can still search by job title.");
    }).finally(() => { if (active) setLoadingAreas(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmed = query.trim();
    setResults([]);
    setHasSearched(false);
    setSearchError("");
    if ((!area && trimmed.length < 2) || trimmed.length === 1) {
      setSearching(false);
      return () => controller.abort();
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void referenceService.searchOccupations(trimmed, controller.signal, area || undefined).then(rows => {
        if (controller.signal.aborted) return;
        setResults(rows);
        setHasSearched(true);
      }).catch(() => {
        if (!controller.signal.aborted) setSearchError("Jobs could not load. Please try again.");
      }).finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, trimmed ? 400 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, area, attempt]);

  async function pathForUnit(unit: ReferenceOccupation): Promise<ReferenceOccupation[]> {
    const path = [unit];
    const seen = new Set([unit.occupation_code]);
    let parent = unit.parent_code;
    while (parent) {
      if (seen.has(parent)) throw new Error("This job's work area could not be checked. Please choose another job.");
      seen.add(parent);
      const row = cache.current.get(parent) ?? await referenceService.getOccupation(parent);
      cache.current.set(row.occupation_code, row);
      path.unshift(row);
      parent = row.parent_code;
    }
    return path;
  }

  return { areas, area, setArea, query, setQuery, results, loadingAreas, searching,
    hasSearched, areaError, searchError, pathForUnit, retry: () => setAttempt(value => value + 1) };
};
