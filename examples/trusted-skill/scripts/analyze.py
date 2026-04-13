#!/usr/bin/env python3
"""CSV Analyzer - Generate summary statistics from CSV files."""

import sys
import os
import pandas as pd


def analyze(input_path: str, output_dir: str) -> None:
    """Read a CSV file and write a summary report."""
    df = pd.read_csv(input_path)

    report_lines = []
    report_lines.append(f"# CSV Analysis Report: {os.path.basename(input_path)}")
    report_lines.append("")
    report_lines.append(f"**Rows:** {len(df)}")
    report_lines.append(f"**Columns:** {len(df.columns)}")
    report_lines.append("")

    report_lines.append("## Column Types")
    for col in df.columns:
        report_lines.append(f"- {col}: {df[col].dtype}")
    report_lines.append("")

    numeric_cols = df.select_dtypes(include="number").columns
    if len(numeric_cols) > 0:
        report_lines.append("## Numeric Summary")
        report_lines.append(df[numeric_cols].describe().to_markdown())
        report_lines.append("")

    missing = df.isnull().sum()
    if missing.any():
        report_lines.append("## Missing Values")
        for col, count in missing[missing > 0].items():
            report_lines.append(f"- {col}: {count} ({count/len(df)*100:.1f}%)")

    output_path = os.path.join(output_dir, "analysis-report.md")
    with open(output_path, "w") as f:
        f.write("\n".join(report_lines))

    print(f"Report saved to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 analyze.py <input.csv> <output_dir>")
        sys.exit(1)
    analyze(sys.argv[1], sys.argv[2])
