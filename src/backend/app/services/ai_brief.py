"""
GridGuardian AI — Phase 6: AI Operations Brief Service
========================================================

*** SYNTHETIC DEMONSTRATION DATA — NOT REAL UTILITY DATA ***

The LLM NEVER calculates a number. It receives ONLY structured facts that the
Phase 2/3/4 code (or its precomputed outputs) already produced — failure risk,
grid impact, priority, simulation severity, customer/facility counts — and
turns them into an operator-friendly brief.

Hard rules injected into every request:
* never invent or change numerical values
* never claim synthetic data is real utility data
* never claim the simulation is electrical power-flow physics
* distinguish "prediction" (model-estimated) from "simulation" (consequence)
* distinguish "recommendation" from "certainty"

If no API key is configured the service raises AIBriefUnavailableError and the
API returns HTTP 503 so the rest of the application keeps working.
"""

import json
import os

from app.services import registry
from app.services.simulation import simulate_asset_failure

KEY_ENV = "ANTHROPIC_API_KEY"
MODEL_ENV = "ANTHROPIC_MODEL"
DEFAULT_MODEL = "claude-3-5-haiku-latest"

SYSTEM_PROMPT = (
    "You are the GridGuardian AI operations-brief writer for an electric-grid "
    "operator. You never calculate, estimate, or invent numbers: every figure "
    "in your brief MUST come verbatim from the structured facts provided by the "
    "backend. Rules: (1) never invent or change numerical values; (2) never "
    "claim synthetic demonstration data is real utility data; (3) never claim "
    "the failure simulation is electrical power-flow physics; (4) always label "
    "failure risk as 'model-estimated' and consequence as 'simulated'; "
    "(5) frame every action as 'recommended', never certain; (6) be concise, "
    "structured, and plain-English for a control-room operator. "
    "Output exactly these markdown sections: "
    "## Situation, ## Highest concern, ## Why it matters, "
    "## Recommended actions (bulleted, labeled Immediate action / Monitor / "
    "Prepare), ## What to monitor."
)


class AIBriefUnavailableError(RuntimeError):
    """Raised when the LLM cannot be called (no API key or provider failure)."""


def has_key():
    return bool(os.getenv(KEY_ENV, "").strip())


def build_facts(asset_ids):
    """Fetch REAL risk/impact/priority/simulation data for each asset."""
    facts = []
    for aid in asset_ids:
        asset = registry.get_asset(aid)
        if asset is None:
            continue
        sim = simulate_asset_failure(aid)
        facts.append({
            "asset_id": aid,
            "asset_type": asset.get("asset_type"),
            "criticality": asset.get("criticality"),
            "failure_risk_percent": asset.get("failure_risk_percent"),
            "risk_category": asset.get("risk_category"),
            "grid_impact": asset.get("grid_impact"),
            "priority_score": asset.get("priority_score"),
            "priority_category": asset.get("priority_category"),
            "priority_reason": asset.get("priority_reason"),
            "simulation_severity": sim["severity"],
            "simulation_severity_score": sim["severity_score"],
            "estimated_customers_affected": sim["estimated_customers_affected"],
            "critical_facilities_affected": sim["critical_facilities_affected"],
            "affected_zones": sim["affected_zones"],
            "stressed_assets": [s["asset_id"] for s in sim["stressed_assets"]],
            "cascade_depth": sim["cascade_depth"],
            "simulation_headline": sim["explanation"]["headline"],
            "recommended_follow_up": sim["explanation"]["recommended_follow_up"],
        })
    return facts


def _user_prompt(facts):
    return (
        "Write the GridGuardian AI Operations Brief for the assets below. "
        "Use ONLY the provided numbers. Structure per your instructions.\n\n"
        "Structured facts (from the GridGuardian backend):\n"
        + json.dumps(facts, indent=2)
    )


def _call_llm(system_prompt, user_prompt):
    """Single callable seam — overridden in tests; real path via Anthropic."""
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ[KEY_ENV])
    message = client.messages.create(
        model=os.getenv(MODEL_ENV, DEFAULT_MODEL),
        max_tokens=1200,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return "".join(
        block.text for block in getattr(message, "content", [])
        if getattr(block, "type", "") == "text"
    ).strip()


def generate_ai_brief(asset_ids, completer=None):
    """Build a structured operations brief for `asset_ids` from real facts.

    Raises AIBriefUnavailableError when no API key is configured.
    `completer` is a test seam; defaults to the Anthropic client."""
    if not has_key():
        raise AIBriefUnavailableError(
            "AI brief unavailable — configure the LLM API key."
        )

    facts = build_facts(asset_ids)
    if not facts:
        raise AIBriefUnavailableError("No valid assets to brief.")

    completer = completer or _call_llm
    try:
        brief = completer(SYSTEM_PROMPT, _user_prompt(facts))
    except Exception as exc:  # noqa: BLE001 — network/timeout/API errors
        raise AIBriefUnavailableError(
            f"AI brief unavailable — provider error ({getattr(exc, '__class__', type(exc)).__name__})."
        ) from exc

    if not brief or not brief.strip():
        raise AIBriefUnavailableError("AI brief unavailable — empty provider response.")

    return {
        "asset_ids": asset_ids,
        "provider": os.getenv(MODEL_ENV, DEFAULT_MODEL),
        "generated": True,
        "brief": brief,
        "facts": facts,
    }