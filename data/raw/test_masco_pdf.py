from pathlib import Path

from masco_pdf import extract_masco_rows, parse_masco_text


SAMPLE_TEXT = """
MAJOR GROUP 1 MANAGERS
SUB-MAJOR 11 CORPORATE MANAGERS
MINOR GROUP 111 CHIEF EXECUTIVES, SENIOR OFFICIALS AND LEGISLATORS
UNIT GROUP 1111 CHIEF EXECUTIVES AND MANAGING DIRECTORS
Chief Executives and Managing Directors plan, direct and coordinate the overall activities of an organisation.
Tasks include:
a) formulating policies;
b) directing daily operations; and
c) performing related tasks.
Examples of the occupations classified here: (refer to index; unit group 1111)
1111-01 Chief Executive Officer
1111-02 Managing Director
"""


def test_parse_unit_group_keeps_hierarchy_description_and_tasks():
    rows = parse_masco_text(SAMPLE_TEXT)

    assert len(rows) == 3
    assert rows[0]["unit_code"] == "1111"
    assert rows[0]["unit_title"] == "CHIEF EXECUTIVES AND MANAGING DIRECTORS"
    assert rows[0]["major_code"] == "1"
    assert rows[0]["sub_major_code"] == "11"
    assert rows[0]["minor_code"] == "111"
    assert rows[0]["task_letter"] == "a"
    assert rows[0]["task_text"] == "formulating policies;"
    assert rows[0]["unit_description"].startswith("Chief Executives")


def test_extract_masco_rows_reads_pdf_and_returns_many_units():
    pdf_path = Path(__file__).parents[1] / "sources" / "masco" / "masco_2020_en.pdf"

    rows = extract_masco_rows(pdf_path)

    assert len(rows) > 1000
    assert {row["unit_code"] for row in rows}.__len__() > 400
    assert all(row["source"] == "MASCO 2020" for row in rows)
    assert all(row["source_year"] == "2020" for row in rows)
