// Command seed-admin creates the one and only super_admin (the owner).
//
// Usage (on the VPS, with the api.env values exported, or .env sourced):
//
//	seed-admin --email dus@example.com --phone +919876543210 [--name "Dus Mamud"] [--whatsapp +919876543210]
//
// The password is read TWICE from the terminal with echo disabled and must
// match and satisfy the password policy; it is never printed, logged or
// read from an environment variable. --phone is required: the users table
// needs phone_no and no phone number is ever invented. --whatsapp defaults
// to the --phone value ("same as phone").
//
// Exit codes: 0 on success, 1 on any error (one line on stderr).
// Requires the config's required env vars (DATABASE_URL, BREVO_API_KEY,
// TURNSTILE_SECRET_KEY — config.Load enforces them); on the VPS these come
// from /etc/kumbuild/api.env, written by the deploy workflow before seeding.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/dusmamud/kumbuild/backend/internal/auth"
	"github.com/dusmamud/kumbuild/backend/internal/config"
	"github.com/dusmamud/kumbuild/backend/internal/db"
	"github.com/dusmamud/kumbuild/backend/internal/seed"
	"github.com/dusmamud/kumbuild/backend/internal/store"
	"golang.org/x/term"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seed-admin: "+err.Error())
		os.Exit(1)
	}
}

func run() error {
	fs := flag.NewFlagSet("seed-admin", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	email := fs.String("email", "", "owner email address (required)")
	name := fs.String("name", "Dus Mamud", "owner full name")
	phone := fs.String("phone", "", "owner phone in E.164 India format, e.g. +919876543210 (required)")
	whatsapp := fs.String("whatsapp", "", "owner WhatsApp number in E.164 format (optional, defaults to --phone)")
	if err := fs.Parse(os.Args[1:]); err != nil {
		return err
	}

	*email = strings.TrimSpace(*email)
	*name = strings.TrimSpace(*name)
	*phone = strings.TrimSpace(*phone)
	*whatsapp = strings.TrimSpace(*whatsapp)

	if *email == "" {
		fs.Usage()
		return fmt.Errorf("--email is required (e.g. --email dus@example.com)")
	}
	if *phone == "" {
		fs.Usage()
		return fmt.Errorf("--phone is required: the users table needs phone_no and no phone number is invented — pass --phone +91... (e.g. --phone +919876543210)")
	}
	if *whatsapp == "" {
		*whatsapp = *phone // "same as phone"
	}

	password, err := readPasswordTwice()
	if err != nil {
		return err
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close(pool)
	// Run migrations so seeding works on a fresh VPS.
	if err := db.Migrate(ctx, pool); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	users := store.NewPGUserStore(pool)
	created, err := seed.SeedSuperAdmin(ctx, users, auth.HashPassword, *email, *name, *phone, *whatsapp, password)
	if err != nil {
		return err
	}
	fmt.Printf("super_admin created: %s\n", created.Email)
	return nil
}

// readPasswordTwice reads the password twice from the terminal with echo
// disabled. The two entries must match and satisfy the password policy.
// Nothing is ever echoed — not even on failure.
func readPasswordTwice() (string, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return "", fmt.Errorf("password must be entered on a terminal (stdin is not a TTY) — run seed-admin interactively over SSH")
	}
	first, err := readHidden("Password: ")
	if err != nil {
		return "", err
	}
	second, err := readHidden("Password (again): ")
	if err != nil {
		return "", err
	}
	if first != second {
		return "", fmt.Errorf("passwords do not match")
	}
	if code, detail := auth.ValidatePasswordPolicy(first); code != "" {
		return "", fmt.Errorf("password does not satisfy the policy: %s", detail)
	}
	return first, nil
}

func readHidden(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", fmt.Errorf("read password: %w", err)
	}
	return string(b), nil
}
