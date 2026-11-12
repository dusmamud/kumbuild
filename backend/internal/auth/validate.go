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
	// Indian mobile national number: 10 digits, first digit 6-9
	// (National Numbering Plan 2003).
	indianNationalRe = regexp.MustCompile(`^[6-9]\d{9}$`)
	// Separators people type into phone fields. Forms accept them
	// (GOV.UK phone-number pattern: let users type the format they
	// know) and the validators strip them before checking.
	phoneSeparators = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")
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

// NormalizeIndianMobile converts an Indian mobile number as typed into a
// form into canonical E.164 (+91XXXXXXXXXX) — the only form ever stored.
// Accepted input shapes (separators space/-/()/ . are stripped first):
//
//	98765 43210        national 10 digits
//	09876543210        trunk 0 prefix
//	919876543210       bare country code (12 digits total)
//	0091 98765 43210   international dialling prefix
//	+91 98765 43210    E.164
//
// The country code is stripped ONLY when the shape proves it is one
// (explicit + / 00 prefix, or a 12-digit 91… number): a genuine 10-digit
// number may itself start with 91 and must not be mangled. The remaining
// national number must match ^[6-9]\d{9}$.
func NormalizeIndianMobile(s string) (string, bool) {
	s = phoneSeparators.Replace(strings.TrimSpace(s))
	var national string
	switch {
	case strings.HasPrefix(s, "+"):
		if !strings.HasPrefix(s, "+91") {
			return "", false
		}
		national = s[len("+91"):]
	case strings.HasPrefix(s, "0091"):
		national = s[len("0091"):]
	case len(s) == 12 && strings.HasPrefix(s, "91"):
		national = s[len("91"):]
	case len(s) == 11 && strings.HasPrefix(s, "0"):
		national = s[len("0"):]
	case len(s) == 10:
		national = s
	default:
		return "", false
	}
	if !indianNationalRe.MatchString(national) {
		return "", false
	}
	return "+91" + national, true
}

// ValidateIndianPhone reports whether s is an Indian mobile in any of
// the typed forms NormalizeIndianMobile accepts.
func ValidateIndianPhone(s string) bool {
	_, ok := NormalizeIndianMobile(s)
	return ok
}

// NormalizeWhatsApp returns the E.164 storage form of a WhatsApp number.
// Indian numbers follow the same rule as phone_no (any typed form of an
// Indian mobile normalises to +91…). Non-Indian numbers keep the
// long-standing behaviour: they must already be strict E.164 with an
// explicit "+" country code. Deliberate, documented widening vs. the old
// E.164-only check: a bare/trunk Indian number is now accepted here too,
// because the "same as phone" signup flow copies phone_no verbatim and
// phone_no accepts those forms.
func NormalizeWhatsApp(s string) (string, bool) {
	t := strings.TrimSpace(s)
	if strings.HasPrefix(t, "+91") {
		return NormalizeIndianMobile(t)
	}
	if e164Re.MatchString(t) {
		return t, true
	}
	return NormalizeIndianMobile(t)
}

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

	// Billing address — admin-created customers ONLY. Public signup
	// collects NO billing address (removed 2026-11-12: minimal-field
	// registration; billing is captured later) and staff creation
	// passes none.
	BillingName  string
	AddressLine1 string
	AddressLine2 string
	City         string
	State        string
	Pincode      string
	Country      string
	GSTIN        string

	// HasBilling is true only when billing fields must be validated
	// (admin create-customer). Public signup and staff creation pass
	// false: their billing fields are neither validated nor stored.
	HasBilling bool
}

// NormalizedPhone returns the E.164 storage form of PhoneNo. Call only
// after ValidateSignupInput accepted the input; "" before that.
func (in SignupInput) NormalizedPhone() string {
	n, _ := NormalizeIndianMobile(in.PhoneNo)
	return n
}

// NormalizedWhatsApp returns the E.164 storage form of WhatsAppNo. Call
// only after ValidateSignupInput accepted the input; "" before that.
func (in SignupInput) NormalizedWhatsApp() string {
	n, _ := NormalizeWhatsApp(in.WhatsAppNo)
	return n
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
	} else if _, ok := NormalizeIndianMobile(in.PhoneNo); !ok {
		errs["phone_no"] = CodeInvalidPhone
	}
	if strings.TrimSpace(in.WhatsAppNo) == "" {
		errs["whatsapp_no"] = CodeRequired
	} else if _, ok := NormalizeWhatsApp(in.WhatsAppNo); !ok {
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
