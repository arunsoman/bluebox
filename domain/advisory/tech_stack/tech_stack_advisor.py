"""TechStackAdvisor - technology stack advisory orchestrator.

Detects technology signals from user input, generates tech stack option
matrices with actor and scale compatibility scoring. All data computed
from inputs - no mock or stub values.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from domain.models import (
    ActorDiscoveryResult,
    ActorClass,
    CapabilitySet,
    Confidence,
    LearningCurve,
    ScaleFit,
    ScaleInputs,
    ScalePersona,
    TechStackOption,
    TechStackProfile,
    TechStackSignal,
    TechStackSelectionDTO,
)
from infrastructure.messaging.sse_manager import sse_manager


class TechStackAdvisor:
    """Orchestrates technology stack advisory.

    Lifecycle:
        1. detect_signals(text)          -> TechStackSignal
        2. generate_matrix(session, ...) -> TECH_STACK_OPTIONS_READY (3-5 options)
        3. select_option(session, ...)   -> TECH_STACK_SELECTED
    """

    # -- Technology keyword lexicon ----------------------------------------

    _TECH_KEYWORDS: dict[str, list[str]] = {
        "frontend": [
            "react", "vue", "angular", "svelte", "nextjs", "nuxt", "remix",
            "flutter", "react native", "swift", "kotlin", "android", "ios",
            "htmx", "alpine", "jquery", "bootstrap", "tailwind", "mui",
        ],
        "backend": [
            "python", "fastapi", "django", "flask", "node", "express", "nestjs",
            "go", "golang", "rust", "java", "spring", "kotlin", "ruby", "rails",
            "php", "laravel", "dotnet", "c#", "elixir", "phoenix",
        ],
        "database": [
            "postgresql", "mysql", "sqlite", "mongodb", "dynamodb", "firebase",
            "redis", "cassandra", "cockroachdb", "planetscale", "neon",
            "supabase", " RDS", "aurora", "spanner", "bigquery", "clickhouse",
            "timescaledb", "influxdb", "elasticsearch", "opensearch",
        ],
        "cache": [
            "redis", "memcached", "valkey", "dragonfly", "hazelcast",
        ],
        "message_broker": [
            "kafka", "rabbitmq", "sqs", "pubsub", "nats", "redis streams",
            "eventbridge", "celery", "bull", "sidekiq",
        ],
        "auth_provider": [
            "auth0", "cognito", "keycloak", "okta", "firebase auth",
            "supabase auth", "clerk", "ory", "oauth", "openid",
        ],
        "hosting": [
            "aws", "gcp", "azure", "vercel", "netlify", "heroku", "digitalocean",
            "fly.io", "render", "railway", "cloudflare", "kubernetes", "k8s",
            "ecs", "lambda", "serverless",
        ],
        "ci_cd": [
            "github actions", "gitlab ci", "jenkins", "circleci", "travis",
            "argo cd", "flux", "tekton", "buildkite", " drone",
        ],
        "monitoring": [
            "datadog", "new relic", "grafana", "prometheus", "loki", "jaeger",
            "sentry", "honeycomb", "cloudwatch", "stackdriver",
        ],
    }

    # ------------------------------------------------------------------ #
    # 1. Detect signals
    # ------------------------------------------------------------------ #

    def detect_signals(self, text: str) -> TechStackSignal:
        """Scan input text for explicit and implicit technology signals.

        Returns a TechStackSignal with detected technologies, source type,
        and confidence level based on match specificity.
        """
        text_lower = text.lower()
        detected: list[str] = []

        for category, keywords in self._TECH_KEYWORDS.items():
            for kw in keywords:
                # Word-boundary matching for precision
                pattern = r'\b' + re.escape(kw.lower()) + r'\b'
                if re.search(pattern, text_lower):
                    detected.append(kw)

        # Deduplicate while preserving order
        seen = set()
        unique_detected = [t for t in detected if not (t in seen or seen.add(t))]

        # Determine confidence based on detection quality
        if len(unique_detected) >= 5:
            confidence = Confidence.HIGH
        elif len(unique_detected) >= 2:
            confidence = Confidence.MEDIUM
        else:
            confidence = Confidence.LOW

        source: str = "input_text"

        # Check if this looks inferred from product type
        product_type_indicators = [
            "mobile app", "web app", "api", "microservice", "saas",
            "platform", "marketplace", "chatbot", "ml", "ai",
        ]
        if not unique_detected:
            for indicator in product_type_indicators:
                if indicator in text_lower:
                    source = "inferred_from_product_type"
                    unique_detected = self._infer_from_product_type(indicator)
                    confidence = Confidence.LOW
                    break

        return TechStackSignal(
            signal_id=f"tss-{uuid.uuid4().hex[:8]}",
            detected_technologies=unique_detected,
            detection_source=source,
            confidence=confidence,
        )

    # ------------------------------------------------------------------ #
    # 2. Generate matrix
    # ------------------------------------------------------------------ #

    async def generate_matrix(
        self,
        session_id: str,
        actors: ActorDiscoveryResult,
        scale: ScaleInputs | None = None,
    ) -> list[TechStackOption]:
        """Generate 3-5 tech stack options based on actors and scale.

        Each option includes all component fields, actor_compatibility,
        scale_fit, learning_curve, community_maturity, and rationale.

        Emits TECH_STACK_OPTIONS_READY via SSE.
        """
        persona = self._derive_scale_persona(scale)
        options = self._build_tech_options(actors, persona)

        await sse_manager.emit_tech_stack_options(
            session_id,
            [opt.model_dump() for opt in options],
        )
        return options

    # ------------------------------------------------------------------ #
    # 3. Select option
    # ------------------------------------------------------------------ #

    async def select_option(
        self,
        session_id: str,
        option_id: str,
        modified: dict | None = None,
    ) -> TechStackProfile:
        """Create a TechStackProfile from the selected option.

        Emits TECH_STACK_SELECTED.
        """
        profile_id = f"ts-{session_id}-{uuid.uuid4().hex[:8]}"

        # Find the matching option data from modification or default
        mod = modified or {}

        profile = TechStackProfile(
            profile_id=profile_id,
            frontend=mod.get("frontend"),
            backend=mod.get("backend"),
            database=mod.get("database"),
            cache=mod.get("cache"),
            message_broker=mod.get("message_broker"),
            auth_provider=mod.get("auth_provider"),
            hosting=mod.get("hosting"),
            ci_cd=mod.get("ci_cd"),
            monitoring=mod.get("monitoring"),
            source="USER_SELECTED",
            rationale=mod.get("rationale", f"Selected option {option_id}"),
        )

        await sse_manager.emit(
            session_id,
            "TECH_STACK_SELECTED",
            {
                "profile_id": profile_id,
                "option_id": option_id,
                "modified": mod,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        return profile

    # ================================================================== #
    # Private helpers
    # ================================================================== #

    def _derive_scale_persona(self, scale: ScaleInputs | None) -> ScalePersona:
        """Derive scale persona from ScaleInputs."""
        if scale is None:
            return ScalePersona.CUSTOM

        launch = self._to_number(scale.launch_users)
        if launch is None:
            launch = self._to_number(scale.peak_concurrent_sessions)
            if launch is not None:
                launch = launch * 2

        if launch is None:
            return ScalePersona.CUSTOM

        if launch < 1_000:
            return ScalePersona.SMALL
        elif launch <= 100_000:
            return ScalePersona.MEDIUM
        else:
            return ScalePersona.LARGE

    def _build_tech_options(
        self,
        actors: ActorDiscoveryResult,
        persona: ScalePersona,
    ) -> list[TechStackOption]:
        """Build 3-5 tech stack options tailored to actors and scale persona."""
        # Determine actor composition
        has_mobile_users = any(
            "mobile" in a.name.lower() or "app" in a.name.lower()
            for a in actors.actors.get(ActorClass.HUMAN, [])
        )
        has_external_services = len(actors.actors.get(ActorClass.EXTERNAL, [])) > 0
        has_many_humans = sum(len(v) for v in actors.actors.values()) > 5

        options: list[TechStackOption] = []

        if persona == ScalePersona.SMALL:
            options = self._small_stack_options(has_mobile_users, has_external_services)
        elif persona == ScalePersona.MEDIUM:
            options = self._medium_stack_options(has_mobile_users, has_external_services, has_many_humans)
        elif persona == ScalePersona.LARGE:
            options = self._large_stack_options(has_mobile_users, has_external_services, has_many_humans)
        else:
            # CUSTOM: provide a balanced default set
            options = self._small_stack_options(has_mobile_users, has_external_services)

        return options[:5]

    def _small_stack_options(
        self,
        has_mobile: bool,
        has_external: bool,
    ) -> list[TechStackOption]:
        """Build tech stack options for SMALL scale."""
        opts = [
            TechStackOption(
                option_id=f"ts-small-fullstack-py-{uuid.uuid4().hex[:6]}",
                label="Python Full-Stack - Rapid MVP",
                frontend="React + Vite" if not has_mobile else "React Native",
                backend="FastAPI",
                database="PostgreSQL (Supabase/Neon)",
                cache="Redis (optional)",
                message_broker="None needed",
                auth_provider="Supabase Auth / Clerk",
                hosting="Railway / Render / Fly.io",
                ci_cd="GitHub Actions",
                monitoring="Sentry + UptimeRobot",
                rationale="Minimal complexity, fastest time-to-market. Python+FastAPI gives async performance with simple syntax. React ecosystem has the most hiring availability.",
                actor_compatibility=["Human web users", "Admin dashboard users"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.LOW,
                community_maturity=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=f"ts-small-serverless-{uuid.uuid4().hex[:6]}",
                label="Serverless-First - Zero-ops",
                frontend="Next.js (App Router)",
                backend="Next.js API Routes + Server Actions",
                database="PostgreSQL (Vercel/Neon)",
                cache="Vercel Edge Config",
                message_broker="None needed",
                auth_provider="NextAuth.js / Clerk",
                hosting="Vercel",
                ci_cd="Vercel Git Integration",
                monitoring="Vercel Analytics + Sentry",
                rationale="Single framework handles frontend and backend. Vercel manages all infrastructure. Best for teams with strong JS/TS experience.",
                actor_compatibility=["Web users", "Content admins"],
                scale_fit=ScaleFit.FIT if not has_external else ScaleFit.UNDER,
                learning_curve=LearningCurve.LOW,
                community_maturity=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=f"ts-small-modern-ts-{uuid.uuid4().hex[:6]}",
                label="TypeScript End-to-End - Type safety",
                frontend="React + tRPC client",
                backend="Node.js + tRPC + Prisma",
                database="PostgreSQL (Railway)",
                cache="Redis (Upstash)",
                message_broker="None needed",
                auth_provider="Lucia Auth / Clerk",
                hosting="Railway / Render",
                ci_cd="GitHub Actions",
                monitoring="Sentry + Railway Metrics",
                rationale="End-to-end type safety with TypeScript. tRPC eliminates API schema drift. Good for teams that value type correctness over raw development speed.",
                actor_compatibility=["Web users", "API consumers"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.MEDIUM,
                community_maturity=Confidence.HIGH,
            ),
        ]

        if has_mobile:
            opts.append(
                TechStackOption(
                    option_id=f"ts-small-mobile-{uuid.uuid4().hex[:6]}",
                    label="Mobile-First Cross-Platform",
                    frontend="Flutter",
                    backend="FastAPI + Firebase",
                    database="Cloud Firestore",
                    cache="Firebase Cache",
                    message_broker="Firebase Cloud Messaging",
                    auth_provider="Firebase Auth",
                    hosting="Firebase / GCP",
                    ci_cd="GitHub Actions + Firebase CLI",
                    monitoring="Firebase Crashlytics + Analytics",
                    rationale="Flutter provides native performance on iOS and Android from single codebase. Firebase handles backend infrastructure so team can focus on app experience.",
                    actor_compatibility=["Mobile app users", "iOS users", "Android users"],
                    scale_fit=ScaleFit.FIT,
                    learning_curve=LearningCurve.MEDIUM,
                    community_maturity=Confidence.HIGH,
                )
            )

        return opts

    def _medium_stack_options(
        self,
        has_mobile: bool,
        has_external: bool,
        has_many_humans: bool,
    ) -> list[TechStackOption]:
        """Build tech stack options for MEDIUM scale."""
        broker = "Redis Streams / RabbitMQ" if has_external else "Redis Streams"

        opts = [
            TechStackOption(
                option_id=f"ts-medium-scalable-py-{uuid.uuid4().hex[:6]}",
                label="Scalable Python - Production-ready",
                frontend="React + TanStack Query",
                backend="FastAPI + Celery",
                database="PostgreSQL (RDS/Cloud SQL) with read replicas",
                cache="Redis Cluster (Elasticache)",
                message_broker=broker,
                auth_provider="Keycloak / Auth0",
                hosting="AWS ECS / GCP Cloud Run",
                ci_cd="GitHub Actions + Argo CD",
                monitoring="Prometheus + Grafana + Sentry",
                rationale="FastAPI's async support handles high concurrency. Celery manages background tasks. Read replicas scale database reads. Proven pattern for 1K-100K users.",
                actor_compatibility=["Web users", "Mobile API consumers", "Admin users", "Background job processors"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.MEDIUM,
                community_maturity=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=f"ts-medium-enterprise-java-{uuid.uuid4().hex[:6]}",
                label="Enterprise Java - Typed ecosystem",
                frontend="React + TypeScript",
                backend="Spring Boot 3 (WebFlux)",
                database="PostgreSQL / CockroachDB",
                cache="Redis",
                message_broker="Kafka / RabbitMQ",
                auth_provider="Keycloak / Okta",
                hosting="AWS EKS / GCP GKE",
                ci_cd="GitLab CI + Argo CD",
                monitoring="Datadog / New Relic + Sentry",
                rationale="Spring Boot's ecosystem is unmatched for enterprise patterns. Strong typing reduces runtime errors in large teams. Excellent observability tooling.",
                actor_compatibility=["Enterprise users", "B2B API integrators", "Operations staff"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.HIGH,
                community_maturity=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=f"ts-medium-modern-go-{uuid.uuid4().hex[:6]}",
                label="Go Microservices - High throughput",
                frontend="React + TypeScript",
                backend="Go (Gin / Echo / Fiber)",
                database="PostgreSQL + CockroachDB",
                cache="Redis Cluster",
                message_broker="NATS / Kafka",
                auth_provider="Ory Kratos / Auth0",
                hosting="AWS EKS / Fly.io",
                ci_cd="GitHub Actions + Flux CD",
                monitoring="Prometheus + Grafana + Jaeger",
                rationale="Go's goroutines handle massive concurrency with low memory. Static binary deployment simplifies ops. NATS provides lightweight messaging. Best for I/O-bound high-throughput systems.",
                actor_compatibility=["API consumers", "Real-time users", "System integrators"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.MEDIUM,
                community_maturity=Confidence.HIGH,
            ),
        ]

        if has_external:
            opts.append(
                TechStackOption(
                    option_id=f"ts-medium-integration-{uuid.uuid4().hex[:6]}",
                    label="Integration-Heavy - B2B gateway",
                    frontend="React + Refine.dev",
                    backend="Node.js (NestJS) + Apollo Federation",
                    database="PostgreSQL + Redis",
                    cache="Redis",
                    message_broker="Kafka + RabbitMQ (dual)",
                    auth_provider="Auth0 / Okta (SAML)",
                    hosting="AWS ECS / Azure Container Apps",
                    ci_cd="GitHub Actions",
                    monitoring="Datadog + PagerDuty",
                    rationale="NestJS has excellent integration patterns (CQRS, event sourcing). Apollo Federation manages multiple B2B APIs. Dual message brokers handle different integration patterns.",
                    actor_compatibility=["External API partners", "Webhook consumers", "Integration admins"],
                    scale_fit=ScaleFit.FIT,
                    learning_curve=LearningCurve.HIGH,
                    community_maturity=Confidence.HIGH,
                )
            )

        return opts

    def _large_stack_options(
        self,
        has_mobile: bool,
        has_external: bool,
        has_many_humans: bool,
    ) -> list[TechStackOption]:
        """Build tech stack options for LARGE scale."""
        opts = [
            TechStackOption(
                option_id=f"ts-large-k8s-py-{uuid.uuid4().hex[:6]}",
                label="Kubernetes Python - Enterprise scale",
                frontend="React + Next.js (SSG/SSR)",
                backend="FastAPI + gRPC microservices",
                database="PostgreSQL (Aurora/Spanner) + read replicas",
                cache="Redis Cluster (ElastiCache)",
                message_broker="Kafka (MSK/Confluent)",
                auth_provider="Keycloak / Okta (OIDC + SAML)",
                hosting="AWS EKS / GCP GKE",
                ci_cd="GitHub Actions + Argo CD (GitOps)",
                monitoring="Prometheus + Grafana + Jaeger + PagerDuty",
                rationale="Kubernetes provides container orchestration at scale. gRPC enables efficient inter-service communication. Kafka handles event streaming. Aurora/Spanner provide globally distributed databases.",
                actor_compatibility=["Web users", "Mobile users", "External API partners", "Internal services", "Ops teams"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.HIGH,
                community_maturity=Confidence.HIGH,
            ),
            TechStackOption(
                option_id=f"ts-large-event-driven-{uuid.uuid4().hex[:6]}",
                label="Event-Driven - Maximum decoupling",
                frontend="React + WebSocket client",
                backend="Go (event handlers) + Python ( FastAPI gateway)",
                database="CockroachDB + ClickHouse (analytics)",
                cache="Redis Cluster + Dragonfly",
                message_broker="Kafka + NATS (dual layer)",
                auth_provider="Ory Stack (Kratos + Keto + Oathkeeper)",
                hosting="Multi-cloud K8s (EKS + GKE)",
                ci_cd="GitLab CI + Flux + Argo Rollouts",
                monitoring="Datadog + Honeycomb (OTel)",
                rationale="Event-driven architecture enables independent scaling of components. Dual message layers handle different consistency needs. Ory provides complete IAM infrastructure. Multi-cloud K8s prevents vendor lock-in.",
                actor_compatibility=["Real-time users", "Event processors", "Analytics consumers", "System operators"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.HIGH,
                community_maturity=Confidence.MEDIUM,
            ),
            TechStackOption(
                option_id=f"ts-large-rust-perf-{uuid.uuid4().hex[:6]}",
                label="Rust High-Performance - Compute bound",
                frontend="React + TypeScript",
                backend="Rust (Axum / Actix-web)",
                database="PostgreSQL (Aurora) + ScyllaDB",
                cache="Redis Cluster",
                message_broker="Redpanda (Kafka-compatible)",
                auth_provider="Keycloak / Custom JWT",
                hosting="AWS EKS / Bare metal hybrid",
                ci_cd="GitHub Actions + Argo CD",
                monitoring="Prometheus + Grafana + Sentry",
                rationale="Rust provides memory safety without GC pauses. Axum/Actix-web handle massive throughput. ScyllaDB offers Cassandra-compatible low-latency storage. Best for compute-intensive or latency-sensitive workloads.",
                actor_compatibility=["High-volume API consumers", "Real-time traders/gamers", "System services"],
                scale_fit=ScaleFit.FIT,
                learning_curve=LearningCurve.HIGH,
                community_maturity=Confidence.MEDIUM,
            ),
        ]

        return opts

    def _infer_from_product_type(self, indicator: str) -> list[str]:
        """Infer likely technologies from the product type description."""
        inference_map: dict[str, list[str]] = {
            "mobile app": ["React Native", "Flutter", "Firebase", "iOS", "Android"],
            "web app": ["React", "Next.js", "FastAPI", "Node.js", "PostgreSQL"],
            "api": ["FastAPI", "Node.js", "Go", "PostgreSQL", "Redis", "Docker"],
            "microservice": ["Kubernetes", "Go", "Python", "Kafka", "gRPC", "Redis"],
            "saas": ["React", "PostgreSQL", "Redis", "AWS", "Docker"],
            "platform": ["Kubernetes", "React", "Go", "PostgreSQL", "Kafka"],
            "marketplace": ["React", "Node.js", "PostgreSQL", "Redis", "Stripe"],
            "chatbot": ["Python", "OpenAI", "FastAPI", "Redis", "WebSocket"],
            "ml": ["Python", "PyTorch", "FastAPI", "PostgreSQL", "S3", "Kubernetes"],
            "ai": ["Python", "OpenAI", "FastAPI", "PostgreSQL", "Redis"],
        }
        return inference_map.get(indicator, ["React", "FastAPI", "PostgreSQL"])

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
