import asyncio
from pathlib import Path
from collections.abc import Iterable

import jiwer

from extractor.annotate.annotate import AnnotationResponse, _annotate_videos
from extractor.annotate.models import MediaItem


# -------- Helpers: time & normalization -------- #
def timecode_to_seconds(timecode: str) -> int:
    minutes, seconds = timecode.split(":")
    return int(minutes) * 60 + int(seconds)


def interval_overlap_len(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    return max(0, end - start)


def tolerant_overlap(
    gt_start: int, gt_end: int, pred_start: int, pred_end: int, tol_seconds: int = 1
) -> int:
    """Overlap length after expanding both intervals by ±tol_seconds.
    Returns overlap length (0 if none). This makes matching tolerant to ~1s misalignment.
    """
    return interval_overlap_len(
        gt_start - tol_seconds,
        gt_end + tol_seconds,
        pred_start - tol_seconds,
        pred_end + tol_seconds,
    )


# -------- Helpers: text & set metrics -------- #
def normalize_str(s: str) -> str:
    return " ".join("".join(c.lower() for c in s if c.isalnum() or c.isspace()).split())


def title_similarity(gt: str, pred: str) -> float:
    # 1 - CER on normalized strings
    gt_n = normalize_str(gt)
    pred_n = normalize_str(pred)
    return 1.0 - float(jiwer.cer(gt_n, pred_n))


def set_f1(gt_items: Iterable[str | int], pred_items: Iterable[str | int]) -> float:
    gt_set = set(str(x).lower() for x in gt_items)
    pred_set = set(str(x).lower() for x in pred_items)
    if not gt_set and not pred_set:
        return 1.0
    if not gt_set or not pred_set:
        return 0.0
    tp = len(gt_set & pred_set)
    fp = len(pred_set - gt_set)
    fn = len(gt_set - pred_set)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def item_scores(gt: MediaItem, pred: MediaItem) -> dict[str, float]:
    return {
        "title": title_similarity(gt.title, pred.title),
        "authors": set_f1(gt.authors, pred.authors),
        "years": set_f1(gt.years, pred.years),
    }


# -------- Matching strategy (tolerant to time) -------- #
def match_items_tolerant(gt: AnnotationResponse, pred: AnnotationResponse):
    """Greedy one-to-one matching prioritizing content correctness.

    Strategy per GT item (in order):
    1) Compute raw-overlap candidates and rank by title similarity, then overlap.
    2) Compute tolerant-only candidates (±1s). If its title similarity is
       significantly better than the best raw candidate (by delta), prefer it.
    3) If no raw candidates, pick the best tolerant candidate.
    This avoids assigning a long overlapping pred with mismatched title when a
    near-by tolerant match has a much better title.
    """
    pairs: list[tuple[int, int]] = []
    used_pred: set[int] = set()
    delta_better = 0.2  # require clear advantage to overrule raw-overlap
    min_title_sim = 0.6  # don't force matches with clearly wrong titles

    def cand_key_by_title_then_overlap(score: float, overlap: int, center_dist: int):
        # Higher score first, then larger overlap, then closer in time
        return (score, overlap, -center_dist)

    for i, gt_item in enumerate(gt.items):
        gt_s = timecode_to_seconds(gt_item.timecode.start_time)
        gt_e = timecode_to_seconds(gt_item.timecode.end_time)
        gt_center = (gt_s + gt_e) // 2

        raw_cands: list[tuple[float, int, int, int]] = []  # (score, overlap, -dist, j)
        tol_cands: list[tuple[float, int, int, int]] = []

        for j, pred_item in enumerate(pred.items):
            if j in used_pred:
                continue
            ps = timecode_to_seconds(pred_item.timecode.start_time)
            pe = timecode_to_seconds(pred_item.timecode.end_time)
            score = title_similarity(gt_item.title, pred_item.title)
            center = (ps + pe) // 2
            dist = abs(center - gt_center)
            raw_ov = interval_overlap_len(gt_s, gt_e, ps, pe)
            tol_ov = tolerant_overlap(gt_s, gt_e, ps, pe, tol_seconds=1)
            if raw_ov > 0:
                raw_cands.append((score, raw_ov, -dist, j))
            elif tol_ov > 0:
                tol_cands.append((score, tol_ov, -dist, j))

        # Rank candidates
        raw_cands.sort(key=lambda t: (t[0], t[1], t[2]))  # score, overlap, -dist
        tol_cands.sort(key=lambda t: (t[0], t[1], t[2]))

        chosen = None
        if raw_cands:
            best_raw_score, best_raw_ov, best_raw_ndist, best_raw_j = raw_cands[-1]
            if tol_cands:
                best_tol_score, best_tol_ov, best_tol_ndist, best_tol_j = tol_cands[-1]
                # Prefer tolerant if it is clearly better by title
                if (
                    best_tol_score >= best_raw_score + delta_better
                    and best_tol_score >= min_title_sim
                ):
                    chosen = best_tol_j
                elif best_raw_score >= min_title_sim:
                    chosen = best_raw_j
            else:
                if best_raw_score >= min_title_sim:
                    chosen = best_raw_j
        elif tol_cands:
            best_tol_score, best_tol_ov, best_tol_ndist, best_tol_j = tol_cands[-1]
            if best_tol_score >= min_title_sim:
                chosen = best_tol_j

        if chosen is not None:
            pairs.append((i, chosen))
            used_pred.add(chosen)

    return pairs


# -------- Global assignment (Hungarian) on title similarity with time constraints -------- #
def hungarian_min_cost(cost: list[list[float]]):
    """Hungarian algorithm (min-cost assignment) for a square matrix.
    Returns list of assigned column indices for each row (or -1).
    Based on the shortest augmenting path implementation with potentials.
    """
    n = len(cost)
    if n == 0:
        return []
    m = len(cost[0])
    assert n == m, "Cost matrix must be square"

    u = [0.0] * (n + 1)
    v = [0.0] * (n + 1)
    p = [0] * (n + 1)
    way = [0] * (n + 1)

    for i in range(1, n + 1):
        p[0] = i
        j0 = 0
        minv = [float("inf")] * (n + 1)
        used = [False] * (n + 1)
        while True:
            used[j0] = True
            i0 = p[j0]
            delta = float("inf")
            j1 = 0
            for j in range(1, n + 1):
                if not used[j]:
                    cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j] = cur
                        way[j] = j0
                    if minv[j] < delta:
                        delta = minv[j]
                        j1 = j
            for j in range(0, n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break
    ans = [-1] * n
    for j in range(1, n + 1):
        if p[j] != 0:
            ans[p[j] - 1] = j - 1
    return ans


def match_items_global(gt: AnnotationResponse, pred: AnnotationResponse):
    """Global one-to-one assignment maximizing title similarity under time tolerance.

    - Feasible edges: raw-overlap or ±1s tolerant overlap.
    - Cost: (1 - title_similarity) + small penalties for tolerant-only and time distance.
    - Solved via Hungarian on a padded square matrix; unmatched rows/preds are ignored.
    """
    n = len(gt.items)
    m = len(pred.items)
    if n == 0 or m == 0:
        return []

    INF = 1e6
    size = max(n, m)
    # Build square matrix with padding
    mat = [[INF] * size for _ in range(size)]

    for i, g in enumerate(gt.items):
        gs = timecode_to_seconds(g.timecode.start_time)
        ge = timecode_to_seconds(g.timecode.end_time)
        gcenter = (gs + ge) // 2
        for j, p in enumerate(pred.items):
            ps = timecode_to_seconds(p.timecode.start_time)
            pe = timecode_to_seconds(p.timecode.end_time)
            raw_ov = interval_overlap_len(gs, ge, ps, pe)
            tol_ov = tolerant_overlap(gs, ge, ps, pe, tol_seconds=1)
            if tol_ov <= 0:
                continue  # infeasible, keep INF
            sim = title_similarity(g.title, p.title)
            base = 1.0 - sim
            # prefer raw overlap if available; add small penalty if tolerant-only
            penalty = 0.0 if raw_ov > 0 else 0.05
            # small preference for closer centers (scale to seconds)
            dist = abs(((ps + pe) // 2) - gcenter)
            mat[i][j] = base + penalty + 0.002 * dist

    # Hungarian expects square matrix
    assign = hungarian_min_cost(mat)
    pairs: list[tuple[int, int]] = []
    for i, j in enumerate(assign):
        if 0 <= i < n and 0 <= j < m and mat[i][j] < INF / 2:
            pairs.append((i, j))
    return pairs


def test_annotate():
    # Use this file's folder as the canonical tests directory for GT/pred files
    tests_dir = Path(__file__).resolve().parent

    gt_path = tests_dir / "groundtruth" / "HLUe85q1hNM" / "annotations.json"
    pred_path = tests_dir / "predictions" / "HLUe85q1hNM.json"

    gt = AnnotationResponse.model_validate_json(gt_path.read_text())

    bucket_name = "videoclub-test"
    video_blob_list = ["videos/HLUe85q1hNM/video.mp4"]
    job_id = 1757449294
    job_name = "projects/videoclub-447210/locations/europe-west9/batchPredictionJobs/953934089235202048"
    job_id = None
    job_name = None
    annotations = asyncio.run(
        _annotate_videos(
            bucket_name,
            video_blob_list,
            job_id,
            job_name,
        )
    )
    pred = annotations["HLUe85q1hNM"]
    pred_path.parent.mkdir(parents=True, exist_ok=True)
    pred_path.write_text(pred.model_dump_json(indent=2))

    # Matching via global assignment on title similarity with ±1s tolerance
    pairs = match_items_global(gt, pred)

    # Detection metrics (time-tolerant)
    precision = len(pairs) / len(pred.items) if pred.items else 0.0
    recall = len(pairs) / len(gt.items) if gt.items else 0.0

    # Field accuracy over matched pairs
    title_scores: list[float] = []
    author_scores: list[float] = []
    year_scores: list[float] = []
    for gi, pj in pairs:
        s = item_scores(gt.items[gi], pred.items[pj])
        title_scores.append(s["title"])
        author_scores.append(s["authors"])
        year_scores.append(s["years"])

    def mean(xs: list[float]) -> float:
        return sum(xs) / len(xs) if xs else 0.0

    title_mean = mean(title_scores)
    authors_mean = mean(author_scores)
    years_mean = mean(year_scores)

    # Weighted overall score (prioritize content over timing)
    # Emphasize: title 0.5, authors 0.3, years 0.2
    overall = 0.5 * title_mean + 0.3 * authors_mean + 0.2 * years_mean

    print(f"Matched: {len(pairs)} / GT: {len(gt.items)} / Pred: {len(pred.items)}")
    print(f"Precision: {precision:.2f}, Recall: {recall:.2f}")
    print(f"Title similarity (1-CER): {title_mean:.2f}")
    print(f"Authors F1: {authors_mean:.2f}")
    print(f"Years F1: {years_mean:.2f}")
    print(f"Overall weighted score: {overall:.2f}")

    # Diagnostics: list unmatched items for quick inspection
    matched_pred = {pj for _, pj in pairs}
    matched_gt = {gi for gi, _ in pairs}
    for idx, item in enumerate(pred.items):
        if idx not in matched_pred:
            print(f"False positive (pred only): {item}")
    for idx, item in enumerate(gt.items):
        if idx not in matched_gt:
            print(f"Missed (gt only): {item}")


# Allow manual run
if __name__ == "__main__":
    test_annotate()
