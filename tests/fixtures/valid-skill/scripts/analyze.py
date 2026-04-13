#!/usr/bin/env python3
"""CSV Analyzer."""
import sys
import pandas as pd

def analyze(path):
    df = pd.read_csv(path)
    print(df.describe())

if __name__ == "__main__":
    analyze(sys.argv[1])
