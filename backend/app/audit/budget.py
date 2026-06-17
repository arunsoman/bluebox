"""AuditBudgetManager — manages audit storage budget."""


class AuditBudgetManager:
    """Manages the audit trail storage budget."""

    def __init__(self, max_mb: int = 100) -> None:
        self.max_mb = max_mb
