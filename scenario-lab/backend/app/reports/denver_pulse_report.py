"""
PDF and CSV report generation for Denver Pulse scenarios and comparisons.

All functions accept plain dicts (not Pydantic models) so they can be called
from any context without import coupling.
"""
from __future__ import annotations

import csv
import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------
POLICY_LABELS: dict[str, str] = {
    "ev": "EV Incentive Program",
    "bus": "Dedicated Bus Lane",
    "toll": "Congestion Pricing",
    "bike": "Bike Lane Expansion",
    "diet": "Road Diet Implementation",
}

HORIZON_LABELS: dict[str, str] = {
    "3m": "3 Months",
    "6m": "6 Months",
    "1y": "1 Year",
}

SCOPE_LABELS: dict[str, str] = {
    "downtown": "Downtown",
    "corridor": "Corridor",
    "city": "City-wide",
}

SLIDER_LABELS: dict[str, str] = {
    "traffic_vol_idx": "Traffic Volume Index",
    "road_capacity_idx": "Road Capacity Index",
    "speed_kmh": "Speed (km/h)",
    "emission_idx": "Emission Index",
    "ev_share_pct": "EV Share (%)",
    "car_pct": "Car (%)",
    "pt_pct": "Public Transit (%)",
    "bike_pct": "Bike (%)",
    "walk_pct": "Walk (%)",
}

KPI_DEFS: list[dict[str, Any]] = [
    {"key": "ghg_tco2e", "label": "GHG Emissions (tCO2e)", "lower_is_better": True},
    {"key": "congestion_pct", "label": "Congestion (%)", "lower_is_better": True},
    {"key": "avg_speed_kmh", "label": "Avg Speed (km/h)", "lower_is_better": False},
]

MODE_DEFS: list[dict[str, Any]] = [
    {"key": "car", "label": "Car Mode Share (%)", "lower_is_better": True},
    {"key": "pt", "label": "Public Transit (%)", "lower_is_better": False},
    {"key": "bike", "label": "Bike (%)", "lower_is_better": False},
    {"key": "walk", "label": "Walk (%)", "lower_is_better": False},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sim(scenario: dict) -> dict:
    return scenario.get("simulate_result", {})


def _fmt_change(val: float) -> str:
    if val > 0:
        return f"+{val:.1f}"
    return f"{val:.1f}"


def _is_improvement(val: float, lower_is_better: bool) -> bool:
    if lower_is_better:
        return val < 0
    return val > 0


# ===================================================================
# CSV — Single scenario
# ===================================================================

def generate_scenario_csv(scenario: dict) -> bytes:
    """Return a UTF-8 encoded CSV report for a single saved scenario."""
    buf = io.StringIO()
    w = csv.writer(buf)

    sim = _sim(scenario)
    baseline = sim.get("baseline", {})
    scen = sim.get("scenario", {})
    deltas = sim.get("deltas", {})

    # -- Header --
    w.writerow(["Denver Pulse Scenario Report"])
    w.writerow([])
    w.writerow(["ID", scenario.get("short_id", scenario.get("id", ""))])
    w.writerow(["Name", scenario.get("name", "")])
    w.writerow(["Saved By", scenario.get("saved_by", "")])
    w.writerow(["Saved At", scenario.get("created_at", "")])
    w.writerow(["Scope", SCOPE_LABELS.get(scenario.get("scope", ""), scenario.get("scope", ""))])
    w.writerow(["Horizon", HORIZON_LABELS.get(scenario.get("horizon", ""), scenario.get("horizon", ""))])
    w.writerow([])

    # -- Policies Applied --
    w.writerow(["Policies Applied"])
    for p in scenario.get("policies", []):
        w.writerow(["", POLICY_LABELS.get(p, p)])
    w.writerow([])

    # -- Parameters --
    w.writerow(["Parameters"])
    w.writerow(["Parameter", "Value"])
    sliders = scenario.get("sliders", {})
    for key, label in SLIDER_LABELS.items():
        w.writerow([label, sliders.get(key, "")])
    w.writerow([])

    # -- KPI Results --
    w.writerow(["KPI Results"])
    w.writerow(["Metric", "Baseline", "Scenario", "Change"])

    for kpi in KPI_DEFS:
        k = kpi["key"]
        b_val = baseline.get(k, 0)
        s_val = scen.get(k, 0)
        d_val = deltas.get(f"{k}_delta", 0)
        w.writerow([kpi["label"], f"{b_val:.1f}", f"{s_val:.1f}", _fmt_change(d_val)])

    b_mode = baseline.get("mode_share", {})
    s_mode = scen.get("mode_share", {})
    d_mode = deltas.get("mode_share_delta", {})
    for md in MODE_DEFS:
        k = md["key"]
        w.writerow([
            md["label"],
            f"{b_mode.get(k, 0):.1f}",
            f"{s_mode.get(k, 0):.1f}",
            _fmt_change(d_mode.get(k, 0)),
        ])
    w.writerow([])

    # -- Confidence --
    w.writerow(["Confidence Score", scenario.get("confidence_score", sim.get("confidence_score", ""))])

    return buf.getvalue().encode("utf-8")


# ===================================================================
# PDF — Single scenario
# ===================================================================

def generate_scenario_pdf(scenario: dict) -> bytes:
    """Return PDF bytes for a single saved scenario."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
                            leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                            topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18,
                                  spaceAfter=12)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13,
                         spaceBefore=14, spaceAfter=6)

    elements: list[Any] = []

    sim = _sim(scenario)
    baseline = sim.get("baseline", {})
    scen = sim.get("scenario", {})
    deltas = sim.get("deltas", {})

    # Title
    elements.append(Paragraph("Denver Pulse — Scenario Report", title_style))
    elements.append(Spacer(1, 6))

    # Metadata table
    meta_data = [
        ["ID", scenario.get("short_id", scenario.get("id", ""))],
        ["Name", scenario.get("name", "")],
        ["Saved By", scenario.get("saved_by", "")],
        ["Saved At", scenario.get("created_at", "")],
        ["Scope", SCOPE_LABELS.get(scenario.get("scope", ""), scenario.get("scope", ""))],
        ["Horizon", HORIZON_LABELS.get(scenario.get("horizon", ""), scenario.get("horizon", ""))],
    ]
    meta_tbl = Table(meta_data, colWidths=[1.6 * inch, 4.5 * inch])
    meta_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(meta_tbl)
    elements.append(Spacer(1, 10))

    # Policies
    elements.append(Paragraph("Policies Applied", h2))
    for p in scenario.get("policies", []):
        elements.append(Paragraph(f"• {POLICY_LABELS.get(p, p)}", styles["Normal"]))
    elements.append(Spacer(1, 10))

    # Parameters
    elements.append(Paragraph("Parameters", h2))
    sliders = scenario.get("sliders", {})
    param_rows = [["Parameter", "Value"]]
    for key, label in SLIDER_LABELS.items():
        param_rows.append([label, str(sliders.get(key, ""))])
    param_tbl = Table(param_rows, colWidths=[3.0 * inch, 2.0 * inch])
    param_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(param_tbl)
    elements.append(Spacer(1, 10))

    # KPI Results
    elements.append(Paragraph("KPI Results", h2))
    kpi_rows = [["Metric", "Baseline", "Scenario", "Change"]]
    kpi_colors: list[tuple[int, bool]] = []  # (row_idx, is_improvement)

    row_idx = 1
    for kpi in KPI_DEFS:
        k = kpi["key"]
        b_val = baseline.get(k, 0)
        s_val = scen.get(k, 0)
        d_val = deltas.get(f"{k}_delta", 0)
        kpi_rows.append([kpi["label"], f"{b_val:.1f}", f"{s_val:.1f}", _fmt_change(d_val)])
        kpi_colors.append((row_idx, _is_improvement(d_val, kpi["lower_is_better"])))
        row_idx += 1

    b_mode = baseline.get("mode_share", {})
    s_mode = scen.get("mode_share", {})
    d_mode = deltas.get("mode_share_delta", {})
    for md in MODE_DEFS:
        k = md["key"]
        d_val = d_mode.get(k, 0)
        kpi_rows.append([
            md["label"],
            f"{b_mode.get(k, 0):.1f}",
            f"{s_mode.get(k, 0):.1f}",
            _fmt_change(d_val),
        ])
        kpi_colors.append((row_idx, _is_improvement(d_val, md["lower_is_better"])))
        row_idx += 1

    kpi_tbl = Table(kpi_rows, colWidths=[2.4 * inch, 1.3 * inch, 1.3 * inch, 1.3 * inch])
    style_cmds: list[Any] = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]
    for ri, improved in kpi_colors:
        clr = colors.HexColor("#16A34A") if improved else colors.HexColor("#DC2626")
        style_cmds.append(("TEXTCOLOR", (3, ri), (3, ri), clr))
        style_cmds.append(("FONTNAME", (3, ri), (3, ri), "Helvetica-Bold"))
    kpi_tbl.setStyle(TableStyle(style_cmds))
    elements.append(kpi_tbl)
    elements.append(Spacer(1, 10))

    # Confidence
    conf = scenario.get("confidence_score", sim.get("confidence_score", ""))
    elements.append(Paragraph(f"Confidence Score: <b>{conf}</b>", styles["Normal"]))

    doc.build(elements)
    return buf.getvalue()


# ===================================================================
# CSV — Comparison
# ===================================================================

def generate_compare_csv(compare: dict) -> bytes:
    """Return a UTF-8 encoded CSV report comparing multiple scenarios."""
    buf = io.StringIO()
    w = csv.writer(buf)

    scenarios = compare.get("scenarios", [])
    names = [s.get("name", s.get("short_id", "")) for s in scenarios]

    # -- Header --
    w.writerow(["Denver Pulse Comparison Report"])
    w.writerow([])

    # -- Scenario Overview --
    w.writerow(["Scenario Overview"])
    w.writerow(["", *names])
    w.writerow(["ID", *[s.get("short_id", s.get("id", "")) for s in scenarios]])
    w.writerow(["Scope", *[SCOPE_LABELS.get(s.get("scope", ""), s.get("scope", "")) for s in scenarios]])
    w.writerow(["Horizon", *[HORIZON_LABELS.get(s.get("horizon", ""), s.get("horizon", "")) for s in scenarios]])
    w.writerow([])

    # -- KPI Comparison --
    w.writerow(["KPI Comparison"])
    kpi_rows = compare.get("kpi_rows", [])
    if kpi_rows:
        # Build header from first row keys (except 'metric')
        header = ["Metric"] + names
        w.writerow(header)
        for row in kpi_rows:
            csv_row = [row.get("metric", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                csv_row.append(row.get(sid, ""))
            w.writerow(csv_row)
    w.writerow([])

    # -- Parameter Comparison --
    w.writerow(["Parameter Comparison"])
    param_rows = compare.get("param_rows", [])
    if param_rows:
        w.writerow(["Parameter"] + names)
        for row in param_rows:
            csv_row = [row.get("param", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                csv_row.append(row.get(sid, ""))
            w.writerow(csv_row)
    w.writerow([])

    # -- Policy Breakdown --
    w.writerow(["Policy Breakdown"])
    policy_rows = compare.get("policy_rows", [])
    if policy_rows:
        w.writerow(["Policy"] + names)
        for row in policy_rows:
            csv_row = [row.get("policy", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                csv_row.append("Yes" if row.get(sid, False) else "No")
            w.writerow(csv_row)
    w.writerow([])

    # -- Confidence Scores --
    w.writerow(["Confidence Scores"])
    conf_cards = compare.get("confidence_cards", [])
    if conf_cards:
        w.writerow(["Scenario", "Score"])
        for card in conf_cards:
            w.writerow([card.get("name", card.get("short_id", "")),
                         card.get("score", card.get("confidence_score", ""))])
    else:
        w.writerow(["Scenario", "Score"])
        for s in scenarios:
            sim = _sim(s)
            w.writerow([s.get("name", s.get("short_id", "")),
                         s.get("confidence_score", sim.get("confidence_score", ""))])

    return buf.getvalue().encode("utf-8")


# ===================================================================
# PDF — Comparison
# ===================================================================

def generate_compare_pdf(compare: dict) -> bytes:
    """Return PDF bytes for a multi-scenario comparison."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
                            leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18,
                                  spaceAfter=12)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13,
                         spaceBefore=14, spaceAfter=6)

    elements: list[Any] = []
    scenarios = compare.get("scenarios", [])
    names = [s.get("name", s.get("short_id", "")) for s in scenarios]
    n = len(scenarios)

    # Title
    elements.append(Paragraph("Denver Pulse — Comparison Report", title_style))
    elements.append(Spacer(1, 6))

    # -- Scenario Overview --
    elements.append(Paragraph("Scenario Overview", h2))
    overview_rows = [
        ["", *names],
        ["ID", *[s.get("short_id", s.get("id", "")) for s in scenarios]],
        ["Scope", *[SCOPE_LABELS.get(s.get("scope", ""), s.get("scope", "")) for s in scenarios]],
        ["Horizon", *[HORIZON_LABELS.get(s.get("horizon", ""), s.get("horizon", "")) for s in scenarios]],
    ]
    col_w = min(2.0, 6.0 / max(n, 1))
    ov_tbl = Table(overview_rows, colWidths=[1.6 * inch] + [col_w * inch] * n)
    ov_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(ov_tbl)
    elements.append(Spacer(1, 10))

    # -- KPI Comparison --
    kpi_rows_data = compare.get("kpi_rows", [])
    if kpi_rows_data:
        elements.append(Paragraph("KPI Comparison", h2))
        header = ["Metric"] + names
        table_rows = [header]
        for row in kpi_rows_data:
            r = [row.get("metric", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                r.append(str(row.get(sid, "")))
            table_rows.append(r)

        kpi_tbl = Table(table_rows, colWidths=[2.0 * inch] + [col_w * inch] * n)
        kpi_style_cmds: list[Any] = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]
        # Color-code delta rows (rows containing "delta" or change values)
        for ri, row in enumerate(kpi_rows_data):
            metric = row.get("metric", "").lower()
            # Determine if lower is better
            lower_better = any(
                kw in metric for kw in ("ghg", "congestion", "car")
            )
            for ci, s in enumerate(scenarios):
                sid = s.get("short_id", s.get("id", ""))
                val = row.get(sid, "")
                if isinstance(val, str) and ("+" in val or (val.startswith("-") and val != "-")):
                    try:
                        num = float(val.replace("%", "").replace(",", ""))
                        improved = (num < 0) if lower_better else (num > 0)
                        clr = colors.HexColor("#16A34A") if improved else colors.HexColor("#DC2626")
                        kpi_style_cmds.append(("TEXTCOLOR", (ci + 1, ri + 1), (ci + 1, ri + 1), clr))
                        kpi_style_cmds.append(("FONTNAME", (ci + 1, ri + 1), (ci + 1, ri + 1), "Helvetica-Bold"))
                    except ValueError:
                        pass
        kpi_tbl.setStyle(TableStyle(kpi_style_cmds))
        elements.append(kpi_tbl)
        elements.append(Spacer(1, 10))

    # -- Parameter Comparison --
    param_rows_data = compare.get("param_rows", [])
    if param_rows_data:
        elements.append(Paragraph("Parameter Comparison", h2))
        header = ["Parameter"] + names
        table_rows = [header]
        for row in param_rows_data:
            r = [row.get("param", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                r.append(str(row.get(sid, "")))
            table_rows.append(r)
        p_tbl = Table(table_rows, colWidths=[2.0 * inch] + [col_w * inch] * n)
        p_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        elements.append(p_tbl)
        elements.append(Spacer(1, 10))

    # -- Policy Breakdown --
    policy_rows_data = compare.get("policy_rows", [])
    if policy_rows_data:
        elements.append(Paragraph("Policy Breakdown", h2))
        header = ["Policy"] + names
        table_rows = [header]
        for row in policy_rows_data:
            r = [row.get("policy", "")]
            for s in scenarios:
                sid = s.get("short_id", s.get("id", ""))
                val = row.get(sid, False)
                r.append("Yes" if val else "No")
            table_rows.append(r)
        pol_tbl = Table(table_rows, colWidths=[2.0 * inch] + [col_w * inch] * n)
        pol_style_cmds: list[Any] = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]
        # Color Yes/No
        for ri, row in enumerate(policy_rows_data):
            for ci, s in enumerate(scenarios):
                sid = s.get("short_id", s.get("id", ""))
                if row.get(sid, False):
                    pol_style_cmds.append(("TEXTCOLOR", (ci + 1, ri + 1), (ci + 1, ri + 1), colors.HexColor("#16A34A")))
                else:
                    pol_style_cmds.append(("TEXTCOLOR", (ci + 1, ri + 1), (ci + 1, ri + 1), colors.HexColor("#9CA3AF")))
        pol_tbl.setStyle(TableStyle(pol_style_cmds))
        elements.append(pol_tbl)
        elements.append(Spacer(1, 10))

    # -- Confidence Scores --
    elements.append(Paragraph("Confidence Scores", h2))
    conf_cards = compare.get("confidence_cards", [])
    if conf_cards:
        conf_rows = [["Scenario", "Score"]]
        for card in conf_cards:
            conf_rows.append([
                card.get("name", card.get("short_id", "")),
                str(card.get("score", card.get("confidence_score", ""))),
            ])
    else:
        conf_rows = [["Scenario", "Score"]]
        for s in scenarios:
            sim = _sim(s)
            conf_rows.append([
                s.get("name", s.get("short_id", "")),
                str(s.get("confidence_score", sim.get("confidence_score", ""))),
            ])
    conf_tbl = Table(conf_rows, colWidths=[3.0 * inch, 1.5 * inch])
    conf_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(conf_tbl)

    doc.build(elements)
    return buf.getvalue()
