from __future__ import annotations

import argparse
import sys
from google.cloud import firestore


def cmd_add(args: argparse.Namespace) -> int:
    db = firestore.Client()
    # Create a generic doc ID; we don't rely on doc ID equality with video_id
    doc_ref = db.collection("blacklist").document()
    doc_ref.set({"video_id": args.video_id})
    print(f"Added to blacklist: {args.video_id} (doc: {doc_ref.id})")
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    db = firestore.Client()
    # Delete any doc where video_id matches
    q = db.collection("blacklist").where("video_id", "==", args.video_id).stream()
    found = False
    for snap in q:
        snap.reference.delete()
        found = True
        print(f"Removed doc: {snap.id}")
    if not found:
        print("No matching entries found", file=sys.stderr)
        return 1
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    db = firestore.Client()
    snaps = list(db.collection("blacklist").stream())
    if not snaps:
        print("(empty)")
        return 0
    for s in snaps:
        data = s.to_dict() or {}
        print(f"{data.get('video_id')}\t(doc: {s.id})")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Manage blacklist entries in Firestore")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Add a video_id to blacklist")
    p_add.add_argument("video_id", help="YouTube video ID to blacklist")
    p_add.set_defaults(func=cmd_add)

    p_rm = sub.add_parser("remove", help="Remove a video_id from blacklist")
    p_rm.add_argument("video_id", help="YouTube video ID to remove")
    p_rm.set_defaults(func=cmd_remove)

    p_ls = sub.add_parser("list", help="List blacklist entries")
    p_ls.set_defaults(func=cmd_list)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

