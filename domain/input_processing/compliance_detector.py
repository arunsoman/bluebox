"""ComplianceDetector — scans text for compliance framework signals.

Pre-populates AuditPolicy defaults for each detected framework:
- GDPR: retention_days=2555, audit_all_writes=true
- HIPAA: audit_all_writes=true, audit_reads_for_sensitivity=["confidential","restricted"]
- PCI-DSS: alert_on_bulk_export=true, audit_log_immutable=true
- SOC2: audit_all_writes=true, retention_days=2555
- CCPA: retention_days=2555, alert_on_privilege_escalation=true
"""
from __future__ import annotations

import re

from domain.models import AuditPolicy


# Mapping of framework keywords → framework name
COMPLIANCE_KEYWORDS: dict[str, list[str]] = {
    "GDPR": [
        "gdpr", "general data protection", "data subject", "right to erasure",
        "right to access", "data portability", "dpo", "data protection officer",
        "article 17", "article 32", "legitimate interest", "consent management",
        "privacy by design", "data minimization", "european union", "eu regulation",
        "personal data", "sensitive personal data", "lawful basis", "processor agreement",
    ],
    "HIPAA": [
        "hipaa", "health insurance portability", "phi", "protected health information",
        "covered entity", "business associate", "breach notification", "minimum necessary",
        "access control", "audit control", "integrity control", "transmission security",
        "hipaa privacy rule", "hipaa security rule", "omnibus rule", "hitech",
        "healthcare data", "medical records", "clinical data", "patient data",
    ],
    "PCI-DSS": [
        "pci", "pci-dss", "payment card industry", "cardholder data", "cde",
        "cardholder data environment", "encryption at rest", "encryption in transit",
        "tokenization", "cvv", "pan", "primary account number", "payment processing",
        "secure payment", "credit card", "debit card", "asv scan", "saq",
        "vulnerability management", "access control measure", "network security",
    ],
    "SOC2": [
        "soc2", "soc 2", "system and organization controls", "trust service criteria",
        "security principle", "availability principle", "processing integrity",
        "confidentiality principle", "privacy principle", "type i report", "type ii report",
        "audit period", "control environment", "risk assessment", "monitoring activity",
        "service organization", "user entity", "complementary user entity controls",
        "cce", "control deficiency", "service auditor",
    ],
    "CCPA": [
        "ccpa", "california consumer privacy act", "consumer rights", "right to know",
        "right to delete", "right to opt-out", "right to non-discrimination",
        "sell personal information", "disclose personal information", "verifiable request",
        "authorized agent", "cpra", "california privacy rights act", "opt-in",
        "minor data", "financial incentive", "privacy policy disclosure",
    ],
}

# Framework-specific AuditPolicy defaults
FRAMEWORK_DEFAULTS: dict[str, dict[str, object]] = {
    "GDPR": {
        "retention_days": 2555,
        "audit_all_writes": True,
    },
    "HIPAA": {
        "audit_all_writes": True,
        "audit_reads_for_sensitivity": ["confidential", "restricted"],
    },
    "PCI-DSS": {
        "alert_on_bulk_export": True,
        "audit_log_immutable": True,
    },
    "SOC2": {
        "audit_all_writes": True,
        "retention_days": 2555,
    },
    "CCPA": {
        "retention_days": 2555,
        "alert_on_privilege_escalation": True,
    },
}


class ComplianceDetector:
    """Scans text for compliance framework signals and returns detected frameworks
    with their default AuditPolicy settings.
    """

    def __init__(self) -> None:
        self._keywords = COMPLIANCE_KEYWORDS
        self._framework_defaults = FRAMEWORK_DEFAULTS

    def detect(self, text: str) -> list[str]:
        """Scan *text* for compliance framework signals.

        Returns a list of detected framework names (e.g., ["GDPR", "SOC2"]).
        Uses keyword heuristics — case-insensitive matching.
        """
        if not text or not text.strip():
            return []

        detected: list[str] = []
        lower_text = text.lower()

        for framework, keywords in self._keywords.items():
            for kw in keywords:
                # Use word-boundary-aware matching for short keywords,
                # substring for longer phrases
                if len(kw) <= 6:
                    pattern = r"\b" + re.escape(kw.lower()) + r"\b"
                    if re.search(pattern, lower_text):
                        detected.append(framework)
                        break
                else:
                    if kw.lower() in lower_text:
                        detected.append(framework)
                        break

        # De-duplicate while preserving order
        seen: set[str] = set()
        unique_detected: list[str] = []
        for fw in detected:
            if fw not in seen:
                seen.add(fw)
                unique_detected.append(fw)

        return unique_detected

    def get_defaults(self, frameworks: list[str]) -> AuditPolicy:
        """Build an *AuditPolicy* by merging defaults for each detected framework.

        Later frameworks in the list can override earlier ones for shared fields.
        """
        policy = AuditPolicy()

        for fw in frameworks:
            defaults = self._framework_defaults.get(fw, {})
            for key, value in defaults.items():
                setattr(policy, key, value)

        return policy
