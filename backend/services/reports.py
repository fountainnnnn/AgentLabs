"""Report building for every run kind, plus the pre/post comparison used by retests."""

from __future__ import annotations

import html
from typing import Any

from services import run_store

HARDENING_LIMITATIONS = [
    "AgentLabs hardens the agent wrapper (system prompt, tool policy, output filters); no model weights are changed.",
    "Verifiers are deterministic regex and rule checks. They catch the failure patterns they encode and can miss subtle semantic failures.",
    "Attack cases come from a curated seed library; passing them does not prove the agent is safe against novel attacks.",
]
MOCK_LIMITATION = (
    "This run used the deterministic mock provider: target agent replies were produced by an offline simulator, "
    "not a real LLM. The loop, verifiers, patches and wrapper gates are real code, but the measured rates describe the simulator."
)


def compare(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> dict[str, Any]:
    """Case-by-case comparison of two result lists over the same cases."""
    after_by_id = {r["case_id"]: r for r in after}
    improvements = regressions = stayed_pass = stayed_fail = 0
    for b in before:
        a = after_by_id.get(b["case_id"])
        if a is None:
            continue
        if not b["passed"] and a["passed"]:
            improvements += 1
        elif b["passed"] and not a["passed"]:
            regressions += 1
        elif b["passed"]:
            stayed_pass += 1
        else:
            stayed_fail += 1
    total = max(len(before), 1)
    before_rate = round(100 * sum(1 for r in before if not r["passed"]) / total, 1)
    after_rate = round(100 * sum(1 for r in after if not r["passed"]) / max(len(after), 1), 1)
    return {
        "total": len(before),
        "improvements": improvements,
        "regressions": regressions,
        "stayed_pass": stayed_pass,
        "stayed_fail": stayed_fail,
        "before_failure_rate": before_rate,
        "after_failure_rate": after_rate,
    }


def _category_table(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cats: dict[str, dict[str, int]] = {}
    for r in before:
        c = cats.setdefault(r["category"], {"total": 0, "before_failed": 0, "after_failed": 0})
        c["total"] += 1
        c["before_failed"] += 0 if r["passed"] else 1
    for r in after:
        if r["category"] in cats and not r["passed"]:
            cats[r["category"]]["after_failed"] += 1
    return [
        {"category": k, **v,
         "before_failure_rate": round(100 * v["before_failed"] / max(v["total"], 1), 1),
         "after_failure_rate": round(100 * v["after_failed"] / max(v["total"], 1), 1)}
        for k, v in sorted(cats.items())
    ]


def _clusters(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clusters: dict[str, dict[str, Any]] = {}
    for r in results:
        if r["passed"]:
            continue
        c = clusters.setdefault(r["failure_category"] or "unknown", {"count": 0, "categories": {}, "example": None})
        c["count"] += 1
        c["categories"][r["category"]] = c["categories"].get(r["category"], 0) + 1
        if c["example"] is None:
            c["example"] = {"prompt": r["prompt"], "response": r["response"], "reason": r["failure_reason"]}
    return sorted(({"failure_category": k, **v} for k, v in clusters.items()), key=lambda c: -c["count"])


async def build_report(run_id: str) -> dict[str, Any] | None:
    run = await run_store.get_run(run_id)
    if run is None:
        return None
    base = run_store.run_dict(run)
    results = await run_store.list_case_results(run_id)
    report: dict[str, Any] = {
        "report_type": f"{run.kind}_report",
        "product": "AgentLabs",
        "run": base,
        "real_or_simulated": run.real_or_simulated,
        "truth_mode": run.truth_mode,
    }
    if run.kind == "hardening":
        before = [r for r in results if r["phase"] in ("baseline_v0",)]
        # wave 1 pre-patch results are also v0; baseline_v0 covers every case
        after = [r for r in results if r["phase"] == "regression"]
        patches = await run_store.list_patches(run_id)
        examples = []
        after_by_id = {r["case_id"]: r for r in after}
        for b in before:
            a = after_by_id.get(b["case_id"])
            if a and not b["passed"]:
                examples.append({"case_id": b["case_id"], "category": b["category"], "prompt": b["prompt"],
                                 "before_response": b["response"], "before_failure": b["failure_reason"],
                                 "after_response": a["response"], "after_passed": a["passed"],
                                 "after_failure": a["failure_reason"]})
        limitations = list(HARDENING_LIMITATIONS)
        if run.real_or_simulated == "simulated":
            limitations.insert(0, MOCK_LIMITATION)
        report.update(
            tested_attacks=len(before),
            before_metrics={"failure_rate": run.summary.get("failure_rate_before"), "generation": "v0"},
            after_metrics={"failure_rate": run.summary.get("failure_rate_after"),
                           "generation": f"v{run.summary.get('final_generation', 0)}"},
            comparison=compare(before, after) if before else None,
            category_breakdown=_category_table(before, after),
            failure_clusters=_clusters(before + [r for r in results if r["phase"] == "pre_patch"]),
            wave_summaries=run.summary.get("wave_summaries", []),
            patch_list=patches,
            failure_examples=examples[:25],
            limitations=limitations,
        )
    elif run.kind == "model_eval":
        report.update(
            metrics=run.summary.get("metrics", {}),
            category_scores=run.summary.get("category_scores", {}),
            failure_clusters=_clusters(results),
            cases=results[:200],
            limitations=run.summary.get("limitations", []),
        )
    elif run.kind == "lora_training":
        report.update(
            training=run.summary,
            limitations=run.summary.get("limitations", []),
        )
    return report


# ---------------------------------------------------------------- HTML rendering

def _e(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))


CSS = """
body{margin:0;background:#FCFCF7;color:#1D1D1F;font:14px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 20px}
h1{font-size:30px;margin:4px 0 12px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#575A60;margin:28px 0 10px}
.eyebrow{color:#7C3AED;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.metric{border:1px solid #DCD8CC;background:#FDFDFD;border-radius:10px;padding:12px}
.metric span{display:block;color:#7A7D85;font-size:11px;font-weight:700;text-transform:uppercase}
.metric strong{display:block;margin-top:4px;font:600 20px ui-monospace,SFMono-Regular,Menlo,monospace}
table{width:100%;border-collapse:collapse;background:#FDFDFD;border:1px solid #DCD8CC;border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #ECE8DE;text-align:left;font-size:13px;vertical-align:top}
th{background:#F4F1F8;font-size:11px;text-transform:uppercase;color:#575A60}
.case{border:1px solid #DCD8CC;background:#FDFDFD;border-radius:10px;margin:12px 0;overflow:hidden;break-inside:avoid}
.case header{padding:8px 12px;background:#F2F8FC;font-size:12px;font-weight:700;color:#575A60;text-transform:uppercase}
.case p{margin:0;padding:10px 12px;white-space:pre-wrap}
.cols{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ECE8DE}.cols div+div{border-left:1px solid #ECE8DE}
.fail{color:#C2414B}.pass{color:#21865A}
.truth{margin-top:24px;padding:14px;border:1px solid #DCD8CC;border-radius:10px;background:#FBF5DF;font-size:13px}
pre{white-space:pre-wrap;font:12px ui-monospace,Menlo,monospace;background:#FAF9F6;border:1px solid #DCD8CC;border-radius:8px;padding:10px}
@media print{body{background:#fff}}
"""


def render_html(report: dict[str, Any]) -> str:
    run = report["run"]
    parts = [
        f"<!doctype html><html><head><meta charset='utf-8'><title>AgentLabs report {_e(run['id'])}</title><style>{CSS}</style></head><body><main>",
        f"<div class='eyebrow'>AgentLabs {_e(run['kind'].replace('_', ' '))} report</div>",
        f"<h1>{_e(run['name'])}</h1>",
        "<div class='grid'>",
        f"<div class='metric'><span>real_or_simulated</span><strong>{_e(report['real_or_simulated'])}</strong></div>",
        f"<div class='metric'><span>Provider</span><strong>{_e(run['provider'])}</strong></div>",
        f"<div class='metric'><span>Status</span><strong>{_e(run['status'])}</strong></div>",
        f"<div class='metric'><span>Run</span><strong>{_e(run['id'])}</strong></div>",
        "</div>",
    ]
    if run["kind"] == "hardening":
        s = run["summary"]
        parts += [
            "<h2>Before vs after</h2><div class='grid'>",
            f"<div class='metric'><span>v0 failure rate</span><strong class='fail'>{_e(s.get('failure_rate_before'))}%</strong></div>",
            f"<div class='metric'><span>v{_e(s.get('final_generation'))} failure rate</span><strong class='pass'>{_e(s.get('failure_rate_after'))}%</strong></div>",
            f"<div class='metric'><span>Cases fixed</span><strong>{_e(s.get('improvements'))}</strong></div>",
            f"<div class='metric'><span>Regressions</span><strong>{_e(s.get('regressions'))}</strong></div></div>",
            "<h2>Categories</h2><table><tr><th>Category</th><th>Cases</th><th>v0 failure</th><th>Final failure</th></tr>",
        ]
        for row in report.get("category_breakdown", []):
            parts.append(f"<tr><td>{_e(row['category'])}</td><td>{row['total']}</td><td>{row['before_failure_rate']}%</td><td>{row['after_failure_rate']}%</td></tr>")
        parts.append("</table><h2>Patches</h2>")
        for p in report.get("patch_list", []):
            rules = "\n".join(p["changes"].get("added_system_rules", []))
            parts.append(f"<div class='case'><header>{_e(p['title'])} (wave {p['wave']}, {_e(p['source'])})</header><p>{_e(p['rationale'])}</p><pre>{_e(rules)}</pre></div>")
        parts.append("<h2>Failure examples</h2>")
        for ex in report.get("failure_examples", [])[:12]:
            status = "<span class='pass'>fixed</span>" if ex["after_passed"] else "<span class='fail'>still failing</span>"
            parts.append(
                f"<div class='case'><header>{_e(ex['category'])} - {status}</header><p>{_e(ex['prompt'])}</p>"
                f"<div class='cols'><div><p><b>v0</b> ({_e(ex['before_failure'])})\n{_e(ex['before_response'])}</p></div>"
                f"<div><p><b>Hardened</b>\n{_e(ex['after_response'])}</p></div></div></div>"
            )
    elif run["kind"] == "model_eval":
        m = report.get("metrics", {})
        parts.append("<h2>Metrics</h2><div class='grid'>")
        for key in ("pass_rate", "reward", "refusal_accuracy", "leakage_rate", "over_refusal_rate"):
            parts.append(f"<div class='metric'><span>{_e(key)}</span><strong>{_e(m.get(key))}</strong></div>")
        parts.append("</div><h2>Cases</h2>")
        for c in report.get("cases", [])[:30]:
            cls = "pass" if c["passed"] else "fail"
            parts.append(f"<div class='case'><header>{_e(c['category'])} <span class='{cls}'>{'pass' if c['passed'] else 'fail'}</span></header><p>{_e(c['prompt'])}</p><p><b>Response</b>\n{_e(c['response'])}</p></div>")
    elif run["kind"] == "lora_training":
        t = report.get("training", {})
        parts.append("<h2>Training</h2><pre>" + _e({k: v for k, v in t.items() if k not in ('trace', 'artifacts')}) + "</pre>")
    parts.append("<h2>Limitations</h2><div class='truth'><ul>")
    for lim in report.get("limitations", []):
        parts.append(f"<li>{_e(lim)}</li>")
    parts.append("</ul></div></main></body></html>")
    return "".join(parts)
