// Package migrations embeds the SQL migration files so the db package can
// apply them without reading from disk at runtime.
//
// The embed lives here (next to the .sql files) because //go:embed patterns
// may not contain ".." — a package under internal/ cannot embed files from
// backend/migrations/.
package migrations

import "embed"

// FS holds every *.sql file in this directory.
//
//go:embed *.sql
var FS embed.FS
