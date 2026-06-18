"""DataAccessMatrixBuilder - role x data entity access matrix generator.

Maps data entities from use cases to roles, producing DataAccessEntry
rows that specify read/write/delete/export permissions per role per entity.
All data computed from inputs - no mock or stub values.
"""
from __future__ import annotations

from domain.models import (
    DataAccessEntry,
    DataSensitivity,
    PermissionScope,
    Role,
    UseCase,
)


class DataAccessMatrixBuilder:
    """Builds the role x data-entity access matrix.

    Usage:
        builder = DataAccessMatrixBuilder()
        entries = builder.generate(roles, use_cases)
    """

    def generate(
        self,
        roles: list[Role],
        use_cases: list[UseCase],
    ) -> list[DataAccessEntry]:
        """Generate a role x data entity access matrix.

        For each unique data entity found across all use cases, determines
        which roles should have read/write/delete/export access based on:
        - The use case's primary_actor and secondary_actors
        - The role's relationship to those actors
        - The data_entities_read and data_entities_written lists in each use case
        - Role name heuristics (admin gets broader access)

        Returns a flat list of DataAccessEntry, one per (role, entity) pair.
        """
        # Step 1: Collect all unique data entities and their access patterns
        entity_access = self._collect_entity_access(use_cases)

        # Step 2: Build a mapping of which actors are associated with which roles
        role_actor_map = self._build_role_actor_map(roles)

        # Step 3: For each role-entity combination, determine access rights
        entries: list[DataAccessEntry] = []

        for role in roles:
            for entity_name, access_info in entity_access.items():
                entry = self._determine_access(role, entity_name, access_info, role_actor_map)
                entries.append(entry)

        return entries

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _collect_entity_access(
        self,
        use_cases: list[UseCase],
    ) -> dict[str, dict[str, object]]:
        """Collect access patterns for each data entity across all use cases.

        Returns a dict mapping entity_name -> {
            "read_by": set(actor_names),
            "written_by": set(actor_names),
            "sensitivity": DataSensitivity,
        }
        """
        entity_access: dict[str, dict[str, object]] = {}

        for uc in use_cases:
            involved_actors = {uc.primary_actor} | set(uc.secondary_actors)
            sensitivity = uc.access_context.data_sensitivity if uc.access_context else DataSensitivity.INTERNAL

            # Entities that are read
            for entity in uc.data_entities_read:
                if entity not in entity_access:
                    entity_access[entity] = {
                        "read_by": set(),
                        "written_by": set(),
                        "sensitivity": sensitivity,
                    }
                entity_access[entity]["read_by"].update(involved_actors)
                # Sensitivity is the max of all use cases
                if sensitivity.value in ("restricted",) and entity_access[entity]["sensitivity"].value != "restricted":
                    entity_access[entity]["sensitivity"] = sensitivity
                elif sensitivity.value in ("confidential",) and entity_access[entity]["sensitivity"].value not in ("restricted",):
                    entity_access[entity]["sensitivity"] = sensitivity

            # Entities that are written
            for entity in uc.data_entities_written:
                if entity not in entity_access:
                    entity_access[entity] = {
                        "read_by": set(),
                        "written_by": set(),
                        "sensitivity": sensitivity,
                    }
                entity_access[entity]["written_by"].update(involved_actors)
                if sensitivity.value in ("restricted",) and entity_access[entity]["sensitivity"].value != "restricted":
                    entity_access[entity]["sensitivity"] = sensitivity
                elif sensitivity.value in ("confidential",) and entity_access[entity]["sensitivity"].value not in ("restricted",):
                    entity_access[entity]["sensitivity"] = sensitivity

        return entity_access

    def _build_role_actor_map(
        self,
        roles: list[Role],
    ) -> dict[str, list[str]]:
        """Build a mapping of role_id -> associated actor names."""
        role_actor_map: dict[str, list[str]] = {}
        for role in roles:
            role_actor_map[role.role_id] = role.actor_ids
        return role_actor_map

    def _determine_access(
        self,
        role: Role,
        entity_name: str,
        access_info: dict[str, object],
        role_actor_map: dict[str, list[str]],
    ) -> DataAccessEntry:
        """Determine the DataAccessEntry for a single (role, entity) pair.

        Uses role name heuristics and the access_info to decide read/write/delete/export.
        """
        role_name_lower = role.name.lower()
        role_id_lower = role.role_id.lower()
        read_by = access_info.get("read_by", set())
        written_by = access_info.get("written_by", set())
        sensitivity = access_info.get("sensitivity", DataSensitivity.INTERNAL)

        # Role type heuristics
        is_admin = "admin" in role_name_lower or "super" in role_name_lower or "admin" in role_id_lower
        is_system = role.is_system_role or "system" in role_id_lower
        is_guest = "guest" in role_name_lower or "viewer" in role_name_lower or "anon" in role_id_lower
        is_end_user = "user" in role_name_lower or "customer" in role_name_lower

        # Determine read access
        can_read = False
        if is_admin or is_system:
            can_read = True
        elif is_guest:
            can_read = sensitivity.value not in ("restricted", "confidential")
        else:
            # Regular roles can read if their actor is involved
            role_actors = set(role_actor_map.get(role.role_id, []))
            can_read = bool(role_actors & read_by) or not read_by  # default allow if no specific read_by

        # Determine write access
        can_write = False
        if is_admin:
            can_write = True
        elif is_system:
            can_write = True
        elif is_guest:
            can_write = False
        else:
            role_actors = set(role_actor_map.get(role.role_id, []))
            can_write = bool(role_actors & written_by)

        # Determine delete access (more restrictive)
        can_delete = False
        if is_admin:
            can_delete = sensitivity.value != "restricted"  # Admin can delete, but restricted needs extra care
        elif is_system:
            can_delete = True
        # End users and guests cannot delete

        # Determine export access (most restrictive)
        can_export = False
        if is_admin and sensitivity.value in ("public", "internal"):
            can_export = True
        elif is_system:
            can_export = True
        # Only admins can export, and not for confidential/restricted

        # Determine scope
        if is_admin or is_system:
            scope = PermissionScope.ALL
        elif is_end_user:
            scope = PermissionScope.OWN
        else:
            scope = PermissionScope.TEAM

        # Build conditions based on sensitivity
        conditions: list[str] = []
        if sensitivity.value == "restricted":
            conditions.append("Requires audit trail for all access")
        if sensitivity.value == "confidential":
            conditions.append("Access logged")
        if can_write and sensitivity.value in ("confidential", "restricted"):
            conditions.append("Write requires justification")

        return DataAccessEntry(
            role_id=role.role_id,
            data_entity=entity_name,
            read=can_read,
            write=can_write,
            delete_=can_delete,
            export=can_export,
            scope=scope,
            conditions=conditions,
            sensitivity=sensitivity,
        )
