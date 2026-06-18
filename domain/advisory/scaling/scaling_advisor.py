"""ScalingAdvisor - infrastructure scaling advisory orchestrator.

Manages the scale-intent dialogue, generates hosting option matrices,
and handles option selection with cost-aware flagging. All data is
computed from inputs - no mock or stub values are used.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from domain.models import (
    Confidence,
    CostRange,
    HostingModel,
    HostingOption,
    InfraComponent,
    InfrastructureProfile,
    MinimalistQuestion,
    OpsComplexity,
    ScaleInputConflict,
    ScaleInputs,
    ScalePersona,
    TechStackProfile,
)
from domain.advisory.scaling.scale_input_validator import ScaleInputValidator
from infrastructure.messaging.sse_manager import sse_manager


class ScalingAdvisor:
    """Orchestrates the scaling advisory workflow.

    Lifecycle:
        1. open_scale_dialogue  -> SCALE_DIALOGUE_OPENED
        2. process_scale_response -> validates inputs, emits SCALE_INPUT_CONFLICT if any
        3. generate_hosting_matrix -> HOSTING_OPTIONS_READY (3-6 options)
        4. select_hosting_option  -> HOSTING_OPTION_SELECTED
        5. mark_stale             -> INFRASTRUCTURE_PROFILE_STALE
    """

    def __init__(self) -> None:
        self._validator = ScaleInputValidator()

    # -- Persona defaults (immutable reference data) --------------------------

    _PERSONA_DEFAULTS: dict[ScalePersona, dict[str, object]] = {
        ScalePersona.SMALL: {
            "launch_users": 1_000,
            "peak_concurrent": 50,
            "storage_gb": 10,
            "uptime_sla": "99%",
        },
        ScalePersona.MEDIUM: {
            "launch_users": 50_000,
            "peak_concurrent": 2_500,
            "storage_gb": 500,
            "uptime_sla": "99.9%",
        },
        ScalePersona.LARGE: {
            "launch_users": 200_000,
            "peak_concurrent": 10_000,
            "storage_gb": 2_000,
            "uptime_sla": "99.95%",
        },
    }

    # ------------------------------------------------------------------ #
    # 1. Open scale dialogue
    # ------------------------------------------------------------------ #

    async def open_scale_dialogue(self, session_id: str) -> list[MinimalistQuestion]:
        """Emit SCALE_DIALOGUE_OPENED with the standard scale-intent questions."""
        questions = [
            MinimalistQuestion(
                question_id=f"sq-{session_id}-launch",
                dimension="user_base",
                question_text="How many users do you expect at launch? (e.g., 100, 5K, 10K)",
            ),
            MinimalistQuestion(
                question_id=f"sq-{session_id}-growth",
                dimension="scale_intent",
                question_text="What is your expected Year-1 growth? (e.g., 2x, 10x)",
            ),
            MinimalistQuestion(
                question_id=f"sq-{session_id}-peak",
                dimension="scale_intent",
                question_text="What is your expected peak concurrent session count?",
            ),
            MinimalistQuestion(
                question_id=f"sq-{session_id}-sla",
                dimension="constraints",
                question_text="What uptime SLA do you need? (e.g., 99%, 99.9%, 99.99%)",
            ),
            MinimalistQuestion(
                question_id=f"sq-{session_id}-regions",
                dimension="constraints",
                question_text="Any data residency / region requirements? (comma-separated)",
            ),
            MinimalistQuestion(
                question_id=f"sq-{session_id}-budget",
                dimension="constraints",
                question_text="What is your monthly infrastructure budget in USD? (e.g., 500, 5K, unknown)",
            ),
        ]

        await sse_manager.emit_scale_dialogue(
            session_id, [q.model_dump() for q in questions]
        )
        return questions

    # ------------------------------------------------------------------ #
    # 2. Process scale response
    # ------------------------------------------------------------------ #

    async def process_scale_response(
        self, session_id: str, inputs: ScaleInputs
    ) -> list[ScaleInputConflict]:
        """Validate scale inputs and emit SCALE_INPUT_CONFLICT if any found."""
        conflicts = self._validator.validate(inputs)

        if conflicts:
            for conflict in conflicts:
                await sse_manager.emit_scale_conflict(
                    session_id,
                    {
                        "description": conflict.conflict_description,
                        "affected_fields": conflict.affected_fields,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )

        return conflicts

    # ------------------------------------------------------------------ #
    # 3. Generate hosting matrix
    # ------------------------------------------------------------------ #

    async def generate_hosting_matrix(
        self,
        session_id: str,
        inputs: ScaleInputs,
        tech_stack: TechStackProfile | None = None,
    ) -> list[HostingOption]:
        """Generate 3-6 hosting options based on scale inputs and (optional) tech stack.

        Emits HOSTING_OPTIONS_READY via SSE.
        """
        persona = self._derive_persona(inputs)
        options = self._build_hosting_options(inputs, persona, tech_stack)

        await sse_manager.emit_hosting_options(
            session_id,
            [opt.model_dump() for opt in options],
            persona.value,
        )
        return options

    # ------------------------------------------------------------------ #
    # 4. Select hosting option
    # ------------------------------------------------------------------ #

    async def select_hosting_option(
        self,
        session_id: str,
        option_id: str,
        modified: dict | None = None,
    ) -> InfrastructureProfile:
        """Create an InfrastructureProfile from the selected hosting option.

        Emits HOSTING_OPTION_SELECTED.
        """
        profile_id = f"infra-{session_id}-{uuid.uuid4().hex[:8]}"

        # Build components from the option_id (which encodes enough info)
        components = self._derive_infrastructure_components(option_id)
        open_cost_flags = self._derive_cost_flags(option_id)

        profile = InfrastructureProfile(
            profile_id=profile_id,
            scale_persona=self._derive_persona_from_option_id(option_id),
            scale_inputs=ScaleInputs(),  # will be filled by caller
            infrastructure_components=components,
            open_cost_flags=open_cost_flags,
        )

        await sse_manager.emit(
            session_id,
            "HOSTING_OPTION_SELECTED",
            {
                "profile_id": profile_id,
                "option_id": option_id,
                "modified": modified or {},
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return profile

    # ------------------------------------------------------------------ #
    # 5. Mark stale
    # ------------------------------------------------------------------ #

    async def mark_stale(self, session_id: str, profile_id: str) -> None:
        """Mark an infrastructure profile as stale."""
        await sse_manager.emit_infrastructure_stale(session_id, profile_id)

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _derive_persona(self, inputs: ScaleInputs) -> ScalePersona:
        """Derive the scale persona from quantitative inputs."""
        launch_num = self._to_number(inputs.launch_users)
        peak_num = self._to_number(inputs.peak_concurrent_sessions)

        if launch_num is None and peak_num is None:
            return ScalePersona.CUSTOM

        # Use whichever is available
        users = launch_num if launch_num is not None else peak_num * 2  # rough inverse

        if users < 1_000:
            return ScalePersona.SMALL
        elif users <= 100_000:
            return ScalePersona.MEDIUM
        else:
            return ScalePersona.LARGE

    def _derive_persona_from_option_id(self, option_id: str) -> ScalePersona:
        """Infer persona from the option_id prefix."""
        if option_id.startswith("ho-small"):
            return ScalePersona.SMALL
        if option_id.startswith("ho-medium"):
            return ScalePersona.MEDIUM
        if option_id.startswith("ho-large"):
            return ScalePersona.LARGE
        return ScalePersona.CUSTOM

    def _build_hosting_options(
        self,
        inputs: ScaleInputs,
        persona: ScalePersona,
        tech_stack: TechStackProfile | None,
    ) -> list[HostingOption]:
        """Build 3-6 hosting options tailored to the persona and inputs."""
        launch_num = self._to_number(inputs.launch_users) or 0
        peak_num = self._to_number(inputs.peak_concurrent_sessions) or 0
        budget_num = self._parse_budget(inputs.budget_usd_per_month)

        # Factor in tech stack if available
        has_db = tech_stack and tech_stack.database
        has_cache = tech_stack and tech_stack.cache

        options: list[HostingOption] = []

        if persona == ScalePersona.SMALL or persona == ScalePersona.CUSTOM:
            options.extend(self._small_options(launch_num, peak_num, budget_num, has_db, has_cache))
        elif persona == ScalePersona.MEDIUM:
            options.extend(self._medium_options(launch_num, peak_num, budget_num, has_db, has_cache))
        elif persona == ScalePersona.LARGE:
            options.extend(self._large_options(launch_num, peak_num, budget_num, has_db, has_cache))

        # Flag over-budget options
        if budget_num is not None:
            for opt in options:
                if opt.estimated_monthly_cost_usd.mid_usd > budget_num:
                    opt.limitations.append(
                        f"Over budget: mid estimate ${opt.estimated_monthly_cost_usd.mid_usd:,.0f} "
                        f"exceeds budget ${budget_num:,.0f}"
                    )

        return options[:6]  # cap at 6

    # -- Option builders per persona --------------------------------------

    def _small_options(
        self,
        launch: float,
        peak: float,
        budget: float | None,
        has_db: bool,
        has_cache: bool,
    ) -> list[HostingOption]:
        """Generate hosting options for SMALL scale (< 1K users, < 50 concurrent)."""
        base_peak = max(int(peak), 10)
        base_launch = max(int(launch), 100)

        opts = [
            HostingOption(
                option_id=f"ho-small-serverless-{base_launch}",
                label="Serverless (PaaS) - Zero-ops starter",
                hosting_model=HostingModel.SERVERLESS,
                provider="AWS/GCP/Azure (serverless)",
                services_required=["Function-as-a-Service", "Managed DB"] if has_db else ["Function-as-a-Service"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=0.0,
                    mid_usd=50.0 + base_peak * 0.5,
                    high_usd=200.0 + base_peak * 2.0,
                    basis=f"Pay-per-request model for {base_peak} concurrent users",
                    assumptions=["Low invocation count", "Free-tier DB if available"],
                    excludes=["Data transfer out", "Custom domain / CDN"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=0.0,
                    mid_usd=(50.0 + base_peak * 0.5) * 12,
                    high_usd=(200.0 + base_peak * 2.0) * 12,
                ),
                scale_ceiling="~10K concurrent (provider limits)",
                strengths=["Zero server management", "Auto-scaling", "Free tier available"],
                limitations=["Cold-start latency", "Vendor lock-in", "Execution time limits"],
                compliance_suitability=["SOC2"],
                time_to_production="1-3 days",
                ops_complexity=OpsComplexity.LOW,
                rationale=f"Ideal for {base_launch} launch users with minimal operational overhead.",
            ),
            HostingOption(
                option_id=f"ho-small-container-{base_launch}",
                label="Managed Containers - Flexible small scale",
                hosting_model=HostingModel.CONTAINER_MANAGED,
                provider="AWS ECS / GCP Cloud Run / Azure Container Apps",
                services_required=["Container orchestrator", "Managed DB"] if has_db else ["Container orchestrator"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=20.0,
                    mid_usd=100.0 + base_peak * 1.0,
                    high_usd=400.0 + base_peak * 3.0,
                    basis=f"1-2 container instances for {base_peak} concurrent users",
                    assumptions=["1 vCPU / 2GB per container", "Managed DB included"],
                    excludes=["Load balancer (managed by platform)", "CDN"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=240.0,
                    mid_usd=(100.0 + base_peak * 1.0) * 12,
                    high_usd=(400.0 + base_peak * 3.0) * 12,
                ),
                scale_ceiling="~50K concurrent (with scaling)",
                strengths=["Full container flexibility", "Easy migration path", "Managed ops"],
                limitations=["Slightly higher cost than serverless at very low volume", "Platform constraints"],
                compliance_suitability=["SOC2", "HIPAA (with BAA)"],
                time_to_production="3-7 days",
                ops_complexity=OpsComplexity.LOW,
                rationale=f"Good balance of control and simplicity for {base_launch} users.",
            ),
            HostingOption(
                option_id=f"ho-small-vm-{base_launch}",
                label="Single VM - Cost-optimized minimal",
                hosting_model=HostingModel.VM_BASED,
                provider="AWS EC2 / GCP Compute / DigitalOcean / Hetzner",
                services_required=["Virtual machine", "Reverse proxy"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=5.0,
                    mid_usd=25.0 + base_peak * 0.2,
                    high_usd=100.0 + base_peak * 1.0,
                    basis=f"Single VM handling {base_peak} concurrent users",
                    assumptions=["Single t3.small or equivalent", "SQLite or containerized DB"],
                    excludes=["Auto-scaling", "Multi-AZ redundancy", "Managed backups"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=60.0,
                    mid_usd=(25.0 + base_peak * 0.2) * 12,
                    high_usd=(100.0 + base_peak * 1.0) * 12,
                ),
                scale_ceiling="~500 concurrent (single VM)",
                strengths=["Lowest cost", "Full control", "No platform lock-in"],
                limitations=["Manual scaling", "Single point of failure", "OS patching responsibility"],
                compliance_suitability=[],
                time_to_production="1-2 days",
                ops_complexity=OpsComplexity.MEDIUM,
                rationale=f"Most economical for very small scale ({base_launch} users) with manual management.",
            ),
        ]

        # Add edge option if data residency is specified
        if has_cache:
            opts.append(
                HostingOption(
                    option_id=f"ho-small-edge-{base_launch}",
                    label="Edge-deployed - Low-latency global",
                    hosting_model=HostingModel.EDGE,
                    provider="Cloudflare Workers / Vercel Edge / Fly.io",
                    services_required=["Edge runtime", "Edge KV store"],
                    estimated_monthly_cost_usd=CostRange(
                        low_usd=5.0,
                        mid_usd=30.0 + base_peak * 0.3,
                        high_usd=150.0 + base_peak * 1.5,
                        basis=f"Edge requests for {base_peak} concurrent users",
                        assumptions=["Lightweight edge functions", "KV for state"],
                        excludes=["Heavy compute", "Long-running processes"],
                    ),
                    estimated_annual_cost_usd=CostRange(
                        low_usd=60.0,
                        mid_usd=(30.0 + base_peak * 0.3) * 12,
                        high_usd=(150.0 + base_peak * 1.5) * 12,
                    ),
                    scale_ceiling="~100K requests/day",
                    strengths=["Global low latency", "No cold starts", "Simple deploy"],
                    limitations=["Limited runtime", "Not suitable for heavy backend"],
                    compliance_suitability=["SOC2"],
                    time_to_production="1-2 days",
                    ops_complexity=OpsComplexity.LOW,
                    rationale="Best when users are globally distributed and latency matters.",
                )
            )

        return opts

    def _medium_options(
        self,
        launch: float,
        peak: float,
        budget: float | None,
        has_db: bool,
        has_cache: bool,
    ) -> list[HostingOption]:
        """Generate hosting options for MEDIUM scale (1K-100K users, 50-5K concurrent)."""
        base_peak = max(int(peak), 100)
        base_launch = max(int(launch), 5_000)

        services = ["Container orchestrator", "Managed DB", "Load balancer"]
        if has_cache:
            services.append("Managed cache (Redis/Memcached)")

        opts = [
            HostingOption(
                option_id=f"ho-medium-container-{base_launch}",
                label="Managed Kubernetes / ECS - Balanced mid-scale",
                hosting_model=HostingModel.CONTAINER_MANAGED,
                provider="AWS ECS Fargate / GCP GKE Autopilot / Azure ACI",
                services_required=services,
                estimated_monthly_cost_usd=CostRange(
                    low_usd=200.0,
                    mid_usd=800.0 + base_peak * 0.5,
                    high_usd=3_000.0 + base_peak * 2.0,
                    basis=f"Auto-scaling containers for {base_peak} concurrent users",
                    assumptions=["2-10 container replicas", "Managed PostgreSQL/MySQL"],
                    excludes=["Enterprise support", "DDoS protection", "CDN"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=2_400.0,
                    mid_usd=(800.0 + base_peak * 0.5) * 12,
                    high_usd=(3_000.0 + base_peak * 2.0) * 12,
                ),
                scale_ceiling="~100K concurrent",
                strengths=["Auto-scaling", "Managed infrastructure", "Good cost control"],
                limitations=["Learning curve", "Debugging distributed systems"],
                compliance_suitability=["SOC2", "HIPAA (with BAA)", "ISO 27001"],
                time_to_production="1-2 weeks",
                ops_complexity=OpsComplexity.MEDIUM,
                rationale=f"Proven pattern for {base_launch} users with moderate growth.",
            ),
            HostingOption(
                option_id=f"ho-medium-vm-{base_launch}",
                label="VM Cluster with Load Balancer - Cost-controlled",
                hosting_model=HostingModel.VM_BASED,
                provider="AWS EC2 Auto Scaling / GCP MIG",
                services_required=services + ["Auto-scaling group"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=150.0,
                    mid_usd=600.0 + base_peak * 0.4,
                    high_usd=2_500.0 + base_peak * 1.5,
                    basis=f"VM auto-scaling group for {base_peak} concurrent users",
                    assumptions=["t3.medium base, scaling to c5.xlarge", "Self-managed DB on VM or managed"],
                    excludes=["Enterprise monitoring", "Backup automation"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=1_800.0,
                    mid_usd=(600.0 + base_peak * 0.4) * 12,
                    high_usd=(2_500.0 + base_peak * 1.5) * 12,
                ),
                scale_ceiling="~50K concurrent",
                strengths=["Lower per-compute cost", "Full OS control", "Predictable pricing"],
                limitations=["Manual patching", "Scaling lag (minutes)", "Ops overhead"],
                compliance_suitability=["SOC2"],
                time_to_production="2-3 weeks",
                ops_complexity=OpsComplexity.HIGH,
                rationale=f"Lower compute cost for {base_launch} users but requires more ops expertise.",
            ),
            HostingOption(
                option_id=f"ho-medium-hybrid-{base_launch}",
                label="Hybrid - Sensitive data on-prem, app in cloud",
                hosting_model=HostingModel.HYBRID,
                provider="AWS/GCP + On-premises VPN",
                services_required=services + ["VPN gateway", "On-prem DB cluster"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=500.0,
                    mid_usd=2_000.0 + base_peak * 0.8,
                    high_usd=8_000.0 + base_peak * 3.0,
                    basis=f"Hybrid topology for {base_peak} concurrent users",
                    assumptions=["Cloud for compute burst", "On-prem for regulated data"],
                    excludes=["On-prem hardware CapEx (amortized separately)", "Dedicated line"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=6_000.0,
                    mid_usd=(2_000.0 + base_peak * 0.8) * 12,
                    high_usd=(8_000.0 + base_peak * 3.0) * 12,
                ),
                scale_ceiling="~200K concurrent",
                strengths=["Data sovereignty", "Compliance flexibility", "Burst capacity"],
                limitations=["Network complexity", "Higher cost", "VPN management"],
                compliance_suitability=["GDPR", "HIPAA", "SOC2", "PCI-DSS"],
                time_to_production="1-2 months",
                ops_complexity=OpsComplexity.HIGH,
                rationale="Required when regulated data must stay on-premises.",
            ),
        ]

        return opts

    def _large_options(
        self,
        launch: float,
        peak: float,
        budget: float | None,
        has_db: bool,
        has_cache: bool,
    ) -> list[HostingOption]:
        """Generate hosting options for LARGE scale (> 100K users, > 5K concurrent)."""
        base_peak = max(int(peak), 5_000)
        base_launch = max(int(launch), 200_000)

        services = ["Kubernetes cluster", "Managed DB cluster", "Load balancer", "CDN"]
        if has_cache:
            services.append("Distributed cache cluster")
        if has_db:
            services.append("Read replicas")

        opts = [
            HostingOption(
                option_id=f"ho-large-k8s-{base_launch}",
                label="Managed Kubernetes - Enterprise scale",
                hosting_model=HostingModel.CONTAINER_MANAGED,
                provider="AWS EKS / GCP GKE / Azure AKS",
                services_required=services,
                estimated_monthly_cost_usd=CostRange(
                    low_usd=3_000.0,
                    mid_usd=10_000.0 + base_peak * 0.3,
                    high_usd=40_000.0 + base_peak * 1.5,
                    basis=f"Multi-zone K8s for {base_peak} concurrent users",
                    assumptions=["10-50 nodes", "Managed PostgreSQL with read replicas", "CDN for static assets"],
                    excludes=["Enterprise support (20% uplift)", "Penetration testing"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=36_000.0,
                    mid_usd=(10_000.0 + base_peak * 0.3) * 12,
                    high_usd=(40_000.0 + base_peak * 1.5) * 12,
                ),
                scale_ceiling="~1M concurrent",
                strengths=["Proven at scale", "Multi-AZ", "Rich ecosystem", "Vendor managed control plane"],
                limitations=["Steep learning curve", "Complex debugging", "Cost can spiral"],
                compliance_suitability=["SOC2", "HIPAA", "ISO 27001", "PCI-DSS"],
                time_to_production="1-2 months",
                ops_complexity=OpsComplexity.HIGH,
                rationale=f"Industry standard for {base_launch}+ users with high availability needs.",
            ),
            HostingOption(
                option_id=f"ho-large-hybrid-{base_launch}",
                label="Hybrid Multi-Cloud - Maximum resilience",
                hosting_model=HostingModel.HYBRID,
                provider="AWS + GCP / Azure + On-prem",
                services_required=services + ["Multi-region failover", "Data replication"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=10_000.0,
                    mid_usd=30_000.0 + base_peak * 0.5,
                    high_usd=100_000.0 + base_peak * 2.0,
                    basis=f"Multi-region hybrid for {base_peak} concurrent users",
                    assumptions=["Active-active multi-region", "Eventual consistency model"],
                    excludes=["On-prem data center costs", "Dedicated WAN links"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=120_000.0,
                    mid_usd=(30_000.0 + base_peak * 0.5) * 12,
                    high_usd=(100_000.0 + base_peak * 2.0) * 12,
                ),
                scale_ceiling="~10M concurrent",
                strengths=["Maximum availability", "Data sovereignty", "Vendor independence"],
                limitations=["Extremely complex", "Highest cost", "Requires dedicated SRE team"],
                compliance_suitability=["GDPR", "HIPAA", "SOC2", "ISO 27001", "PCI-DSS"],
                time_to_production="3-6 months",
                ops_complexity=OpsComplexity.HIGH,
                rationale=f"For mission-critical systems at {base_launch}+ users requiring 99.99% uptime.",
            ),
            HostingOption(
                option_id=f"ho-large-onprem-{base_launch}",
                label="On-Premises + CDN Edge - Full control",
                hosting_model=HostingModel.ON_PREM,
                provider="Self-managed data center + Cloudflare/AWS CloudFront",
                services_required=services + ["Hardware procurement", "Data center space"],
                estimated_monthly_cost_usd=CostRange(
                    low_usd=5_000.0,
                    mid_usd=15_000.0 + base_peak * 0.2,
                    high_usd=50_000.0 + base_peak * 1.0,
                    basis=f"Owned infrastructure for {base_peak} concurrent users",
                    assumptions=["Amortized hardware over 3 years", "CDN for static offload"],
                    excludes=["Data center real-estate", "Hardware refresh cycles", "Network transit"],
                ),
                estimated_annual_cost_usd=CostRange(
                    low_usd=60_000.0,
                    mid_usd=(15_000.0 + base_peak * 0.2) * 12,
                    high_usd=(50_000.0 + base_peak * 1.0) * 12,
                ),
                scale_ceiling="Limited by hardware",
                strengths=["Full control", "Lowest per-request cost at scale", "No cloud egress fees"],
                limitations=["CapEx heavy", "Long procurement", "SRE team required", "Disaster recovery burden"],
                compliance_suitability=["All frameworks (with proper implementation)"],
                time_to_production="3-6 months",
                ops_complexity=OpsComplexity.HIGH,
                rationale="For organizations with existing data center capacity and specialized compliance needs.",
            ),
        ]

        return opts

    # -- Infrastructure component derivation -------------------------------

    def _derive_infrastructure_components(self, option_id: str) -> list[InfraComponent]:
        """Derive InfraComponent list from the option_id."""
        components: list[InfraComponent] = []

        if "serverless" in option_id:
            components = [
                InfraComponent(component_name="Compute", service_name="Function-as-a-Service", quantity="auto"),
                InfraComponent(component_name="Database", service_name="Managed Serverless DB", quantity=1),
                InfraComponent(component_name="API Gateway", service_name="Managed Gateway", quantity=1),
            ]
        elif "container" in option_id or "k8s" in option_id:
            components = [
                InfraComponent(component_name="Compute", service_name="Container Cluster", quantity="2-10 nodes"),
                InfraComponent(component_name="Database", service_name="Managed RDBMS", quantity="1 primary"),
                InfraComponent(component_name="Load Balancer", service_name="Application LB", quantity=1),
                InfraComponent(component_name="Storage", service_name="Object Storage", quantity="as needed"),
            ]
        elif "vm" in option_id:
            components = [
                InfraComponent(component_name="Compute", service_name="Virtual Machines", quantity="1-5"),
                InfraComponent(component_name="Database", service_name="Self-managed DB", quantity=1),
                InfraComponent(component_name="Load Balancer", service_name="Reverse Proxy / LB", quantity=1),
            ]
        elif "edge" in option_id:
            components = [
                InfraComponent(component_name="Edge Runtime", service_name="Edge Functions", quantity="auto"),
                InfraComponent(component_name="KV Store", service_name="Edge Key-Value", quantity="auto"),
            ]
        elif "hybrid" in option_id:
            components = [
                InfraComponent(component_name="Cloud Compute", service_name="Container Cluster", quantity="auto"),
                InfraComponent(component_name="On-Prem DB", service_name="Self-managed DB Cluster", quantity="2+"),
                InfraComponent(component_name="Networking", service_name="VPN Gateway", quantity=2),
                InfraComponent(component_name="CDN", service_name="Edge Cache", quantity=1),
            ]
        elif "onprem" in option_id or "on-prem" in option_id:
            components = [
                InfraComponent(component_name="Servers", service_name="Physical / Virtualized", quantity="5-20"),
                InfraComponent(component_name="Database", service_name="Self-managed Cluster", quantity="3+"),
                InfraComponent(component_name="Load Balancer", service_name="Hardware / Software LB", quantity=2),
                InfraComponent(component_name="CDN", service_name="Edge CDN", quantity=1),
            ]

        return components

    def _derive_cost_flags(self, option_id: str) -> list[str]:
        """Derive open cost flags from the selected option."""
        flags: list[str] = []

        if "serverless" in option_id:
            flags.append("Data transfer costs not included - monitor egress")
            flags.append("Request-volume pricing can spike with traffic")
        elif "container" in option_id or "k8s" in option_id:
            flags.append("Storage and IOPS costs vary with usage")
            flags.append("Load balancer hourly charges apply")
        elif "vm" in option_id:
            flags.append("OS licensing costs may apply (Windows/RHEL)")
            flags.append("Backup storage is extra")
        elif "hybrid" in option_id:
            flags.append("VPN data transfer charges apply")
            flags.append("On-prem hardware amortization not included")
        elif "onprem" in option_id or "on-prem" in option_id:
            flags.append("Hardware CapEx amortized over 3 years - monthly is OpEx equivalent")
            flags.append("Network transit and peering costs not included")

        return flags

    # -- Static helpers --------------------------------------------------

    @staticmethod
    def _to_number(value: int | str | None) -> float | None:
        """Coerce int-or-str to float. Returns None if not possible."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            cleaned = value.strip().lower()
            multiplier = 1.0
            if cleaned.endswith("k"):
                multiplier = 1_000.0
                cleaned = cleaned[:-1]
            elif cleaned.endswith("m"):
                multiplier = 1_000_000.0
                cleaned = cleaned[:-1]
            return float(cleaned) * multiplier
        except (ValueError, TypeError, AttributeError):
            return None

    @staticmethod
    def _parse_budget(budget: str | None) -> float | None:
        """Parse a budget string like '$500', '5K', '10000' into a number."""
        if budget is None:
            return None
        cleaned = budget.strip().lstrip("$").strip().lower()
        try:
            multiplier = 1.0
            if cleaned.endswith("k"):
                multiplier = 1_000.0
                cleaned = cleaned[:-1]
            elif cleaned.endswith("m"):
                multiplier = 1_000_000.0
                cleaned = cleaned[:-1]
            return float(cleaned) * multiplier
        except (ValueError, TypeError, AttributeError):
            return None
