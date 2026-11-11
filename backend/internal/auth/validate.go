package auth

import (
	"net/mail"
	"regexp"
	"strings"
)

// Field error codes returned by the validators.
const (
	CodeRequired              = "required"
	CodeInvalidEmail          = "invalid-email"
	CodeWeakPassword          = "weak-password"
	CodeInvalidPhone          = "invalid-phone"
	CodeInvalidWhatsApp       = "invalid-whatsapp"
	CodeInvalidAltEmail       = "invalid-alt-email"
	CodeAltEmailSameAsPrimary = "alt-email-same-as-primary"
	CodeInvalidPincode        = "invalid-pincode"
	CodeInvalidGSTIN          = "invalid-gstin"
	CodeInvalidName           = "invalid-name"
)

var (
	// E.164: "+" + country code (no leading 0) + 8-15 digits total after "+".
	e164Re = regexp.MustCompile(`^\+[1-9]\d{7,14}$`)
	// Indian mobile: +91 + 10 digits starting 6-9.
	indianPhoneRe = regexp.MustCompile(`^\+91[6-9]\d{9}$`)
	// GSTIN format (AUTH_PLAN.md §2).
	gstinRe = regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
	// Indian pincode: 6 digits, first digit 1-9.
	pincodeRe = regexp.MustCompile(`^[1-9]\d{5}$`)
)

// ValidateEmail checks parseability, the 254-char RFC limit, and that the
// domain contains a dot (net/mail alone accepts "a@b", which is not a
// deliverable address for us).
func ValidateEmail(email string) bool {
	email = strings.TrimSpace(email)
	if email == "" || len(email) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(email)
	if err != nil {
		return false
	}
	_, domain, ok := strings.Cut(addr.Address, "@")
	return ok && strings.Contains(domain, ".")
}

// ValidateE164 reports whether s is a valid E.164 phone number.
func ValidateE164(s string) bool { return e164Re.MatchString(strings.TrimSpace(s)) }

// ValidateIndianPhone reports whether s is an Indian mobile in E.164 form.
func ValidateIndianPhone(s string) bool { return indianPhoneRe.MatchString(strings.TrimSpace(s)) }

// ValidateGSTIN reports whether s matches the GSTIN format.
func ValidateGSTIN(s string) bool { return gstinRe.MatchString(strings.TrimSpace(s)) }

// ValidatePincode reports whether s is a 6-digit Indian pincode.
func ValidatePincode(s string) bool { return pincodeRe.MatchString(strings.TrimSpace(s)) }

// ValidateFullName trims and checks 1-100 chars.
func ValidateFullName(name string) bool {
	n := len([]rune(strings.TrimSpace(name)))
	return n >= 1 && n <= 100
}

// SignupInput is the full field set collected at signup and at admin
// user-create (AUTH_PLAN.md §2). No field is ever dropped.
type SignupInput struct {
	FullName         string
	Email            string
	Password         string
	PhoneNo          string
	WhatsAppNo       string
	AlternativeEmail string

	// Billing address — customer ONLY; staff creation passes none.
	BillingName  string
	AddressLine1 string
	AddressLine2 string
	City         string
	State        string
	Pincode      string
	Country      string
	GSTIN        string

	// HasBilling is true when the caller supplied billing fields at all
	// (customer signup); false for staff creation (no billing address).
	HasBilling bool
}

// ValidateSignupInput validates every field server-side and returns a
// field -> error-code map. Empty map = valid.
func ValidateSignupInput(in SignupInput) map[string]string {
	errs := map[string]string{}

	if !ValidateFullName(in.FullName) {
		errs["full_name"] = CodeInvalidName
	}
	if strings.TrimSpace(in.Email) == "" {
		errs["email"] = CodeRequired
	} else if !ValidateEmail(in.Email) {
		errs["email"] = CodeInvalidEmail
	}
	if strings.TrimSpace(in.Password) == "" {
		errs["password"] = CodeRequired
	} else if code, _ := ValidatePasswordPolicy(in.Password); code != "" {
		errs["password"] = code
	}
	if strings.TrimSpace(in.PhoneNo) == "" {
		errs["phone_no"] = CodeRequired
	} else if !ValidateIndianPhone(in.PhoneNo) {
		errs["phone_no"] = CodeInvalidPhone
	}
	if strings.TrimSpace(in.WhatsAppNo) == "" {
		errs["whatsapp_no"] = CodeRequired
	} else if !ValidateE164(in.WhatsAppNo) {
		errs["whatsapp_no"] = CodeInvalidWhatsApp
	}
	if alt := strings.TrimSpace(in.AlternativeEmail); alt != "" {
		switch {
		case !ValidateEmail(alt):
			errs["alternative_email"] = CodeInvalidAltEmail
		case strings.EqualFold(alt, strings.TrimSpace(in.Email)):
			errs["alternative_email"] = CodeAltEmailSameAsPrimary
		}
	}

	if in.HasBilling {
		if strings.TrimSpace(in.BillingName) == "" {
			errs["billing_name"] = CodeRequired
		}
		if strings.TrimSpace(in.AddressLine1) == "" {
			errs["address_line1"] = CodeRequired
		}
		if strings.TrimSpace(in.City) == "" {
			errs["city"] = CodeRequired
		}
		if strings.TrimSpace(in.State) == "" {
			errs["state"] = CodeRequired
		}
		if strings.TrimSpace(in.Pincode) == "" {
			errs["pincode"] = CodeRequired
		} else if !ValidatePincode(in.Pincode) {
			errs["pincode"] = CodeInvalidPincode
		}
		if g := strings.TrimSpace(in.GSTIN); g != "" && !ValidateGSTIN(g) {
			errs["gstin"] = CodeInvalidGSTIN
		}
	}
	return errs
}
