#!/usr/bin/env python3
"""
Extract and print typing statistics from stats.txt file.
"""

import os
import re
from pathlib import Path


def extract_stats():
    """Read stats.txt and print all statistics to console."""
    # Get the project root directory (where this script is located)
    script_dir = Path(__file__).parent
    stats_file = script_dir / 'client' / 'stats.txt'

    # Check if stats file exists
    if not stats_file.exists():
        print(f"Error: stats.txt not found at {stats_file}")
        return

    # Read the stats file
    try:
        with open(stats_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading stats.txt: {e}")
        return

    # Parse and extract statistics
    stats = {}

    # Extract Total Errors Made
    match = re.search(r'Total Errors Made:\s*(\d+)', content)
    if match:
        stats['total_errors'] = int(match.group(1))

    # Extract Errors Left (Unfixed)
    match = re.search(r'Errors Left \(Unfixed\):\s*(\d+)', content)
    if match:
        stats['errors_left'] = int(match.group(1))

    # Extract Total Time
    match = re.search(r'Total Time:\s*([\d.]+)\s*seconds', content)
    if match:
        stats['total_time'] = float(match.group(1))

    # Extract Accuracy
    match = re.search(r'Accuracy:\s*([\d.]+)%', content)
    if match:
        stats['accuracy'] = float(match.group(1))

    # Extract Speed (WPM)
    match = re.search(r'Speed:\s*([\d.]+)\s*words per minute', content)
    if match:
        stats['speed'] = float(match.group(1))

    # Extract Generated timestamp
    match = re.search(r'Generated:\s*(.+)', content)
    if match:
        stats['generated'] = match.group(1).strip()

    # Extract Status (win/lose) for racing games
    match = re.search(r'Status:\s*(win|lose)', content, re.IGNORECASE)
    if match:
        stats['status'] = match.group(1).lower()

    # Print all statistics
    # Print status first if available
    if 'status' in stats:
        status_display = "WIN" if stats['status'] == 'win' else "LOSE"
        print(f"Status: {status_display}")
        print("=" * 50)
        print()

    print("Typing Statistics")
    print("=" * 50)
    print()

    if 'total_errors' in stats:
        print(f"Total Errors Made: {stats['total_errors']}")

    if 'errors_left' in stats:
        print(f"Errors Left (Unfixed): {stats['errors_left']}")

    if 'total_time' in stats:
        time_value = stats['total_time']
        if time_value < 60:
            print(f"Total Time: {time_value:.2f} seconds")
        else:
            minutes = int(time_value // 60)
            seconds = time_value % 60
            print(f"Total Time: {minutes}m {seconds:.2f}s")

    if 'accuracy' in stats:
        print(f"Accuracy: {stats['accuracy']:.2f}%")

    if 'speed' in stats:
        print(f"Speed: {stats['speed']:.2f} words per minute")

    if 'generated' in stats:
        print(f"Generated: {stats['generated']}")

    print()


if __name__ == '__main__':
    extract_stats()
