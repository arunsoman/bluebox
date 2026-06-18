"""ExtractionRegistry — cross-chunk entity resolution and merge logic.

Carried as ``deps`` through the async generator pipeline.  Each chunk's
extraction is given the *known actor/capability names so far* in its
prompt context so the model can match "Admin" to an existing actor
instead of creating "Administrator" as a duplicate.

A final lightweight reconciliation pass merges near-duplicate names.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from .models import (
    ChunkResult,
    ExtractedActor,
    ExtractedCapability,
    ExtractedPRD,
    ExtractedUseCase,
    ExtractedUserStory,
)

# Names shorter than this are excluded from fuzzy-dedup (too noisy).
_MIN_NAME_LEN_FOR_FUZZY: int = 4
# Similarity threshold for near-duplicate name merging.
_FUZZY_THRESHOLD: float = 0.85


class ExtractionRegistry:
    """Running registry of entities discovered across chunks.

    Usage::

        registry = ExtractionRegistry()
        for chunk in chunks:
            # ... extract chunk_result ...
            registry.absorb(chunk_result)
            # Use registry.known_actor_names for the next chunk's prompt
    """

    def __init__(self) -> None:
        self._actors: dict[str, ExtractedActor] = {}
        self._capabilities: dict[str, ExtractedCapability] = {}
        self._use_cases: dict[str, ExtractedUseCase] = {}
        self._user_stories: dict[str, ExtractedUserStory] = {}
        self._non_functional: list[str] = []
        self._architecture: list[str] = []
        self._api: list[str] = []
        self._data_model: list[str] = []
        self._security: list[str] = []
        self._ui_ux: list[str] = []
        self._out_of_scope: list[str] = []
        self._thin: list[str] = []
        self._conflicting: list[str] = []

    # ------------------------------------------------------------------
    # Read-only views (used to build prompts for downstream chunks)
    # ------------------------------------------------------------------

    @property
    def known_actor_names(self) -> list[str]:
        return [a.name for a in self._actors.values()]

    @property
    def known_actor_ids(self) -> list[str]:
        return list(self._actors.keys())

    @property
    def known_capability_names(self) -> list[str]:
        return [c.name for c in self._capabilities.values()]

    @property
    def known_capability_ids(self) -> list[str]:
        return list(self._capabilities.keys())

    @property
    def known_use_case_names(self) -> list[str]:
        return [uc.name for uc in self._use_cases.values()]

    @property
    def known_use_case_ids(self) -> list[str]:
        return list(self._use_cases.keys())

    @property
    def actor_count(self) -> int:
        return len(self._actors)

    @property
    def capability_count(self) -> int:
        return len(self._capabilities)

    # ------------------------------------------------------------------
    # Absorb a ChunkResult into the registry
    # ------------------------------------------------------------------

    def absorb(self, result: ChunkResult) -> None:
        """Merge a *result* into the running registry, deduping by ID."""
        for actor in result.actors:
            self._merge_actor(actor)
        for cap in result.capabilities:
            self._merge_capability(cap)
        for uc in result.use_cases:
            self._merge_use_case(uc)
        for us in result.user_stories:
            self._merge_user_story(us)

        self._extend_unique(self._non_functional, result.non_functional_requirements)
        self._extend_unique(self._architecture, result.architecture_hints)
        self._extend_unique(self._api, result.api_hints)
        self._extend_unique(self._data_model, result.data_model_hints)
        self._extend_unique(self._security, result.security_hints)
        self._extend_unique(self._ui_ux, result.ui_ux_hints)
        self._extend_unique(self._out_of_scope, result.out_of_scope)
        self._extend_unique(self._thin, result.thin_statements)
        self._extend_unique(self._conflicting, result.conflicting_statements)

    # ------------------------------------------------------------------
    # Resolve dangling references
    # ------------------------------------------------------------------

    def resolve_dangling_references(self) -> list[str]:
        """Strip actor/capability IDs that don't exist in the registry.

        Returns a list of human-readable warnings for diagnostics.
        """
        warnings: list[str] = []
        known_actors = set(self.known_actor_ids)
        known_caps = set(self.known_capability_ids)
        known_ucs = set(self.known_use_case_ids)

        for cap in self._capabilities.values():
            valid = [aid for aid in cap.actor_ids if aid in known_actors]
            dropped = [aid for aid in cap.actor_ids if aid not in known_actors]
            cap.actor_ids = valid
            for d in dropped:
                warnings.append(f"Capability '{cap.name}' dropped unknown actor ref '{d}'")

        for uc in self._use_cases.values():
            valid_a = [aid for aid in uc.actor_ids if aid in known_actors]
            dropped_a = [aid for aid in uc.actor_ids if aid not in known_actors]
            uc.actor_ids = valid_a
            for d in dropped_a:
                warnings.append(f"UseCase '{uc.name}' dropped unknown actor ref '{d}'")

            valid_c = [cid for cid in uc.capability_ids if cid in known_caps]
            dropped_c = [cid for cid in uc.capability_ids if cid not in known_caps]
            uc.capability_ids = valid_c
            for d in dropped_c:
                warnings.append(f"UseCase '{uc.name}' dropped unknown cap ref '{d}'")

        for us in self._user_stories.values():
            if us.actor_id and us.actor_id not in known_actors:
                warnings.append(f"UserStory '{us.title}' dropped unknown actor ref '{us.actor_id}'")
                us.actor_id = ""
            if us.use_case_id and us.use_case_id not in known_ucs:
                warnings.append(f"UserStory '{us.title}' dropped unknown uc ref '{us.use_case_id}'")
                us.use_case_id = ""

        return warnings

    # ------------------------------------------------------------------
    # Final fuzzy dedup pass
    # ------------------------------------------------------------------

    def reconcile_near_duplicates(self) -> list[str]:
        """Merge actors/caps whose names are > threshold similar.

        Returns a list of merge actions performed for diagnostics.
        """
        actions: list[str] = []
        actions.extend(self._fuzzy_merge_actors())
        actions.extend(self._fuzzy_merge_capabilities())
        return actions

    def _fuzzy_merge_actors(self) -> list[str]:
        actions: list[str] = []
        actors = list(self._actors.values())
        merged_ids: set[str] = set()

        for i, a1 in enumerate(actors):
            if a1.id in merged_ids:
                continue
            for a2 in actors[i + 1 :]:
                if a2.id in merged_ids:
                    continue
                if _should_fuzzy_merge(a1.name, a2.name):
                    # Merge a2 into a1, prefer a1's data
                    a1.responsibilities = _uniq(
                        a1.responsibilities + a2.responsibilities
                    )
                    if not a1.description:
                        a1.description = a2.description
                    if not a1.role:
                        a1.role = a2.role
                    merged_ids.add(a2.id)
                    del self._actors[a2.id]
                    actions.append(f"Merged actor '{a2.name}' into '{a1.name}'")
        return actions

    def _fuzzy_merge_capabilities(self) -> list[str]:
        actions: list[str] = []
        caps = list(self._capabilities.values())
        merged_ids: set[str] = set()

        for i, c1 in enumerate(caps):
            if c1.id in merged_ids:
                continue
            for c2 in caps[i + 1 :]:
                if c2.id in merged_ids:
                    continue
                if _should_fuzzy_merge(c1.name, c2.name):
                    c1.features = _uniq(c1.features + c2.features)
                    if not c1.description:
                        c1.description = c2.description
                    merged_ids.add(c2.id)
                    del self._capabilities[c2.id]
                    actions.append(f"Merged capability '{c2.name}' into '{c1.name}'")
        return actions

    # ------------------------------------------------------------------
    # Name → ID resolution (for regex-extracted entities)
    # ------------------------------------------------------------------

    def _resolve_name_to_id_references(self) -> None:
        """Convert name-based references to resolved ID references.

        Regex extraction populates actor_names / capability_names /
        actor_name / use_case_name (strings).  This method converts
        them to actor_ids / capability_ids / actor_id / use_case_id
        by looking up names in the registry's ID-keyed dictionaries.
        """
        # Build name → ID maps
        actor_name_to_id: dict[str, str] = {}
        for aid, a in self._actors.items():
            actor_name_to_id[a.name.lower()] = aid

        cap_name_to_id: dict[str, str] = {}
        for cid, c in self._capabilities.items():
            cap_name_to_id[c.name.lower()] = cid

        uc_name_to_id: dict[str, str] = {}
        for uid, u in self._use_cases.items():
            uc_name_to_id[u.name.lower()] = uid

        # Resolve capability actor references
        for cap in self._capabilities.values():
            resolved: list[str] = []
            for name in cap.actor_names:
                aid = actor_name_to_id.get(name.lower())
                if aid:
                    resolved.append(aid)
            if resolved:
                cap.actor_ids = _uniq(cap.actor_ids + resolved)

        # Resolve use case actor + capability references
        for uc in self._use_cases.values():
            # Actor names → IDs
            resolved_a: list[str] = []
            for name in uc.actor_names:
                aid = actor_name_to_id.get(name.lower())
                if aid:
                    resolved_a.append(aid)
            if resolved_a:
                uc.actor_ids = _uniq(uc.actor_ids + resolved_a)

            # Capability names → IDs
            resolved_c: list[str] = []
            for name in uc.capability_names:
                cid = cap_name_to_id.get(name.lower())
                if cid:
                    resolved_c.append(cid)
            if resolved_c:
                uc.capability_ids = _uniq(uc.capability_ids + resolved_c)

        # Resolve user story actor + use case references
        for us in self._user_stories.values():
            if us.actor_name and not us.actor_id:
                aid = actor_name_to_id.get(us.actor_name.lower())
                if aid:
                    us.actor_id = aid
            if us.use_case_name and not us.use_case_id:
                uid = uc_name_to_id.get(us.use_case_name.lower())
                if uid:
                    us.use_case_id = uid

    # ------------------------------------------------------------------
    # Build final ExtractedPRD
    # ------------------------------------------------------------------

    def to_prd(self, word_count: int = 0, has_structure: bool = False, explicit_sections: list[str] | None = None) -> ExtractedPRD:
        """Materialise the registry into a final ``ExtractedPRD``.

        Resolves name-based references (actor_names → actor_ids,
        capability_names → capability_ids, actor_name → actor_id,
        use_case_name → use_case_id) before materialising.
        """
        self._resolve_name_to_id_references()

        return ExtractedPRD(
            actors=list(self._actors.values()),
            capabilities=list(self._capabilities.values()),
            use_cases=list(self._use_cases.values()),
            user_stories=list(self._user_stories.values()),
            non_functional_requirements=self._non_functional,
            architecture_hints=self._architecture,
            api_hints=self._api,
            data_model_hints=self._data_model,
            security_hints=self._security,
            ui_ux_hints=self._ui_ux,
            out_of_scope=self._out_of_scope,
            thin_statements=self._thin,
            conflicting_statements=self._conflicting,
            word_count=word_count,
            has_structure=has_structure,
            explicit_sections_found=explicit_sections or [],
        )

    # ------------------------------------------------------------------
    # Internal merge helpers
    # ------------------------------------------------------------------

    def _merge_actor(self, actor: ExtractedActor) -> None:
        existing = self._actors.get(actor.id)
        if existing is None:
            self._actors[actor.id] = actor
            return
        # Merge fields, preferring existing non-empty values
        if actor.description and not existing.description:
            existing.description = actor.description
        if actor.role and not existing.role:
            existing.role = actor.role
        existing.responsibilities = _uniq(
            existing.responsibilities + actor.responsibilities
        )

    def _merge_capability(self, cap: ExtractedCapability) -> None:
        existing = self._capabilities.get(cap.id)
        if existing is None:
            self._capabilities[cap.id] = cap
            return
        if cap.description and not existing.description:
            existing.description = cap.description
        existing.features = _uniq(existing.features + cap.features)
        existing.actor_ids = _uniq(existing.actor_ids + cap.actor_ids)

    def _merge_use_case(self, uc: ExtractedUseCase) -> None:
        existing = self._use_cases.get(uc.id)
        if existing is None:
            self._use_cases[uc.id] = uc
            return
        if uc.description and not existing.description:
            existing.description = uc.description
        existing.preconditions = _uniq(existing.preconditions + uc.preconditions)
        existing.postconditions = _uniq(existing.postconditions + uc.postconditions)
        existing.main_flow = uc.main_flow or existing.main_flow
        existing.actor_ids = _uniq(existing.actor_ids + uc.actor_ids)
        existing.capability_ids = _uniq(existing.capability_ids + uc.capability_ids)

    def _merge_user_story(self, us: ExtractedUserStory) -> None:
        existing = self._user_stories.get(us.id)
        if existing is None:
            self._user_stories[us.id] = us
            return
        if us.description and not existing.description:
            existing.description = us.description
        existing.acceptance_criteria = _uniq(
            existing.acceptance_criteria + us.acceptance_criteria
        )
        if us.actor_id:
            existing.actor_id = us.actor_id
        if us.use_case_id:
            existing.use_case_id = us.use_case_id

    @staticmethod
    def _extend_unique(target: list[str], additions: list[str]) -> None:
        for item in additions:
            if item not in target:
                target.append(item)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _uniq(seq: list[str]) -> list[str]:
    """Preserve order, remove duplicates."""
    seen: set[str] = set()
    out: list[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _name_similarity(a: str, b: str) -> float:
    """Case-insensitive similarity ratio for short names."""
    a_clean = a.lower().strip()
    b_clean = b.lower().strip()
    if not a_clean or not b_clean:
        return 0.0
    if len(a_clean) < _MIN_NAME_LEN_FOR_FUZZY or len(b_clean) < _MIN_NAME_LEN_FOR_FUZZY:
        return 1.0 if a_clean == b_clean else 0.0
    return SequenceMatcher(None, a_clean, b_clean).ratio()


# Names that differ only by a trailing integer (e.g. "Feature 0" vs "Feature 1")
# should NOT be fuzzy-merged — they're intentionally distinct.
_TRAILING_NUMBER_RE = re.compile(r"\s+\d+$")


def _should_fuzzy_merge(a: str, b: str) -> bool:
    """Return ``True`` if *a* and *b* are near-duplicates worth merging.

    Guards against merging numbered siblings ("Feature 0" / "Feature 1")
    which share a high substring similarity but are intentionally distinct.
    """
    sim = _name_similarity(a, b)
    if sim < _FUZZY_THRESHOLD:
        return False

    # If stripping trailing numbers from both produces the same string,
    # they're numbered variants — skip merging.
    a_stripped = _TRAILING_NUMBER_RE.sub("", a.lower().strip())
    b_stripped = _TRAILING_NUMBER_RE.sub("", b.lower().strip())
    if a_stripped == b_stripped and a_stripped:
        return False

    return True
