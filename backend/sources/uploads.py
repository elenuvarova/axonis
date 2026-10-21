"""
Parse uploaded documents (PDF / CSV / text) into plain text and, for CSV,
into structured rows. Used by the upload-enrichment flow.
"""
from __future__ import annotations
import codecs
import csv
import io
import itertools

_MAX_CHARS = 12000  # cap text fed downstream to keep AI calls bounded


def parse_document(filename: str, content: bytes) -> str:
    """Return a plain-text representation of the document."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text = _parse_pdf(content)
    elif name.endswith(".csv"):
        text = _csv_to_text(content)
    else:  # .txt, .md, or anything decodable
        text = decode_text(content)
    return text[:_MAX_CHARS].strip()


def decode_text(content: bytes) -> str:
    """Bytes → text for files saved by whatever the user had at hand: Excel
    writes UTF-16 or Windows-1252, other tools UTF-8 with or without a BOM.
    Read as UTF-8 regardless, UTF-16 kept a NUL between letters and 1252 lost
    every accent ("Müller" → "Mller")."""
    for bom, enc in ((codecs.BOM_UTF32_LE, "utf-32"), (codecs.BOM_UTF32_BE, "utf-32"),
                     (codecs.BOM_UTF8, "utf-8-sig"),
                     (codecs.BOM_UTF16_LE, "utf-16"), (codecs.BOM_UTF16_BE, "utf-16")):
        if content.startswith(bom):
            text = content.decode(enc, errors="replace")
            break
    else:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("cp1252", errors="replace")
    return text.replace("\x00", "")


def csv_rows(filename: str, content: bytes) -> list[dict]:
    """Return CSV rows as dicts (empty list for non-CSV / unparsable files)."""
    if not (filename or "").lower().endswith(".csv"):
        return []
    try:
        text = decode_text(content)
        reader = csv.DictReader(io.StringIO(text), dialect=_dialect(text))
        return list(itertools.islice(reader, 300))
    except Exception:
        return []


def _dialect(text: str):
    """Comma, or the semicolon a European Excel writes, or tab / pipe."""
    try:
        return csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        return csv.excel


def _parse_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages[:40]:  # cap pages
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception as exc:
        print(f"[upload] pdf parse error: {exc}")
        return ""


def _csv_to_text(content: bytes) -> str:
    try:
        text = decode_text(content)
        reader = csv.reader(io.StringIO(text), dialect=_dialect(text))
        lines = [", ".join(cell for cell in row if cell) for row in reader]
        return "\n".join(line for line in lines if line)[:_MAX_CHARS]
    except Exception:
        return ""
