package internal

import (
	"time"
)

func FormatFortumTime(t time.Time) string {
	s := t.UTC().Format(time.RFC3339)
	return s[:len(s)-1]
}

func EndOfTomorrow() time.Time {
	return StartOfToday().Add(48 * time.Hour).Add(-1 * time.Second)
}

func StartOfToday() time.Time {
	return time.Now().Truncate(24 * time.Hour)
}

func formatSQLiteTime(t time.Time) string {
	return t.UTC().Format(time.DateTime) + ".000Z"
}
