"""AdvisoryService -- coordinates the three advisor modules:
Scaling, Tech Stack, and RBAC.

Each advisor produces options that are presented to the user via SSE,
and the user's selections are persisted back to the session state.
"""
from __future__ import annotations

from typing import Any

from domain.models import (
    ScaleInputs,
    ScalePersona,
    HostingOption,
    HostingModel,
    TechStackOption,
    TechStackProfile,
    RBACModel,
    RBACSteeringActionDTO,
    CostRange,
    OpsComplexity,
    Confidence,
    ScaleFit,
    LearningCurve,
)
from domain.state_management.pipeline_state import PipelineStateManager
from infrastructure.messaging.sse_manager import sse_manager


class AdvisoryService:
    """Coordinates scaling, tech stack, and RBAC advisors."""

    def __init__(
        self,
        state_manager: PipelineStateManager | None = None,
    ):
        self._state = state_manager or PipelineStateManager()

    # ==================================================================
    # Scaling Advisor
    # ==================================================================

    async def run_scaling_advisor(self, session_id: str) -> None:
        """Run the scaling advisor to generate hosting options.

        Reads scale inputs from session state, determines the scale
        persona, generates hosting options, and emits them via SSE.

        Args:
            session_id: Pipeline session ID.
        """
        import uuid

        state = await self._state.get_state(session_id)
        scale_inputs_data = state.get("scale_inputs", {})

        # Determine scale persona from inputs
        scale_inputs = ScaleInputs(**scale_inputs_data) if scale_inputs_data else ScaleInputs()
        persona = self._determine_scale_persona(scale_inputs)

        # Generate hosting options
        options = self._generate_hosting_options(persona)

        # Store in session state
        await self._state.update_state(
            session_id,
            {
                "scale_persona": persona.value,
                "hosting_options": [o.model_dump(mode="json") for o in options],
            },
        )

        # Emit via SSE
        await sse_manager.emit_hosting_options(
            session_id,
            [o.model_dump(mode="json") for o in options],
            persona.value,
        )

    async def submit_scale_inputs(self, session_id: str, inputs: ScaleInputs) -> dict[str, Any]:
        """Submit scale inputs and re-run the scaling advisor.

        Args:
            session_id: Pipeline session ID.
            inputs: ScaleInputs with user-provided values.

        Returns:
            Dict with the determined persona and options count.
        """
        await self._state.update_state(
            session_id, {"scale_inputs": inputs.model_dump(mode="json")}
        )
        await self.run_scaling_advisor(session_id)

        state = await self._state.get_state(session_id)
        persona = state.get("scale_persona", "CUSTOM")
        options = state.get("hosting_options", [])

        return {"persona": persona, "options_count": len(options)}

    async def select_hosting(self, session_id: str, option_id: str) -> dict[str, Any]:
        """Select a hosting option.

        Args:
            session_id: Pipeline session ID.
            option_id: The selected hosting option ID.

        Returns:
            Dict with selection confirmation.
        """
        state = await self._state.get_state(session_id)
        options = state.get("hosting_options", [])

        selected = None
        for opt_data in options:
            if opt_data.get("option_id") == option_id:
                selected = HostingOption(**opt_data)
                break

        if selected is None:
            return {"status": "error", "message": f"Hosting option {option_id} not found"}

        # Build and store infrastructure profile
        profile = self._build_infrastructure_profile(selected, state)
        await self._state.update_state(
            session_id,
            {
                "selected_hosting_option": selected.model_dump(mode="json"),
                "infrastructure_profile": profile.model_dump(mode="json"),
            },
        )

        await sse_manager.emit(
            session_id,
            "HOSTING_OPTION_SELECTED",
            {"option_id": option_id, "label": selected.label},
        )

        return {"status": "selected", "option_id": option_id, "label": selected.label}

    # ==================================================================
    # Tech Stack Advisor
    # ==================================================================

    async def run_tech_stack_advisor(self, session_id: str) -> None:
        """Run the tech stack advisor to generate stack options.

        Reads signals from session state and emits options via SSE.

        Args:
            session_id: Pipeline session ID.
        """
        import uuid

        state = await self._state.get_state(session_id)
        hosting_option_data = state.get("selected_hosting_option", {})
        tech_signal_data = state.get("tech_stack_signal", {})
        hosting_model_str = hosting_option_data.get("hosting_model", "container_managed")

        # Generate tech stack options based on hosting model
        options = self._generate_tech_stack_options(hosting_model_str, tech_signal_data)

        await self._state.update_state(
            session_id,
            {"tech_stack_options": [o.model_dump(mode="json") for o in options]},
        )

        await sse_manager.emit_tech_stack_options(
            session_id, [o.model_dump(mode="json") for o in options]
        )

    async def select_tech_stack(self, session_id: str, option_id: str) -> dict[str, Any]:
        """Select a tech stack option.

        Args:
            session_id: Pipeline session ID.
            option_id: The selected tech stack option ID.

        Returns:
            Dict with selection confirmation.
        """
        state = await self._state.get_state(session_id)
        options = state.get("tech_stack_options", [])

        selected = None
        for opt_data in options:
            if opt_data.get("option_id") == option_id:
                selected = TechStackOption(**opt_data)
                break

        if selected is None:
            return {"status": "error", "message": f"Tech stack option {option_id} not found"}

        profile = self._build_tech_stack_profile(selected)
        await self._state.update_state(
            session_id,
            {
                "selected_tech_stack": selected.model_dump(mode="json"),
                "tech_stack_profile": profile.model_dump(mode="json"),
            },
        )

        await sse_manager.emit(
            session_id,
            "TECH_STACK_SELECTED",
            {"option_id": option_id, "label": selected.label},
        )

        return {"status": "selected", "option_id": option_id, "label": selected.label}

    # ==================================================================
    # RBAC Advisor
    # ==================================================================

    async def run_rbac_advisor(self, session_id: str) -> None:
        """Run the RBAC advisor to generate a role model.

        Discovers actors from session state and produces an RBAC model
        with roles, permissions, and data access entries.

        Args:
            session_id: Pipeline session ID.
        """
        import uuid

        state = await self._state.get_state(session_id)
        actor_data = state.get("actors", [])
        capabilities_data = state.get("capabilities", [])

        rbac_model = self._generate_rbac_model(session_id, actor_data, capabilities_data)

        await self._state.update_state(
            session_id, {"rbac_model": rbac_model.model_dump(mode="json")}
        )

        await sse_manager.emit_rbac_model(
            session_id, rbac_model.model_dump(mode="json")
        )

    async def update_rbac(self, session_id: str, action: RBACSteeringActionDTO) -> dict[str, Any]:
        """Apply an RBAC steering action.

        Args:
            session_id: Pipeline session ID.
            action: RBAC steering action DTO.

        Returns:
            Action result dict.
        """
        state = await self._state.get_state(session_id)
        rbac_data = state.get("rbac_model", {})

        if not rbac_data:
            return {"status": "error", "message": "No RBAC model found"}

        rbac_model = RBACModel(**rbac_data)

        action_type = action.action_type
        payload = action.payload

        if action_type == "add_role":
            role_data = payload.get("role", {})
            rbac_model.roles.append(role_data)
        elif action_type == "remove_role":
            role_id = payload.get("role_id", "")
            rbac_model.roles = [r for r in rbac_model.roles if r.get("role_id") != role_id]
        elif action_type == "grant_permission":
            entry = payload.get("entry", {})
            rbac_model.permission_matrix.append(entry)
        elif action_type == "revoke_permission":
            entry_id = payload.get("entry_id", "")
            rbac_model.permission_matrix = [
                e for e in rbac_model.permission_matrix if e.get("permission_id") != entry_id
            ]
        elif action_type == "grant_data_access":
            entry = payload.get("entry", {})
            rbac_model.data_access_matrix.append(entry)

        await self._state.update_state(
            session_id, {"rbac_model": rbac_model.model_dump(mode="json")}
        )

        await sse_manager.emit_rbac_model(
            session_id, rbac_model.model_dump(mode="json")
        )

        return {"status": "updated", "action": action_type}

    async def finalize_rbac(self, session_id: str) -> dict[str, Any]:
        """Finalize the RBAC model -- mark as committed.

        Args:
            session_id: Pipeline session ID.

        Returns:
            Finalization confirmation.
        """
        state = await self._state.get_state(session_id)
        rbac_data = state.get("rbac_model", {})

        if rbac_data:
            rbac_data["finalized"] = True
            await self._state.update_state(session_id, {"rbac_model": rbac_data})

        await sse_manager.emit(
            session_id,
            "RBAC_FINALIZED",
            {"session_id": session_id, "finalized": True},
        )

        return {"status": "finalized", "session_id": session_id}

    # ==================================================================
    # Internal: Scaling helpers
    # ==================================================================

    @staticmethod
    def _determine_scale_persona(inputs: ScaleInputs) -> ScalePersona:
        """Determine scale persona from inputs."""
        try:
            launch = int(inputs.launch_users) if inputs.launch_users else 0
        except (TypeError, ValueError):
            launch = 0

        if launch < 1000:
            return ScalePersona.SMALL
        elif launch < 50000:
            return ScalePersona.MEDIUM
        else:
            return ScalePersona.LARGE

    @staticmethod
    def _generate_hosting_options(persona: ScalePersona) -> list[HostingOption]:
        """Generate hosting options based on scale persona."""
        import uuid

        options = []

        if persona == ScalePersona.SMALL:
            options = [
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Serverless (AWS Lambda / Vercel)",
                    hosting_model=HostingModel.SERVERLESS,
                    provider="AWS/Vercel",
                    services_required=["lambda", "api_gateway", "s3"],
                    estimated_monthly_cost_usd=CostRange(low_usd=50, mid_usd=150, high_usd=500),
                    estimated_annual_cost_usd=CostRange(low_usd=600, mid_usd=1800, high_usd=6000),
                    scale_ceiling="10,000 concurrent",
                    strengths=["Low operational overhead", "Pay per use", "Auto-scaling"],
                    limitations=["Cold starts", "Vendor lock-in", "Execution time limits"],
                    time_to_production="1-2 weeks",
                    ops_complexity=OpsComplexity.LOW,
                    confidence=Confidence.HIGH,
                    rationale="Ideal for small launches with uncertain growth",
                ),
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Managed Containers (ECS/Fargate)",
                    hosting_model=HostingModel.CONTAINER_MANAGED,
                    provider="AWS/GCP",
                    services_required=["ecs", "alb", "rds"],
                    estimated_monthly_cost_usd=CostRange(low_usd=100, mid_usd=300, high_usd=800),
                    estimated_annual_cost_usd=CostRange(low_usd=1200, mid_usd=3600, high_usd=9600),
                    scale_ceiling="100,000 concurrent",
                    strengths=["More control than serverless", "No cold starts", "Familiar model"],
                    limitations=["Higher baseline cost", "Need container expertise"],
                    time_to_production="2-4 weeks",
                    ops_complexity=OpsComplexity.MEDIUM,
                    confidence=Confidence.HIGH,
                    rationale="Good balance of control and managed operations",
                ),
            ]
        elif persona == ScalePersona.MEDIUM:
            options = [
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Managed Containers (GKE/EKS)",
                    hosting_model=HostingModel.CONTAINER_MANAGED,
                    provider="AWS/GCP",
                    services_required=["eks", "alb", "rds", "redis"],
                    estimated_monthly_cost_usd=CostRange(low_usd=500, mid_usd=1500, high_usd=5000),
                    estimated_annual_cost_usd=CostRange(low_usd=6000, mid_usd=18000, high_usd=60000),
                    scale_ceiling="500,000 concurrent",
                    strengths=["Kubernetes ecosystem", "Good scaling", "Portability"],
                    limitations=["Kubernetes complexity", "Higher cost at scale"],
                    time_to_production="3-6 weeks",
                    ops_complexity=OpsComplexity.MEDIUM,
                    confidence=Confidence.HIGH,
                ),
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Hybrid (Cloud + On-prem data)",
                    hosting_model=HostingModel.HYBRID,
                    provider="Multi-cloud",
                    services_required=["k8s", "vpn", "rds"],
                    estimated_monthly_cost_usd=CostRange(low_usd=1000, mid_usd=3000, high_usd=8000),
                    estimated_annual_cost_usd=CostRange(low_usd=12000, mid_usd=36000, high_usd=96000),
                    scale_ceiling="1,000,000 concurrent",
                    strengths=["Data residency compliance", "Best of both worlds"],
                    limitations=["Complex networking", "Higher ops overhead"],
                    time_to_production="6-10 weeks",
                    ops_complexity=OpsComplexity.HIGH,
                    confidence=Confidence.MEDIUM,
                ),
            ]
        else:  # LARGE
            options = [
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Kubernetes Cluster (Self-managed)",
                    hosting_model=HostingModel.CONTAINER_MANAGED,
                    provider="AWS/GCP/Azure",
                    services_required=["eks", "alb", "rds", "redis", "kafka"],
                    estimated_monthly_cost_usd=CostRange(low_usd=5000, mid_usd=15000, high_usd=50000),
                    estimated_annual_cost_usd=CostRange(low_usd=60000, mid_usd=180000, high_usd=600000),
                    scale_ceiling="Unlimited",
                    strengths=["Full control", "Best performance", "Multi-region"],
                    limitations=["Requires dedicated ops team", "Complex setup"],
                    time_to_production="8-12 weeks",
                    ops_complexity=OpsComplexity.HIGH,
                    confidence=Confidence.HIGH,
                ),
                HostingOption(
                    option_id=str(uuid.uuid4()),
                    label="Multi-cloud with Edge",
                    hosting_model=HostingModel.HYBRID,
                    provider="AWS + GCP + CloudFlare",
                    services_required=["k8s", "cdn", "edge_workers"],
                    estimated_monthly_cost_usd=CostRange(low_usd=10000, mid_usd=30000, high_usd=100000),
                    estimated_annual_cost_usd=CostRange(low_usd=120000, mid_usd=360000, high_usd=1200000),
                    scale_ceiling="Global scale",
                    strengths=["Global low latency", "No single vendor", "Maximum resilience"],
                    limitations=["Very complex", "Requires platform team", "Highest cost"],
                    time_to_production="12-16 weeks",
                    ops_complexity=OpsComplexity.HIGH,
                    confidence=Confidence.MEDIUM,
                ),
            ]

        return options

    @staticmethod
    def _build_infrastructure_profile(
        selected: HostingOption, state: dict[str, Any]
    ) -> "InfrastructureProfile":
        """Build an infrastructure profile from a selected hosting option."""
        import uuid
        from domain.models import InfrastructureProfile, InfraComponent

        components: list[InfraComponent] = []
        for svc in selected.services_required:
            components.append(
                InfraComponent(
                    component_name=svc,
                    service_name=svc,
                    quantity=1,
                    notes=f"Required for {selected.hosting_model.value}",
                )
            )

        return InfrastructureProfile(
            profile_id=str(uuid.uuid4()),
            scale_persona=ScalePersona.CUSTOM,
            selected_hosting_option=selected,
            estimated_monthly_cost=selected.estimated_monthly_cost_usd,
            estimated_annual_cost=selected.estimated_annual_cost_usd,
            infrastructure_components=components,
        )

    # ==================================================================
    # Internal: Tech Stack helpers
    # ==================================================================

    @staticmethod
    def _generate_tech_stack_options(
        hosting_model: str, tech_signals: dict[str, Any]
    ) -> list[TechStackOption]:
        """Generate tech stack options based on hosting model and detected signals."""
        import uuid

        detected = tech_signals.get("detected_technologies", [])

        # Base options for container-managed hosting
        options = [
            TechStackOption(
                option_id=str(uuid.uuid4()),
                label="Full-stack TypeScript (Next.js + Node)",
                frontend="Next.js / React",
                backend="Node.js / NestJS",
                database="PostgreSQL",
                cache="Redis",
                message_broker="Redis Pub/Sub",
                auth_provider="Auth0 / Clerk",
                hosting=hosting_model,
                ci_cd="GitHub Actions",
                monitoring="Datadog / Grafana",
                rationale="Unified TypeScript ecosystem with strong community",
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.MEDIUM,
                community_maturity=Confidence.HIGH,
                confidence=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=str(uuid.uuid4()),
                label="Python Backend (React + FastAPI)",
                frontend="React",
                backend="Python / FastAPI",
                database="PostgreSQL",
                cache="Redis",
                message_broker="Celery + Redis",
                auth_provider="Keycloak",
                hosting=hosting_model,
                ci_cd="GitLab CI",
                monitoring="Prometheus + Grafana",
                rationale="Python's ecosystem for data/ML integration",
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.LOW,
                community_maturity=Confidence.HIGH,
                confidence=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=str(uuid.uuid4()),
                label="Enterprise Java (React + Spring Boot)",
                frontend="React / Angular",
                backend="Java / Spring Boot",
                database="PostgreSQL / Oracle",
                cache="Redis / Hazelcast",
                message_broker="Kafka",
                auth_provider="Spring Security + OAuth2",
                hosting=hosting_model,
                ci_cd="Jenkins / GitHub Actions",
                monitoring="Dynatrace / New Relic",
                rationale="Enterprise-grade with strong typing and ecosystem",
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.HIGH,
                community_maturity=Confidence.HIGH,
                confidence=Confidence.MEDIUM,
            ),
        ]

        # Boost confidence if detected technologies match
        for opt in options:
            match_count = sum(
                1 for tech in detected
                if tech.lower() in str(opt.backend or "").lower()
                or tech.lower() in str(opt.frontend or "").lower()
            )
            if match_count > 0:
                opt.confidence = Confidence.HIGH
                opt.rationale += f" | Matches detected tech: {', '.join(detected[:3])}"

        return options

    @staticmethod
    def _build_tech_stack_profile(selected: TechStackOption) -> TechStackProfile:
        """Build a TechStackProfile from a selected option."""
        import uuid

        return TechStackProfile(
            profile_id=str(uuid.uuid4()),
            frontend=selected.frontend,
            backend=selected.backend,
            database=selected.database,
            cache=selected.cache,
            message_broker=selected.message_broker,
            auth_provider=selected.auth_provider,
            hosting=selected.hosting,
            ci_cd=selected.ci_cd,
            monitoring=selected.monitoring,
            source="USER_SELECTED",
            rationale=selected.rationale,
        )

    # ==================================================================
    # Internal: RBAC helpers
    # ==================================================================

    @staticmethod
    def _generate_rbac_model(
        session_id: str,
        actor_data: list[dict[str, Any]],
        capabilities_data: list[dict[str, Any]],
    ) -> RBACModel:
        """Generate an RBAC model from discovered actors and capabilities."""
        import uuid
        from domain.models import (
            Role, Permission, RolePermissionEntry, DataAccessEntry,
            PermissionAction, PermissionScope, DataSensitivity, AuditPolicy,
        )

        model_id = str(uuid.uuid4())

        # Default roles
        roles = [
            Role(role_id=str(uuid.uuid4()), name="admin", description="Full system access", is_system_role=True),
            Role(role_id=str(uuid.uuid4()), name="user", description="Standard user", is_system_role=True),
            Role(role_id=str(uuid.uuid4()), name="guest", description="Read-only guest", is_system_role=True),
        ]

        # Add actor-derived roles
        for actor in actor_data:
            role_name = actor.get("actor_type", "user")
            if not any(r.name == role_name for r in roles):
                roles.append(
                    Role(
                        role_id=str(uuid.uuid4()),
                        name=role_name,
                        description=f"Role for {role_name}",
                    )
                )

        # Basic permissions
        permissions = [
            Permission(permission_id=str(uuid.uuid4()), resource="*", action=PermissionAction.READ, scope=PermissionScope.ALL),
            Permission(permission_id=str(uuid.uuid4()), resource="*", action=PermissionAction.CREATE, scope=PermissionScope.OWN),
            Permission(permission_id=str(uuid.uuid4()), resource="*", action=PermissionAction.UPDATE, scope=PermissionScope.OWN),
            Permission(permission_id=str(uuid.uuid4()), resource="*", action=PermissionAction.DELETE, scope=PermissionScope.OWN),
        ]

        # Permission matrix: admin gets all
        permission_matrix: list[RolePermissionEntry] = []
        admin_role = roles[0] if roles else None
        if admin_role:
            for perm in permissions:
                permission_matrix.append(
                    RolePermissionEntry(
                        role_id=admin_role.role_id,
                        permission_id=perm.permission_id,
                        granted=True,
                        decision_maker="user",
                    )
                )

        # Data access matrix
        data_access_matrix: list[DataAccessEntry] = []
        if admin_role:
            data_access_matrix.append(
                DataAccessEntry(
                    role_id=admin_role.role_id,
                    data_entity="*",
                    read=True,
                    write=True,
                    delete_=True,
                    export=True,
                    scope=PermissionScope.ALL,
                    sensitivity=DataSensitivity.RESTRICTED,
                )
            )

        return RBACModel(
            model_id=model_id,
            project_id=session_id,
            roles=roles,
            permissions=permissions,
            permission_matrix=permission_matrix,
            data_access_matrix=data_access_matrix,
            audit_policy=AuditPolicy(),
        )
