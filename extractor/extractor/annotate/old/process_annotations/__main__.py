import sys

from . import process_annotations

print(process_annotations(sys.argv[1], sys.argv[2], sys.argv[3], debug=True))
